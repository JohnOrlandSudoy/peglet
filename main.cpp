#include <Arduino.h>
#include <Wire.h>
#include <DHT.h>
#include <Adafruit_MLX90614.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

Adafruit_MLX90614 mlx = Adafruit_MLX90614();

static const int DHT_PIN = 16;
static const int I2C_SDA = 21;
static const int I2C_SCL = 22;

#define AMMONIA_PIN 34
#define RELAY_FAN 25
#define RELAY_PUMP 26
#define RELAY_SPARE 27
#define RELAY_HEATER 5

#define LED_BLUE_PIN 23
#define LED_GREEN_PIN 18
#define BUZZER_PIN 19

static const bool ENABLE_MLX90614 = true;
static const bool ENABLE_DHT = true;
static const bool ENABLE_ADC_NH3 = true;
static const bool ENABLE_RELAYS = true;

const char* ssid = "piglet";
const char* password = "1234567890";
static const char* supabaseHost = "ipaonuxlvyjtfldjdpyb.supabase.co";
static const char* supabasePath = "/rest/v1/piglet_readings";
static const char* relayCommandsPath = "/rest/v1/relay_commands?device_id=eq.default&select=spare_relay_on,updated_at";
const char* supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwYW9udXhsdnlqdGZsZGpkcHliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1ODA3MzcsImV4cCI6MjA5MTE1NjczN30.E9ml7x_qOjAszq_5kkD0JjH6ZHbz86uqmHs8lNOYYOw";

DHT dht(DHT_PIN, 22);

float coreTemp = 0.0;
float ambientTemp = 0.0;
float humidity = 0.0;
float ammoniaPPM = 0.0;
bool spareOn = false;
static bool heaterFanOn = false;

static bool mlxReady = false;
static bool hasCoreTemp = false;
static uint32_t mlxFailCount = 0;
static unsigned long nextMlxInitAt = 0;
static unsigned long nextI2CRecoverAt = 0;

static unsigned long lastSend = 0;

static unsigned long greenLedUntilMs = 0;
static bool isSending = false;
static unsigned long nextRelayPollAt = 0;

static unsigned long buzzerUntilMs = 0;
static unsigned long buzzerNextAllowedAt = 0;
static bool buzzerActive = false;

static const unsigned long SEND_INTERVAL_MS = 2000;

static const char* wifiStatusToString(wl_status_t s) {
  switch (s) {
    case WL_NO_SHIELD:
      return "WL_NO_SHIELD";
    case WL_IDLE_STATUS:
      return "WL_IDLE_STATUS";
    case WL_NO_SSID_AVAIL:
      return "WL_NO_SSID_AVAIL";
    case WL_SCAN_COMPLETED:
      return "WL_SCAN_COMPLETED";
    case WL_CONNECTED:
      return "WL_CONNECTED";
    case WL_CONNECT_FAILED:
      return "WL_CONNECT_FAILED";
    case WL_CONNECTION_LOST:
      return "WL_CONNECTION_LOST";
    case WL_DISCONNECTED:
      return "WL_DISCONNECTED";
    default:
      return "WL_UNKNOWN";
  }
}

static void printWiFiStatus() {
  wl_status_t st = WiFi.status();
  Serial.print("WiFi: ");
  Serial.print(wifiStatusToString(st));
  Serial.print(" (");
  Serial.print((int)st);
  Serial.println(")");
  if (st == WL_CONNECTED) {
    Serial.print("IP: ");
    Serial.print(WiFi.localIP());
    Serial.print(" | RSSI: ");
    Serial.print(WiFi.RSSI());
    Serial.print(" dBm | CH: ");
    Serial.println(WiFi.channel());
  }
}

static void ensureWiFiConnected() {
  if (WiFi.status() == WL_CONNECTED) return;

  static unsigned long nextAttemptAt = 0;
  static unsigned long lastBeginAt = 0;
  static uint32_t attempt = 0;
  unsigned long now = millis();
  if ((long)(now - nextAttemptAt) < 0) return;

  WiFi.mode(WIFI_STA);
  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);
  WiFi.setSleep(false);

  wl_status_t st = WiFi.status();
  if (st == WL_IDLE_STATUS) {
    if (lastBeginAt != 0 && now - lastBeginAt > 20000) {
      Serial.println("WiFi connect timeout, restarting connection...");
      WiFi.disconnect(false);
      delay(50);
      lastBeginAt = 0;
      nextAttemptAt = now + 1000;
    }
    return;
  }

  attempt++;
  Serial.print("WiFi connect attempt ");
  Serial.print((unsigned long)attempt);
  Serial.print(" to SSID '");
  Serial.print(ssid);
  Serial.println("'...");
  WiFi.disconnect(false);
  delay(50);
  WiFi.begin(ssid, password);
  lastBeginAt = now;
  nextAttemptAt = now + 3000;
  yield();
}

static void setGreenLedPulse(unsigned long durationMs) {
  greenLedUntilMs = millis() + durationMs;
}

static void buzzerBeep(unsigned long durationMs, uint16_t frequencyHz) {
  buzzerActive = true;
  buzzerUntilMs = millis() + durationMs;
  tone(BUZZER_PIN, frequencyHz);
}

static void buzzerStop() {
  buzzerActive = false;
  noTone(BUZZER_PIN);
  digitalWrite(BUZZER_PIN, LOW);
}

static bool i2cProbeAddress(uint8_t address) {
  Wire.beginTransmission(address);
  uint8_t err = Wire.endTransmission();
  Serial.print("I2C probe 0x");
  if (address < 16) Serial.print("0");
  Serial.print(address, HEX);
  Serial.print(" -> ");
  Serial.print(err == 0 ? "OK" : "FAIL");
  Serial.print(" (");
  Serial.print(err);
  Serial.println(")");
  return err == 0;
}

static void i2cScanBus() {
  Serial.println("I2C scan begin");
  uint8_t found = 0;
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    uint8_t err = Wire.endTransmission();
    if (err == 0) {
      Serial.print("I2C device @ 0x");
      if (addr < 16) Serial.print("0");
      Serial.println(addr, HEX);
      found++;
    }
    delay(1);
  }
  Serial.print("I2C scan done, found=");
  Serial.println(found);
}

static bool readLineWithTimeout(WiFiClientSecure& client, String& outLine, unsigned long timeoutMs) {
  outLine = "";
  unsigned long start = millis();
  while (millis() - start < timeoutMs) {
    while (client.available()) {
      char ch = (char)client.read();
      if (ch == '\r') continue;
      if (ch == '\n') return true;
      outLine += ch;
      if (outLine.length() > 512) return true;
    }
    if (!client.connected() && !client.available()) {
      return outLine.length() > 0;
    }
    delay(1);
  }
  return false;
}

static bool httpsGetJson(const char* path, int& statusCodeOut, String& responseBodyOut) {
  statusCodeOut = 0;
  responseBodyOut = "";

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(8000);

  if (WiFi.status() != WL_CONNECTED) return false;

  IPAddress ip;
  if (!WiFi.hostByName(supabaseHost, ip)) {
    return false;
  }

  if (!client.connect(supabaseHost, 443)) {
    return false;
  }

  client.print("GET ");
  client.print(path);
  client.println(" HTTP/1.1");
  client.print("Host: ");
  client.println(supabaseHost);
  client.print("apikey: ");
  client.println(supabaseKey);
  client.print("Authorization: Bearer ");
  client.println(supabaseKey);
  client.println("Accept: application/json");
  client.println("Connection: close");
  client.println();
  client.flush();

  String statusLine;
  if (!readLineWithTimeout(client, statusLine, 8000)) {
    client.stop();
    return false;
  }

  int firstSpace = statusLine.indexOf(' ');
  if (firstSpace >= 0 && firstSpace + 1 < (int)statusLine.length()) {
    statusCodeOut = statusLine.substring(firstSpace + 1).toInt();
  }

  String line;
  while (readLineWithTimeout(client, line, 5000)) {
    if (line.length() == 0) break;
  }

  unsigned long startBody = millis();
  while (millis() - startBody < 8000) {
    while (client.available()) {
      char ch = (char)client.read();
      responseBodyOut += ch;
      if (responseBodyOut.length() > 1500) {
        client.stop();
        return true;
      }
    }
    if (!client.connected()) break;
    delay(1);
  }

  client.stop();
  return true;
}

static bool httpsPostJson(const String& jsonPayload, int& statusCodeOut, String& responseBodyOut) {
  statusCodeOut = 0;
  responseBodyOut = "";

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(8000);

  IPAddress ip;
  if (!WiFi.hostByName(supabaseHost, ip)) {
    Serial.println("Supabase DNS failed");
    return false;
  }

  Serial.print("Connecting to Supabase (");
  Serial.print(ip);
  Serial.println(":443)...");
  unsigned long startConnect = millis();
  if (!client.connect(supabaseHost, 443)) {
    Serial.println("Supabase connect failed");
    Serial.print("Connect ms: ");
    Serial.println(millis() - startConnect);
    return false;
  }
  Serial.print("Connect ms: ");
  Serial.println(millis() - startConnect);

  client.print("POST ");
  client.print(supabasePath);
  client.println(" HTTP/1.1");
  client.print("Host: ");
  client.println(supabaseHost);
  client.print("apikey: ");
  client.println(supabaseKey);
  client.print("Authorization: Bearer ");
  client.println(supabaseKey);
  client.println("Content-Type: application/json");
  client.println("Accept: application/json");
  client.println("Prefer: return=representation");
  client.println("Connection: close");
  client.print("Content-Length: ");
  client.println(jsonPayload.length());
  client.println();
  client.print(jsonPayload);
  client.flush();

  String statusLine;
  if (!readLineWithTimeout(client, statusLine, 8000)) {
    Serial.println("Supabase: no HTTP status line (timeout)");
    client.stop();
    return false;
  }

  int firstSpace = statusLine.indexOf(' ');
  if (firstSpace >= 0 && firstSpace + 1 < (int)statusLine.length()) {
    statusCodeOut = statusLine.substring(firstSpace + 1).toInt();
  }

  String line;
  while (readLineWithTimeout(client, line, 5000)) {
    if (line.length() == 0) break;
  }

  unsigned long startBody = millis();
  while (millis() - startBody < 8000) {
    while (client.available()) {
      char ch = (char)client.read();
      responseBodyOut += ch;
      if (responseBodyOut.length() > 1500) {
        client.stop();
        return true;
      }
    }
    if (!client.connected()) break;
    delay(1);
  }

  client.stop();
  return true;
}

static void pollRelayCommands() {
  if ((long)(millis() - nextRelayPollAt) < 0) return;
  nextRelayPollAt = millis() + 2000;

  int code = 0;
  String body;
  bool ok = httpsGetJson(relayCommandsPath, code, body);
  if (!ok || code < 200 || code >= 300 || body.length() == 0) return;

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, body);
  if (err) return;

  JsonArray arr = doc.as<JsonArray>();
  if (arr.size() == 0) return;
  JsonObject obj = arr[0].as<JsonObject>();
  if (obj.containsKey("spare_relay_on")) {
    spareOn = obj["spare_relay_on"].as<bool>();
  }
}

static void sendToSupabase(bool fanOn, bool pumpOn, bool spareOn, bool heaterOn) {
  isSending = true;

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Supabase skipped: WiFi not connected");
    if (millis() >= buzzerNextAllowedAt) {
      buzzerBeep(150, 1800);
      buzzerNextAllowedAt = millis() + 1500;
    }
    isSending = false;
    return;
  }

  StaticJsonDocument<512> doc;
  doc["core_temperature"] = coreTemp;
  doc["ambient_temperature"] = ambientTemp;
  doc["humidity"] = humidity;
  doc["ammonia_ppm"] = ammoniaPPM;
  doc["cooling_fan_status"] = fanOn;
  doc["water_pump_status"] = pumpOn;
  doc["spare_relay_status"] = spareOn;
  doc["heater_fan_status"] = heaterOn;

  String json;
  serializeJson(doc, json);

  Serial.print("Supabase POST -> https://");
  Serial.print(supabaseHost);
  Serial.println(supabasePath);
  Serial.print("Payload: ");
  Serial.println(json);

  int code = 0;
  String body;
  bool ok = httpsPostJson(json, code, body);
  Serial.print("Supabase Response: ");
  Serial.println(code);
  if (body.length() > 0) {
    Serial.println(body);
  }

  if (ok && code >= 200 && code < 300) {
    setGreenLedPulse(350);
  } else if (millis() >= buzzerNextAllowedAt) {
    buzzerBeep(250, 1400);
    buzzerNextAllowedAt = millis() + 2000;
  }

  isSending = false;
}

void setup() {
  Serial.begin(115200);
  delay(200);

  pinMode(LED_BLUE_PIN, OUTPUT);
  pinMode(LED_GREEN_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(LED_BLUE_PIN, LOW);
  digitalWrite(LED_GREEN_PIN, LOW);
  buzzerStop();

  pinMode(I2C_SDA, INPUT_PULLUP);
  pinMode(I2C_SCL, INPUT_PULLUP);
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(100000);

  Serial.print("I2C pins SDA=");
  Serial.print(I2C_SDA);
  Serial.print(" SCL=");
  Serial.println(I2C_SCL);
  i2cScanBus();

  ensureWiFiConnected();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi Connected! IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi not connected (continuing).");
  }

  pinMode(RELAY_FAN, OUTPUT);
  pinMode(RELAY_PUMP, OUTPUT);
  pinMode(RELAY_SPARE, OUTPUT);
  pinMode(RELAY_HEATER, OUTPUT);
  digitalWrite(RELAY_FAN, HIGH);
  digitalWrite(RELAY_PUMP, HIGH);
  digitalWrite(RELAY_SPARE, HIGH);
  digitalWrite(RELAY_HEATER, HIGH);

  pinMode(DHT_PIN, INPUT_PULLUP);
  dht.begin();

  Serial.println("Initializing MLX90614...");
  if (ENABLE_MLX90614) {
    mlxReady = mlx.begin();
    if (mlxReady) {
      Serial.println("MLX90614 ready!");
    } else {
      Serial.println("MLX90614 failed to initialize (continuing).");
      i2cProbeAddress(0x5A);
      i2cScanBus();
      nextMlxInitAt = millis() + 5000;
    }
  } else {
    Serial.println("MLX90614 disabled (ENABLE_MLX90614=false)");
    mlxReady = false;
    nextMlxInitAt = millis() + 5000;
  }

  printWiFiStatus();
}

void loop() {
  ensureWiFiConnected();
  pollRelayCommands();

  bool wifiConnected = WiFi.status() == WL_CONNECTED;
  digitalWrite(LED_BLUE_PIN, wifiConnected ? HIGH : LOW);
  digitalWrite(LED_GREEN_PIN, isSending || millis() < greenLedUntilMs ? HIGH : LOW);
  if (buzzerActive && millis() >= buzzerUntilMs) {
    buzzerStop();
  }

  if (ENABLE_DHT) {
    static unsigned long lastDhtReadAt = 0;
    unsigned long now = millis();
    if (now - lastDhtReadAt >= 3000) {
      lastDhtReadAt = now;
      float h = dht.readHumidity();
      float t = dht.readTemperature();
      if (!isnan(h) && !isnan(t)) {
        humidity = h;
        ambientTemp = t;
      } else {
        Serial.println("DHT read failed (NaN). Check module pin order + wiring.");
      }
    }
  }

  unsigned long nowMs = millis();
  if (ENABLE_MLX90614 && !mlxReady) {
    if ((long)(nowMs - nextMlxInitAt) >= 0) {
      bool found = i2cProbeAddress(0x5A);
      if (!found) {
        nextMlxInitAt = nowMs + 5000;
      } else {
        mlxReady = mlx.begin();
      }
      if (mlxReady) {
        Serial.println("MLX90614 re-init success");
      } else {
        Serial.println("MLX90614 re-init failed");
        i2cScanBus();
        Wire.end();
        delay(50);
        pinMode(I2C_SDA, INPUT_PULLUP);
        pinMode(I2C_SCL, INPUT_PULLUP);
        Wire.begin(I2C_SDA, I2C_SCL);
        Wire.setClock(100000);
        delay(50);
        nextMlxInitAt = nowMs + 5000;
      }
    }
  }

  if (ENABLE_MLX90614 && mlxReady) {
    static unsigned long lastMlxReadAt = 0;
    if (nowMs - lastMlxReadAt >= 1000) {
      lastMlxReadAt = nowMs;
      float objectTemp = mlx.readObjectTempC();
      if (!isnan(objectTemp)) {
        coreTemp = objectTemp;
        hasCoreTemp = true;
        mlxFailCount = 0;
      } else {
        mlxFailCount++;
        if (mlxFailCount >= 3 && (long)(nowMs - nextI2CRecoverAt) >= 0) {
          Serial.println("MLX90614 read failed, I2C recover...");
          Wire.end();
          delay(50);
          pinMode(I2C_SDA, INPUT_PULLUP);
          pinMode(I2C_SCL, INPUT_PULLUP);
          Wire.begin(I2C_SDA, I2C_SCL);
          Wire.setClock(100000);
          delay(50);
          mlxReady = false;
          mlxFailCount = 0;
          nextI2CRecoverAt = nowMs + 5000;
          nextMlxInitAt = nowMs + 1000;
        }
      }
    }
  }

  if (ENABLE_ADC_NH3) {
    int adc = analogRead(AMMONIA_PIN);
    float volt = adc * (3.3 / 4095.0);
    ammoniaPPM = 10 * (volt / 0.6);
  }

  if (!ENABLE_MLX90614 || !hasCoreTemp) {
    coreTemp = ambientTemp;
  }

  bool fanOn = ((hasCoreTemp && coreTemp >= 40.0) || ambientTemp > 32.0 || ammoniaPPM >= 25.0);
  bool pumpOn = (ammoniaPPM >= 11.0);

  bool heaterDemand = false;
  if (ambientTemp > 0) {
    heaterDemand = heaterDemand || ambientTemp < 22.0;
  }
  if (hasCoreTemp) {
    heaterDemand = heaterDemand || coreTemp < 34.0;
  }

  if (heaterFanOn) {
    bool keepOn = false;
    if (ambientTemp > 0) keepOn = keepOn || ambientTemp < 23.0;
    if (hasCoreTemp) keepOn = keepOn || coreTemp < 35.0;
    heaterFanOn = keepOn;
  } else {
    heaterFanOn = heaterDemand;
  }

  if (ENABLE_RELAYS) {
    digitalWrite(RELAY_FAN, fanOn ? LOW : HIGH);
    digitalWrite(RELAY_PUMP, pumpOn ? LOW : HIGH);
    digitalWrite(RELAY_SPARE, spareOn ? LOW : HIGH);
    digitalWrite(RELAY_HEATER, heaterFanOn ? LOW : HIGH);
  }

  if (!isSending && millis() - lastSend > SEND_INTERVAL_MS) {
    sendToSupabase(fanOn, pumpOn, spareOn, heaterFanOn);
    lastSend = millis();
  }

  Serial.print("Core: ");
  Serial.print(coreTemp, 2);
  Serial.print("C | Ambient: ");
  Serial.print(ambientTemp, 2);
  Serial.print("C | Hum: ");
  Serial.print(humidity, 1);
  Serial.print("% | NH3: ");
  Serial.print(ammoniaPPM, 1);
  Serial.println(" ppm");

  delay(2000);
}

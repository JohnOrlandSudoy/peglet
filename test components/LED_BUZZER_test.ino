 #include <Arduino.h>
 
 #define LED_BLUE_PIN 23
 #define LED_GREEN_PIN 18
 #define BUZZER_PIN 19
 
 static void allOff() {
   digitalWrite(LED_BLUE_PIN, LOW);
   digitalWrite(LED_GREEN_PIN, LOW);
   noTone(BUZZER_PIN);
   digitalWrite(BUZZER_PIN, LOW);
 }
 
 void setup() {
   Serial.begin(115200);
   delay(300);
 
   pinMode(LED_BLUE_PIN, OUTPUT);
   pinMode(LED_GREEN_PIN, OUTPUT);
   pinMode(BUZZER_PIN, OUTPUT);
   allOff();
 
   Serial.println();
   Serial.println("LED+BUZZER TEST");
   Serial.print("BLUE LED PIN: ");
   Serial.println(LED_BLUE_PIN);
   Serial.print("GREEN LED PIN: ");
   Serial.println(LED_GREEN_PIN);
   Serial.print("BUZZER PIN: ");
   Serial.println(BUZZER_PIN);
 }
 
 void loop() {
   Serial.println("BLUE ON (2s)");
   allOff();
   digitalWrite(LED_BLUE_PIN, HIGH);
   delay(2000);
 
   Serial.println("GREEN ON (2s)");
   allOff();
   digitalWrite(LED_GREEN_PIN, HIGH);
   delay(2000);
 
   Serial.println("BUZZER BEEP (3x)");
   allOff();
   for (int i = 0; i < 3; i++) {
     tone(BUZZER_PIN, 2000);
     delay(200);
     noTone(BUZZER_PIN);
     delay(200);
   }
 
   Serial.println("BOTH LED BLINK (5x)");
   allOff();
   for (int i = 0; i < 5; i++) {
     digitalWrite(LED_BLUE_PIN, HIGH);
     digitalWrite(LED_GREEN_PIN, HIGH);
     delay(200);
     digitalWrite(LED_BLUE_PIN, LOW);
     digitalWrite(LED_GREEN_PIN, LOW);
     delay(200);
   }
 
   Serial.println("DONE, repeat in 3s");
   allOff();
   delay(3000);
 }

#include <Wire.h>
#include <Adafruit_MLX90614.h>

Adafruit_MLX90614 mlx = Adafruit_MLX90614();

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== MLX90614 INFRARED TEMPERATURE TEST ===");
  
  Wire.begin(21, 22);           // SDA=21, SCL=22

  if (!mlx.begin()) {
    Serial.println("❌ MLX90614 NOT FOUND! Suriin ang wiring.");
    while(1);
  }

  Serial.println("✅ MLX90614 Found & Ready!");
  Serial.println("Ambient Temp | Object Temp (IR)");
  Serial.println("-----------------------------------");
}

void loop() {
  float ambient = mlx.readAmbientTempC();
  float object  = mlx.readObjectTempC();

  Serial.print("Ambient: ");
  Serial.print(ambient, 1);
  Serial.print(" °C\t");

  Serial.print("Object: ");
  Serial.print(object, 1);
  Serial.println(" °C");

  delay(1000);   // 1 segundo update
}
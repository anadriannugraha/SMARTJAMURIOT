#include <WiFi.h>
#include <PubSubClient.h>

const char* ssid = "Wokwi-GUEST";
const char* password = "";

// Konfigurasi MQTT (Public Broker Gratis)
const char* mqtt_server = "broker.emqx.io";
const int mqtt_port = 1883;
const char* mqtt_topic_data = "jamur/tiram/data/petani123";
const char* mqtt_topic_kontrol = "jamur/tiram/kontrol/petani123";

WiFiClient espClient;
PubSubClient client(espClient);

// Pin ESP32
#define PUMP_PIN 2  // LED Merah (Humidifier/Pompa)
#define FAN_PIN 4   // LED Biru (Kipas)

bool pumpStatus = false;
bool fanStatus  = false;

// Variabel Simulasi Sensor
float suhu  = 24.5;
float lembab = 87.2;
bool suhuNaik   = true;
bool lembabTurun = true;

unsigned long lastMsg = 0;

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Menghubungkan ke WiFi: ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi terhubung!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void callback(char* topic, byte* payload, unsigned int length) {
  String msg;
  for (int i = 0; i < length; i++) {
    msg += (char)payload[i];
  }
  
  Serial.print("Perintah masuk dari Web: ");
  Serial.println(msg);
  
  if (msg.indexOf("kipas=1") >= 0) {
    fanStatus = true;
    digitalWrite(FAN_PIN, HIGH);
  } else if (msg.indexOf("kipas=0") >= 0) {
    fanStatus = false;
    digitalWrite(FAN_PIN, LOW);
  }

  if (msg.indexOf("humidifier=1") >= 0) {
    pumpStatus = true;
    digitalWrite(PUMP_PIN, HIGH);
  } else if (msg.indexOf("humidifier=0") >= 0) {
    pumpStatus = false;
    digitalWrite(PUMP_PIN, LOW);
  }
}

void reconnect() {
  // Loop terus sampai berhasil terhubung ke MQTT
  while (!client.connected()) {
    Serial.print("Menghubungkan ke MQTT Broker...");
    // Buat Client ID acak
    String clientId = "JamurTiramESP32-";
    clientId += String(random(0xffff), HEX);
    
    // Coba hubungkan
    if (client.connect(clientId.c_str())) {
      Serial.println(" Berhasil terhubung MQTT!");
      // Langganan (subscribe) ke topik perintah (kontrol)
      client.subscribe(mqtt_topic_kontrol);
    } else {
      Serial.print(" Gagal, rc=");
      Serial.print(client.state());
      Serial.println(" Coba lagi dalam 5 detik...");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PUMP_PIN, OUTPUT);
  pinMode(FAN_PIN, OUTPUT);

  digitalWrite(PUMP_PIN, LOW);
  digitalWrite(FAN_PIN, LOW);

  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  unsigned long now = millis();
  // Kirim data sensor setiap 3 detik
  if (now - lastMsg > 3000) {
    lastMsg = now;
    
    // Simulasi sensor bergerak perlahan
    if (suhuNaik) {
      suhu += 0.2;
      if (suhu >= 30.0) suhuNaik = false;
    } else {
      suhu -= 0.2;
      if (suhu <= 20.0) suhuNaik = true;
    }

    if (lembabTurun) {
      lembab -= 0.5;
      if (lembab <= 55.0) lembabTurun = false;
    } else {
      lembab += 0.5;
      if (lembab >= 95.0) lembabTurun = true;
    }

    // Susun format JSON
    String json = "{";
    json += "\"suhu\":" + String(suhu, 1) + ",";
    json += "\"kelembaban\":" + String(lembab, 1) + ",";
    json += "\"kipas\":" + String(fanStatus ? "true" : "false") + ",";
    json += "\"humidifier\":" + String(pumpStatus ? "true" : "false");
    json += "}";

    Serial.print("Memancarkan data ke Web: ");
    Serial.println(json);
    
    // Publikasi (Kirim) data ke topik
    client.publish(mqtt_topic_data, json.c_str());
  }
}

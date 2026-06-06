#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <time.h>

// ==========================================
// DATA KREDENSIAL
// ==========================================
String botToken = "8666954031:AAHzzmoS66ooQKKfpWu5AG7rZVsIjPoqKYU";
String chatIds[] = {"5632439233", "6948785757"}; // User, Teman
int numChatIds = 2;
String thingSpeakApiKey = "N0ZWSD71PSZA2ZZQ";

const char* ssid = "Wokwi-GUEST";
const char* password = "";

// ==========================================
// KONFIGURASI PIN & SENSOR
// ==========================================
#define PUMP_PIN 2  // LED Merah (Pompa)
#define FAN_PIN 4   // LED Biru (Kipas)

LiquidCrystal_I2C lcd(0x27, 16, 2);

// Status Mesin
bool pumpStatus = false;
bool fanStatus  = false;

// Variabel Simulasi Otomatis (Bergerak Sendiri)
float suhu  = 24.0;
float lembab = 90.0;
bool suhuNaik   = true;
bool lembabTurun = true;

// ==========================================
// FITUR BARU: Statistik Sesi
// ==========================================
float suhuMin  = 99.0;
float suhuMax  = 0.0;
float lembabMin = 99.0;
float lembabMax = 0.0;
int   jumlahAktifKipas = 0;
int   jumlahAktifPompa = 0;

// Cooldown alarm kritis (agar tidak spam)
unsigned long waktuAlarmSuhuTerakhir  = 0;
unsigned long waktuAlarmLembabTerakhir = 0;
const unsigned long cooldownAlarm = 120000; // 2 menit antar alarm

// Timer laporan rutin
unsigned long waktuLaporTerakhir = 0;
const unsigned long intervalLapor = 60000; // 60 detik

// Pengaturan Waktu Internet (NTP)
const char* ntpServer      = "pool.ntp.org";
const long  gmtOffset_sec  = 25200; // GMT+7 (WIB)
const int   daylightOffset_sec = 0;

// ==========================================
// FUNGSI WAKTU
// ==========================================
void setupWaktu() {
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
}

String dapatkanJam() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "00:00:00";
  char buf[10];
  strftime(buf, sizeof(buf), "%H:%M:%S", &timeinfo);
  return String(buf);
}

String dapatkanTanggal() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "??-??-????";
  char buf[12];
  strftime(buf, sizeof(buf), "%d/%m/%Y", &timeinfo);
  return String(buf);
}

// Salam otomatis berdasarkan jam
String dapatkanSalam() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "Halo";
  int jam = timeinfo.tm_hour;
  if (jam >= 5  && jam < 12) return "Selamat Pagi";
  if (jam >= 12 && jam < 15) return "Selamat Siang";
  if (jam >= 15 && jam < 18) return "Selamat Sore";
  return "Selamat Malam";
}

// Uptime dalam format "Xj Ym Zd"
String dapatkanUptime() {
  unsigned long ms = millis();
  unsigned long detik = ms / 1000;
  unsigned long menit  = detik / 60;
  unsigned long jam    = menit / 60;
  menit = menit % 60;
  detik = detik % 60;
  return String(jam) + "j " + String(menit) + "m " + String(detik) + "d";
}

// ==========================================
// FUNGSI PENGIRIMAN DATA
// ==========================================
void sendTelegramMessage(String msg) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    msg.replace("\n", "%0A");

    for (int i = 0; i < numChatIds; i++) {
      String url = "https://api.telegram.org/bot" + botToken +
                   "/sendMessage?chat_id=" + chatIds[i] +
                   "&text=" + msg + "&parse_mode=Markdown";

      http.begin(url);
      int httpCode = http.GET();

      if (httpCode == 200) {
        Serial.println("[Telegram] ✅ Terkirim ke chat " + chatIds[i]);
      } else {
        Serial.println("[Telegram] ❌ GAGAL ke chat " + chatIds[i] + " | Code: " + String(httpCode));
      }

      http.end();
      delay(100); // Jeda antar penerima, hindari rate-limit
    }
  } else {
    Serial.println("[Telegram] ❌ WiFi tidak terhubung!");
  }
}

void sendToThingSpeak() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = "http://api.thingspeak.com/update?api_key=" + thingSpeakApiKey +
                 "&field1=" + String(suhu, 1) +
                 "&field2=" + String(lembab, 1) +
                 "&field3=" + String(pumpStatus) +
                 "&field4=" + String(fanStatus);

    http.begin(url);
    int httpCode = http.GET();
    if (httpCode > 0) {
      Serial.println("[ThingSpeak] ✅ Data terkirim | Code: " + String(httpCode));
    } else {
      Serial.println("[ThingSpeak] ❌ GAGAL kirim data | Code: " + String(httpCode));
    }
    http.end();
  }
}

// ==========================================
// PROGRAM UTAMA
// ==========================================
void setup() {
  Serial.begin(115200);
  pinMode(PUMP_PIN, OUTPUT);
  pinMode(FAN_PIN, OUTPUT);

  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Menghubungkan...");

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  setupWaktu();

  lcd.clear();
  lcd.print("WiFi Sukses!");
  delay(1000);

  String jamMulai    = dapatkanJam();
  String tanggalMulai = dapatkanTanggal();
  String salam       = dapatkanSalam();

  sendTelegramMessage(
    "✅ *Sistem Smart Jamur Aktif!*\n"
    "━━━━━━━━━━━━━━━━━\n"
    "👋 " + salam + "!\n"
    "📅 Tanggal: " + tanggalMulai + "\n"
    "🕒 Jam: " + jamMulai + "\n"
    "━━━━━━━━━━━━━━━━━\n"
    "🌡 Suhu awal: " + String(suhu, 1) + " °C\n"
    "💧 Kelembaban awal: " + String(lembab, 1) + " %\n"
    "⚙️ Pompa: OFF | Kipas: OFF\n"
    "━━━━━━━━━━━━━━━━━\n"
    "📡 Laporan rutin setiap 60 detik.\n"
    "🍄 Semoga panen jamurnya melimpah!"
  );
}

void loop() {
  // 1. Simulasi Nilai Sensor Bergerak
  if (suhuNaik) {
    suhu += 0.5;
    if (suhu >= 32.0) suhuNaik = false;
  } else {
    suhu -= 0.5;
    if (suhu <= 24.0) suhuNaik = true;
  }

  if (lembabTurun) {
    lembab -= 1.0;
    if (lembab <= 60.0) lembabTurun = false;
  } else {
    lembab += 1.0;
    if (lembab >= 95.0) lembabTurun = true;
  }

  // 2. Update Statistik Min/Max
  if (suhu < suhuMin)    suhuMin  = suhu;
  if (suhu > suhuMax)    suhuMax  = suhu;
  if (lembab < lembabMin) lembabMin = lembab;
  if (lembab > lembabMax) lembabMax = lembab;

  // 3. Tampilkan di LCD
  lcd.setCursor(0, 0);
  lcd.print("Suhu: "); lcd.print(suhu, 1); lcd.print(" C  ");
  lcd.setCursor(0, 1);
  lcd.print("Lembab: "); lcd.print(lembab, 1); lcd.print(" %  ");

  // 4. Logika Kontrol Mesin (Hysteresis)
  bool oldFan = fanStatus;
  if (suhu > 30.0) {
    digitalWrite(FAN_PIN, HIGH);
    fanStatus = true;
  } else if (suhu < 28.0) {
    digitalWrite(FAN_PIN, LOW);
    fanStatus = false;
  }

  bool oldPump = pumpStatus;
  if (lembab < 70.0) {
    digitalWrite(PUMP_PIN, HIGH);
    pumpStatus = true;
  } else if (lembab > 85.0) {
    digitalWrite(PUMP_PIN, LOW);
    pumpStatus = false;
  }

  String jamSekarang = dapatkanJam();

  // 5. Notifikasi Perubahan Status Mesin
  if (fanStatus != oldFan) {
    if (fanStatus) jumlahAktifKipas++; // Hitung berapa kali kipas nyala
    String state = fanStatus ? "MENYALA ❄️" : "MATI 🔴";
    sendTelegramMessage(
      "🔔 *STATUS KIPAS BERUBAH*\n"
      "━━━━━━━━━━━━━━━━━\n"
      "🕒 Jam: " + jamSekarang + "\n"
      "💨 Kipas Ventilasi: *" + state + "*\n"
      "🌡 Suhu pemicu: " + String(suhu, 1) + " °C\n"
      "📊 Total aktif hari ini: " + String(jumlahAktifKipas) + "x"
    );
  }

  if (pumpStatus != oldPump) {
    if (pumpStatus) jumlahAktifPompa++; // Hitung berapa kali pompa nyala
    String state = pumpStatus ? "MENYALA 💦" : "MATI 🔴";
    sendTelegramMessage(
      "🔔 *STATUS POMPA BERUBAH*\n"
      "━━━━━━━━━━━━━━━━━\n"
      "🕒 Jam: " + jamSekarang + "\n"
      "🚿 Pompa Penyemprot: *" + state + "*\n"
      "💧 Kelembaban pemicu: " + String(lembab, 1) + " %\n"
      "📊 Total aktif hari ini: " + String(jumlahAktifPompa) + "x"
    );
  }

  // 6. Alarm Kondisi Kritis (dengan cooldown agar tidak spam)
  unsigned long now = millis();

  if (suhu > 35.0 && (now - waktuAlarmSuhuTerakhir > cooldownAlarm)) {
    waktuAlarmSuhuTerakhir = now;
    sendTelegramMessage(
      "🚨 *BAHAYA! SUHU KRITIS!*\n"
      "━━━━━━━━━━━━━━━━━\n"
      "🕒 Jam: " + jamSekarang + "\n"
      "🌡 Suhu: *" + String(suhu, 1) + " °C* (batas: 35°C)\n"
      "⚠️ Segera periksa sistem ventilasi!\n"
      "📍 Alarm berikutnya dalam 2 menit."
    );
  }

  if (lembab < 55.0 && (now - waktuAlarmLembabTerakhir > cooldownAlarm)) {
    waktuAlarmLembabTerakhir = now;
    sendTelegramMessage(
      "🚨 *BAHAYA! KELEMBABAN KRITIS!*\n"
      "━━━━━━━━━━━━━━━━━\n"
      "🕒 Jam: " + jamSekarang + "\n"
      "💧 Kelembaban: *" + String(lembab, 1) + " %* (batas: 55%)\n"
      "⚠️ Segera periksa sistem pompa!\n"
      "📍 Alarm berikutnya dalam 2 menit."
    );
  }

  // 7. Laporan Rutin ke Telegram & ThingSpeak
  if (millis() - waktuLaporTerakhir >= intervalLapor) {
    waktuLaporTerakhir = millis();

    String pesanRutin =
      "📊 *LAPORAN RUTIN SISTEM*\n"
      "━━━━━━━━━━━━━━━━━\n"
      "🕒 Jam: " + jamSekarang + "\n"
      "⏱ Uptime: " + dapatkanUptime() + "\n"
      "━━━━━━━━━━━━━━━━━\n"
      "🌡 Suhu: " + String(suhu, 1) + " °C\n"
      "   ↳ Min: " + String(suhuMin, 1) + " | Max: " + String(suhuMax, 1) + "\n"
      "💧 Lembab: " + String(lembab, 1) + " %\n"
      "   ↳ Min: " + String(lembabMin, 1) + " | Max: " + String(lembabMax, 1) + "\n"
      "━━━━━━━━━━━━━━━━━\n"
      "⚙️ Kipas: " + (fanStatus ? "ON ❄️" : "OFF") +
      " | Pompa: " + (pumpStatus ? "ON 💦" : "OFF") + "\n"
      "📈 Kipas aktif: " + String(jumlahAktifKipas) + "x"
      " | Pompa aktif: " + String(jumlahAktifPompa) + "x\n"
      "🍄 _Sistem berjalan normal_";

    sendTelegramMessage(pesanRutin);
    sendToThingSpeak();
  }

  delay(1000);
}

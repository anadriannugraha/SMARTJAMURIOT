# SMARTJAMURIOT - IoT Mushroom Temperature Control System

Selamat datang di repositori **SMARTJAMURIOT**! Proyek ini adalah sistem kendali suhu dan kelembapan berbasis *Internet of Things* (IoT) yang dirancang khusus untuk budidaya jamur. Menggunakan mikrokontroler (seperti ESP32/ESP8266) dan web dashboard untuk pemantauan secara real-time.

## 🚀 Fitur Utama
- **Pemantauan Real-time**: Memantau suhu dan kelembapan secara langsung melalui web dashboard.
- **Kendali Otomatis**: Sistem dapat menyalakan kipas/pendingin atau pemanas secara otomatis berdasarkan batas suhu yang telah ditentukan.
- **Web Dashboard Terintegrasi**: Antarmuka web yang responsif (HTML, CSS, JS) untuk memudahkan visualisasi data.

## 📁 Struktur Direktori
- `index.html` : Halaman utama dashboard pemantauan.
- `laporan.html`, `laporan.css`, `laporan.js` : Halaman dan logika untuk menampilkan riwayat/laporan data.
- `style.css` & `script.js` : Tampilan visual dan logika interaktif untuk dashboard utama.
- `sketch.ino` : Kode sumber (firmware) Arduino untuk mikrokontroler IoT.
- `wokwi.toml` & `diagram.json` : File konfigurasi untuk simulasi di Wokwi.
- `.gitignore` : Konfigurasi untuk mengabaikan file yang tidak perlu diunggah.

## 🛠️ Persyaratan (Prerequisites)
- **Arduino IDE** (atau PlatformIO) untuk mem-flash `sketch.ino`.
- **Library Arduino**: Pastikan Anda telah menginstal pustaka yang dibutuhkan (tercantum di `libraries.txt` atau di dalam kode `sketch.ino`).
- **Koneksi Internet (Wi-Fi)** untuk mikrokontroler agar dapat mengirim data ke dashboard/broker.

## 💻 Cara Menggunakan
1. **Kloning Repositori:**
   ```bash
   git clone https://github.com/anadriannugraha/SMARTJAMURIOT.git
   ```
2. **Setup Mikrokontroler:**
   - Buka file `sketch.ino` di Arduino IDE.
   - Sesuaikan konfigurasi Wi-Fi (SSID & Password) dan URL/IP server broker IoT Anda.
   - *Upload* kode ke mikrokontroler.
3. **Menjalankan Web Dashboard:**
   - Cukup buka file `index.html` menggunakan browser modern (Chrome, Firefox, Edge, dll).
   - Pastikan dashboard terhubung ke layanan *backend* atau *broker MQTT/WebSocket* yang sama dengan mikrokontroler Anda.

## 🖥️ Simulasi dengan Wokwi
Repositori ini sudah dilengkapi dengan file konfigurasi (`wokwi.toml` dan `diagram.json`) sehingga Anda dapat langsung mensimulasikan alat ini tanpa perlu hardware sungguhan.

**Opsi 1: Import Otomatis (Sangat Mudah)**
1. Buka situs [Wokwi](https://wokwi.com/).
2. Buat proyek ESP32 baru, lalu cari menu *Import from GitHub*.
3. Masukkan URL repositori ini: `https://github.com/anadriannugraha/SMARTJAMURIOT`
4. Wokwi otomatis akan memuat file `diagram.json` dan `sketch.ino`.

**Opsi 2: Salin Manual (Jika gagal otomatis)**
1. Buka [Wokwi ESP32 Simulator](https://wokwi.com/projects/new/esp32).
2. Salin isi file `sketch.ino` dari repositori ini, dan tempelkan (paste) ke jendela `sketch.ino` di Wokwi.
3. Di Wokwi, buka tab `diagram.json`, hapus semua isinya, lalu salin isi file `diagram.json` dari repositori ini ke sana.
4. Buat tab baru (atau buka `Library Manager` di Wokwi) dan pastikan Anda menambahkan library **PubSubClient** agar tidak terjadi error kompilasi.

**🔌 Panduan Susunan Kabel (Wiring):**
Bila Anda merangkai ulang kabel atau membuatnya di dunia nyata, berikut adalah susunannya berdasarkan kode yang ada:
- **Pin 2 (ESP32)** ➡️ dihubungkan ke **LED Merah** (berfungsi sebagai indikator Pompa / Humidifier), kaki satunya ke Ground (GND).
- **Pin 4 (ESP32)** ➡️ dihubungkan ke **LED Biru** (berfungsi sebagai indikator Kipas), kaki satunya ke Ground (GND).
*(Catatan: Suhu dan kelembapan dalam kode ini disimulasikan secara otomatis menggunakan rumus, jadi Anda tidak perlu menambahkan sensor fisik seperti DHT pada simulasi Wokwi).*

**Langkah Terakhir Simulasi:**
- Pastikan pengaturan Wi-Fi pada simulasi menggunakan SSID `"Wokwi-GUEST"` tanpa *password* agar modul dapat terhubung ke internet.
- Klik tombol **Play (Start Simulation)**. Mikrokontroler akan menyala dan langsung mengirim/menerima data dari web dashboard Anda!

## 🤝 Kontribusi
Jika Anda ingin mengembangkan sistem ini, silakan lakukan *Fork* pada repositori ini dan ajukan *Pull Request*. Saran dan masukan Anda sangat berarti!

---
*Dibuat untuk memudahkan otomatisasi dan pemantauan dalam budidaya jamur.*

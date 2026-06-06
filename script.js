// Pengaturan Global
let faseSaatIni = 'inkubasi';
let modeOtomatis = true;

// --- KONFIGURASI THRESHOLD ---
const defaultInkubasi = {
    s_min: 22, s_max: 26, s_warn: 28, s_bahaya: 32,
    l_kering: 60, l_min: 60, l_max: 70, l_basah: 95
};
const defaultPanen = {
    s_min: 22, s_max: 26, s_warn: 28, s_bahaya: 32,
    l_kering: 85, l_min: 85, l_max: 90, l_basah: 95
};

let configAktif = { ...defaultInkubasi }; // Salin default inkubasi ke config saat ini

// Memuat data dari LocalStorage jika ada
function muatPengaturan() {
    const data = localStorage.getItem('jamurConfig_' + faseSaatIni);
    if (data) {
        configAktif = JSON.parse(data);
    } else {
        configAktif = faseSaatIni === 'inkubasi' ? { ...defaultInkubasi } : { ...defaultPanen };
    }
    updateTampilanModal();
}

function simpanPengaturan() {
    localStorage.setItem('jamurConfig_' + faseSaatIni, JSON.stringify(configAktif));
    tutupModal();
    // Panggil trigger perbarui tampilan dengan data terakhir (jika ada dataSuhu)
    if(dataSuhu.length > 0) {
        const dataTerakhir = { suhu: dataSuhu[dataSuhu.length-1], kelembaban: dataLembab[dataLembab.length-1], kipas: kipasMenyala, humidifier: pompaMenyala };
        perbaruiTampilan(dataTerakhir);
    }
}

function resetPengaturan() {
    localStorage.removeItem('jamurConfig_' + faseSaatIni);
    muatPengaturan();
    // Update preview juga
    document.getElementById('prev-s-warn').textContent = configAktif.s_warn;
    document.getElementById('prev-l-kering').textContent = configAktif.l_kering;
}

// Data untuk Min/Max Hari Ini
let minSuhu = 999, maxSuhu = -999;
let minLembab = 999, maxLembab = -999;

// Elemen Tampilan Utama
const connText = document.getElementById('conn-text');
const bannerError = document.getElementById('banner-error');

const toggleMode = document.getElementById('toggle-mode');
const labelManual = document.getElementById('label-manual');
const labelOtomatis = document.getElementById('label-otomatis');
const deskripsiMode = document.getElementById('deskripsi-mode');

const tempVal = document.getElementById('temp-val');
const tempStatus = document.getElementById('temp-status');
const humVal = document.getElementById('hum-val');
const humStatus = document.getElementById('hum-status');

const kartuUtama = document.getElementById('kartu-utama');
const iconUtama = document.getElementById('icon-utama');
const kesimpulanUtama = document.getElementById('kesimpulan-utama');

const kartuSaran = document.getElementById('kartu-saran');
const teksSaran = document.getElementById('teks-saran');

const btnKipas = document.getElementById('btn-kipas');
const btnPompa = document.getElementById('btn-pompa');
const statusKipasTeks = document.getElementById('status-kipas-teks');
const statusPompaTeks = document.getElementById('status-pompa-teks');
const ikonKipas = btnKipas.parentElement.querySelector('.ikon-mesin');
const ikonPompa = btnPompa.parentElement.querySelector('.ikon-mesin');

const badgeSuhu = document.getElementById('minmax-suhu');
const badgeLembab = document.getElementById('minmax-lembab');

// Elemen Modal
const modal = document.getElementById('modal-pengaturan');
const btnBukaModal = document.getElementById('btn-pengaturan');
const btnTutupModalAtas = document.getElementById('btn-tutup-modal-atas');
const btnTutupModalBawah = document.getElementById('btn-tutup-modal');
const btnSimpanModal = document.getElementById('btn-simpan-pengaturan');
const btnResetModal = document.getElementById('btn-reset-pengaturan');

// Data & Grafik
const maksTitikGrafik = 120;
let labelWaktu = [];
let dataSuhu = [];
let dataLembab = [];
let grafikJamur, gaugeSuhu, gaugeLembab;

// State Alat Saat Ini
let kipasMenyala = false;
let pompaMenyala = false;

// MQTT
const mqttBroker = 'wss://broker.emqx.io:8084/mqtt';
const topicData = 'jamur/tiram/data/petani123';
const topicKontrol = 'jamur/tiram/kontrol/petani123';
let mqttClient = null;

// ==========================================
// INISIALISASI GRAFIK
// ==========================================
function inisialisasiGrafik() {
    const opsiGauge = {
        rotation: -90, circumference: 180, cutout: '75%',
        responsive: true, maintainAspectRatio: false,
        plugins: { tooltip: { enabled: false } },
        animation: { animateRotate: true, animateScale: false }
    };

    gaugeSuhu = new Chart(document.getElementById('gaugeSuhu').getContext('2d'), {
        type: 'doughnut',
        data: { datasets: [{ data: [0, 50], backgroundColor: ['#bdc3c7', '#ecf0f1'], borderWidth: 0 }] },
        options: opsiGauge
    });

    gaugeLembab = new Chart(document.getElementById('gaugeLembab').getContext('2d'), {
        type: 'doughnut',
        data: { datasets: [{ data: [0, 100], backgroundColor: ['#bdc3c7', '#ecf0f1'], borderWidth: 0 }] },
        options: opsiGauge
    });

    grafikJamur = new Chart(document.getElementById('grafik-jamur').getContext('2d'), {
        type: 'line',
        data: {
            labels: labelWaktu,
            datasets: [
                {
                    label: 'Suhu (°C)', data: dataSuhu,
                    borderColor: '#e74c3c', backgroundColor: 'rgba(231, 76, 60, 0.2)',
                    borderWidth: 3, fill: true, tension: 0.4, pointRadius: 0
                },
                {
                    label: 'Lembab (%)', data: dataLembab,
                    borderColor: '#2980b9', backgroundColor: 'rgba(41, 128, 185, 0.2)',
                    borderWidth: 3, fill: true, tension: 0.4, pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false, animation: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } },
                y: { grid: { color: '#ecf0f1' } }
            }
        }
    });
}

// ==========================================
// LOGIKA TAMPILAN & KENDALI
// ==========================================
function perbaruiTampilan(data) {
    if(!data) return;
    
    // 1. Min/Max Hari ini
    if(data.suhu < minSuhu) minSuhu = data.suhu;
    if(data.suhu > maxSuhu) maxSuhu = data.suhu;
    if(data.kelembaban < minLembab) minLembab = data.kelembaban;
    if(data.kelembaban > maxLembab) maxLembab = data.kelembaban;
    badgeSuhu.textContent = `Suhu: ${minSuhu.toFixed(1)} - ${maxSuhu.toFixed(1)}°C`;
    badgeLembab.textContent = `Lembab: ${minLembab.toFixed(1)} - ${maxLembab.toFixed(1)}%`;

    // 2. Evaluasi Suhu dengan Config Aktif
    tempVal.textContent = data.suhu.toFixed(1);
    let warnaSuhu = '', teksSuhu = '', statusSuhu = 'aman';
    
    if (data.suhu < configAktif.s_min) { warnaSuhu = '#2980b9'; teksSuhu = 'Dingin!'; statusSuhu = 'aman'; }
    else if (data.suhu <= configAktif.s_max) { warnaSuhu = '#27ae60'; teksSuhu = 'Pas!'; }
    else if (data.suhu < configAktif.s_bahaya) { warnaSuhu = '#f39c12'; teksSuhu = 'Mulai Panas!'; statusSuhu = 'perhatian'; }
    else { warnaSuhu = '#e74c3c'; teksSuhu = 'Sangat Panas!'; statusSuhu = 'bahaya'; }
    
    tempStatus.textContent = teksSuhu;
    tempStatus.style.color = warnaSuhu;
    gaugeSuhu.data.datasets[0].data = [data.suhu, 50 - data.suhu];
    gaugeSuhu.data.datasets[0].backgroundColor[0] = warnaSuhu;
    gaugeSuhu.update();

    // 3. Evaluasi Kelembaban
    humVal.textContent = data.kelembaban.toFixed(1);
    let warnaLembab = '', teksLembab = '', statusLembab = 'aman';

    if (data.kelembaban < configAktif.l_min) { warnaLembab = '#e74c3c'; teksLembab = 'Kering!'; statusLembab = 'bahaya'; }
    else if (data.kelembaban <= configAktif.l_max) { warnaLembab = '#27ae60'; teksLembab = 'Pas!'; }
    else if (data.kelembaban > configAktif.l_basah) { warnaLembab = '#f39c12'; teksLembab = 'Basah!'; statusLembab = 'perhatian'; }
    else { warnaLembab = '#27ae60'; teksLembab = 'Aman'; }

    humStatus.textContent = teksLembab;
    humStatus.style.color = warnaLembab;
    gaugeLembab.data.datasets[0].data = [data.kelembaban, 100 - data.kelembaban];
    gaugeLembab.data.datasets[0].backgroundColor[0] = warnaLembab;
    gaugeLembab.update();

    // 4. Kesimpulan Utama
    kartuUtama.className = 'kartu kartu-utama';
    if (statusSuhu === 'bahaya' && statusLembab === 'bahaya') {
        kartuUtama.classList.add('merah'); iconUtama.textContent = '🔴';
        kesimpulanUtama.textContent = 'BAHAYA! Panas & Kering!';
    } else if (statusSuhu === 'bahaya') {
        kartuUtama.classList.add('merah'); iconUtama.textContent = '🔥';
        kesimpulanUtama.textContent = 'BAHAYA! Suhu Terlalu Tinggi!';
    } else if (statusLembab === 'bahaya') {
        kartuUtama.classList.add('merah'); iconUtama.textContent = '🏜️';
        kesimpulanUtama.textContent = 'Kumbung Sangat Kering!';
    } else if (statusSuhu === 'perhatian' || statusLembab === 'perhatian') {
        kartuUtama.classList.add('kuning'); iconUtama.textContent = '⚠️';
        kesimpulanUtama.textContent = 'Perhatian! Kondisi Kurang Ideal';
    } else {
        kartuUtama.classList.add('hijau'); iconUtama.textContent = '✅';
        kesimpulanUtama.textContent = 'Kondisi Kumbung Bagus';
    }

    // 5. Kendali Otomatis (Menggunakan Config Baru)
    let mintaKipas = data.kipas;
    let mintaPompa = data.humidifier;

    if (modeOtomatis) {
        let butuhKipas = data.suhu >= configAktif.s_warn;
        let butuhPompa = data.kelembaban <= configAktif.l_kering;

        if (butuhKipas !== mintaKipas || butuhPompa !== mintaPompa) {
            kirimPerintahMQTT(butuhKipas ? 1 : 0, butuhPompa ? 1 : 0);
            mintaKipas = butuhKipas;
            mintaPompa = butuhPompa;
        }
    }

    kipasMenyala = mintaKipas;
    pompaMenyala = mintaPompa;

    if (kipasMenyala) {
        btnKipas.className = 'btn-mesin aktif'; btnKipas.textContent = modeOtomatis ? 'Menyala (Auto)' : 'Matikan Kipas';
        statusKipasTeks.textContent = 'Sedang Menyala'; statusKipasTeks.style.color = 'var(--hijau)';
        ikonKipas.classList.add('spin');
    } else {
        btnKipas.className = 'btn-mesin mati'; btnKipas.textContent = modeOtomatis ? 'Mati (Auto)' : 'Nyalakan Kipas';
        statusKipasTeks.textContent = 'Mati'; statusKipasTeks.style.color = 'var(--abu)';
        ikonKipas.classList.remove('spin');
    }

    if (pompaMenyala) {
        btnPompa.className = 'btn-mesin aktif'; btnPompa.textContent = modeOtomatis ? 'Menyala (Auto)' : 'Stop Semprot';
        statusPompaTeks.textContent = 'Sedang Menyala'; statusPompaTeks.style.color = 'var(--hijau)';
        ikonPompa.classList.add('jiggle');
    } else {
        btnPompa.className = 'btn-mesin mati'; btnPompa.textContent = modeOtomatis ? 'Mati (Auto)' : 'Semprot Air';
        statusPompaTeks.textContent = 'Mati'; statusPompaTeks.style.color = 'var(--abu)';
        ikonPompa.classList.remove('jiggle');
    }

    // 7. Saran Tindakan
    kartuSaran.className = 'kartu saran-tindakan';
    let saran = [];
    
    if (statusSuhu === 'bahaya' || statusLembab === 'bahaya') {
        kartuSaran.classList.add('bahaya');
        if (statusSuhu === 'bahaya') saran.push(modeOtomatis ? "Suhu kritis! Kipas bekerja maksimal." : "Suhu sangat panas! Segera nyalakan Kipas!");
        if (statusLembab === 'bahaya') saran.push(modeOtomatis ? "Kering! Semprotan bekerja maksimal." : "Kelembaban kering! Segera nyalakan Pompa Air!");
    } else if (statusSuhu === 'perhatian' || statusLembab === 'perhatian') {
        kartuSaran.classList.add('perhatian');
        if (statusSuhu === 'perhatian') saran.push("Suhu mulai hangat, awasi terus.");
        if (statusLembab === 'perhatian') saran.push("Kumbung agak basah, buka sedikit ventilasi.");
    } else {
        kartuSaran.classList.add('aman');
        if (kipasMenyala || pompaMenyala) {
            saran.push("Kondisi baik, mesin sedang menstabilkan ruangan.");
        } else {
            saran.push("Jamur tumbuh dengan optimal. Tidak perlu tindakan.");
        }
    }
    teksSaran.innerHTML = saran.join('<br>');

    // 8. Update Grafik (Hindari duplikasi titik jika tidak ada perubahan waktu, tapi untuk demo kita abaikan)
    const waktuSekarang = new Date().toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
    labelWaktu.push(waktuSekarang);
    dataSuhu.push(data.suhu);
    dataLembab.push(data.kelembaban);
    if (labelWaktu.length > maksTitikGrafik) {
        labelWaktu.shift(); dataSuhu.shift(); dataLembab.shift();
    }
    grafikJamur.update();
}

// ==========================================
// MODAL PENGATURAN LOGIKA
// ==========================================
function bukaModal() {
    modal.classList.remove('tersembunyi');
    updateTampilanModal();
}
function tutupModal() {
    modal.classList.add('tersembunyi');
}

btnBukaModal.addEventListener('click', bukaModal);
btnTutupModalAtas.addEventListener('click', tutupModal);
btnTutupModalBawah.addEventListener('click', tutupModal);
btnSimpanModal.addEventListener('click', simpanPengaturan);
btnResetModal.addEventListener('click', resetPengaturan);

// Fungsi Validasi & Update Nilai dari tombol + / -
window.ubahNilai = function(kunci, arah) {
    let kunciMapping = {
        's-min': 's_min', 's-max': 's_max', 's-warn': 's_warn', 's-bahaya': 's_bahaya',
        'l-kering': 'l_kering', 'l-min': 'l_min', 'l-max': 'l_max', 'l-basah': 'l_basah'
    };
    
    let properti = kunciMapping[kunci];
    let nilaiSekarang = configAktif[properti];
    let nilaiBaru = nilaiSekarang + arah;

    // --- LOGIKA VALIDASI ANTI-TEMBUS ---
    if(properti === 's_min' && nilaiBaru > configAktif.s_max) return;
    if(properti === 's_max' && (nilaiBaru < configAktif.s_min || nilaiBaru > configAktif.s_warn)) return;
    if(properti === 's_warn' && (nilaiBaru < configAktif.s_max || nilaiBaru > configAktif.s_bahaya)) return;
    if(properti === 's_bahaya' && nilaiBaru < configAktif.s_warn) return;

    if(properti === 'l_min' && nilaiBaru > configAktif.l_max) return;
    if(properti === 'l_max' && (nilaiBaru < configAktif.l_min || nilaiBaru > configAktif.l_basah)) return;
    if(properti === 'l_basah' && nilaiBaru < configAktif.l_max) return;

    configAktif[properti] = nilaiBaru;
    document.getElementById(`val-${kunci}`).textContent = nilaiBaru;

    if(properti === 's_warn') document.getElementById('prev-s-warn').textContent = nilaiBaru;
    if(properti === 'l_kering') document.getElementById('prev-l-kering').textContent = nilaiBaru;
};

function updateTampilanModal() {
    document.getElementById('val-s-min').textContent = configAktif.s_min;
    document.getElementById('val-s-max').textContent = configAktif.s_max;
    document.getElementById('val-s-warn').textContent = configAktif.s_warn;
    document.getElementById('val-s-bahaya').textContent = configAktif.s_bahaya;
    document.getElementById('val-l-kering').textContent = configAktif.l_kering;
    document.getElementById('val-l-min').textContent = configAktif.l_min;
    document.getElementById('val-l-max').textContent = configAktif.l_max;
    document.getElementById('val-l-basah').textContent = configAktif.l_basah;
    
    document.getElementById('prev-s-warn').textContent = configAktif.s_warn;
    document.getElementById('prev-l-kering').textContent = configAktif.l_kering;
}

// ==========================================
// MQTT & EVENT LISTENER
// ==========================================
function hubungkanMQTT() {
    bannerError.classList.add('tersembunyi');
    connText.textContent = 'Menghubungkan ke Server...';
    connText.className = 'status-koneksi offline';

    mqttClient = mqtt.connect(mqttBroker, {
        clientId: 'JamurPetani_' + Math.random().toString(16).substr(2, 8),
        clean: true, connectTimeout: 5000, reconnectPeriod: 2000
    });

    mqttClient.on('connect', () => {
        bannerError.classList.add('tersembunyi');
        connText.textContent = 'Sensor Terhubung';
        connText.className = 'status-koneksi online';
        mqttClient.subscribe(topicData);
        aturTombolAkses(); 
    });

    mqttClient.on('message', (topic, message) => {
        if (topic === topicData) {
            try { perbaruiTampilan(JSON.parse(message.toString())); } 
            catch (e) { console.error(e); }
        }
    });

    mqttClient.on('offline', () => {
        bannerError.classList.remove('tersembunyi');
        connText.textContent = 'Koneksi Terputus';
        connText.className = 'status-koneksi offline';
        btnKipas.disabled = true; btnPompa.disabled = true;
    });
}

function kirimPerintahMQTT(kipas, pompa) {
    if (mqttClient && mqttClient.connected) {
        mqttClient.publish(topicKontrol, `kipas=${kipas}&humidifier=${pompa}`);
    }
}

function aturTombolAkses() {
    if (modeOtomatis) {
        btnKipas.disabled = true;
        btnPompa.disabled = true;
    } else {
        btnKipas.disabled = !mqttClient || !mqttClient.connected;
        btnPompa.disabled = !mqttClient || !mqttClient.connected;
    }
}

// Event Toggle Mode
toggleMode.addEventListener('change', (e) => {
    modeOtomatis = e.target.checked;
    if (modeOtomatis) {
        labelOtomatis.classList.add('aktif-teks');
        labelManual.classList.remove('aktif-teks');
        deskripsiMode.textContent = "Dikendalikan Otomatis oleh sistem cerdas.";
    } else {
        labelManual.classList.add('aktif-teks');
        labelOtomatis.classList.remove('aktif-teks');
        deskripsiMode.textContent = "Mode Manual. Anda pegang kendali penuh.";
    }
    aturTombolAkses();
    btnKipas.textContent = modeOtomatis ? (kipasMenyala ? 'Menyala (Auto)' : 'Mati (Auto)') : (kipasMenyala ? 'Matikan Kipas' : 'Nyalakan Kipas');
    btnPompa.textContent = modeOtomatis ? (pompaMenyala ? 'Menyala (Auto)' : 'Mati (Auto)') : (pompaMenyala ? 'Stop Semprot' : 'Semprot Air');
});

// Event Fase
document.getElementById('btn-inkubasi').addEventListener('click', (e) => {
    if(faseSaatIni === 'inkubasi') return;
    faseSaatIni = 'inkubasi';
    e.target.classList.add('aktif');
    document.getElementById('btn-tubuh-buah').classList.remove('aktif');
    muatPengaturan(); // Muat ulang threshold khusus fase ini
});
document.getElementById('btn-tubuh-buah').addEventListener('click', (e) => {
    if(faseSaatIni === 'tubuh-buah') return;
    faseSaatIni = 'tubuh-buah';
    e.target.classList.add('aktif');
    document.getElementById('btn-inkubasi').classList.remove('aktif');
    muatPengaturan(); // Muat ulang threshold khusus fase ini
});

// Event Kontrol Manual
btnKipas.addEventListener('click', () => {
    if (modeOtomatis) return;
    const nyalakan = !kipasMenyala;
    kirimPerintahMQTT(nyalakan ? 1 : 0, pompaMenyala ? 1 : 0);
});

btnPompa.addEventListener('click', () => {
    if (modeOtomatis) return;
    const nyalakan = !pompaMenyala;
    kirimPerintahMQTT(kipasMenyala ? 1 : 0, nyalakan ? 1 : 0);
});

// ==========================================
// DATA LOGGER — Rekam Data Setiap 1 Menit
// ==========================================
const KUNCI_DATA_LOG = 'jamurDataLog';
const MAKS_HARI_LOG = 7;
let menitTerakhirDirekam = -1;
let dataTermutakhir = null; // Menyimpan data terakhir dari MQTT

function hitungStatusLog(suhu, lembab) {
    if (suhu >= configAktif.s_bahaya || lembab < configAktif.l_kering) return 'bahaya';
    if (suhu >= configAktif.s_warn || lembab > configAktif.l_basah) return 'warning';
    return 'optimal';
}

function rekamDataPerMenit() {
    if (!dataTermutakhir) return;

    const sekarang = new Date();
    const menitSekarang = sekarang.getMinutes();

    // Hanya rekam jika menit berubah (1x per menit)
    if (menitSekarang === menitTerakhirDirekam) return;
    menitTerakhirDirekam = menitSekarang;

    const kunciHari = sekarang.toISOString().split('T')[0];
    const waktuStr = sekarang.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const status = hitungStatusLog(dataTermutakhir.suhu, dataTermutakhir.kelembaban);

    let ewsTeks = '';
    if (status === 'bahaya') {
        if (dataTermutakhir.suhu >= configAktif.s_bahaya) ewsTeks = 'Suhu kritis';
        if (dataTermutakhir.kelembaban < configAktif.l_kering) ewsTeks += (ewsTeks ? ' + ' : '') + 'Kering kritis';
    } else if (status === 'warning') {
        if (dataTermutakhir.suhu >= configAktif.s_warn) ewsTeks = 'Suhu naik';
        if (dataTermutakhir.kelembaban > configAktif.l_basah) ewsTeks += (ewsTeks ? ' + ' : '') + 'Terlalu basah';
    }

    const entri = {
        waktu: waktuStr,
        suhu: dataTermutakhir.suhu,
        lembab: dataTermutakhir.kelembaban,
        kipas: dataTermutakhir.kipas || kipasMenyala,
        pompa: dataTermutakhir.humidifier || pompaMenyala,
        status: status,
        ews: ewsTeks || null
    };

    // Baca log yang sudah ada
    let semuaLog = {};
    try {
        const raw = localStorage.getItem(KUNCI_DATA_LOG);
        if (raw) semuaLog = JSON.parse(raw);
    } catch (e) { semuaLog = {}; }

    // Tambahkan entri hari ini
    if (!semuaLog[kunciHari]) semuaLog[kunciHari] = [];
    semuaLog[kunciHari].push(entri);

    // Bersihkan data lebih dari 7 hari
    const batasWaktu = new Date();
    batasWaktu.setDate(batasWaktu.getDate() - MAKS_HARI_LOG);
    Object.keys(semuaLog).forEach(tgl => {
        if (new Date(tgl) < batasWaktu) delete semuaLog[tgl];
    });

    // Simpan kembali
    localStorage.setItem(KUNCI_DATA_LOG, JSON.stringify(semuaLog));
    console.log(`📝 Data direkam: ${waktuStr} | ${entri.suhu}°C | ${entri.lembab}% | ${entri.status}`);
}

// Panggil perekaman setiap 5 detik (tapi hanya menyimpan saat menit berubah)
setInterval(rekamDataPerMenit, 5000);

// Simpan referensi data terakhir di fungsi perbaruiTampilan (patch)
const _perbaruiTampilanAsli = perbaruiTampilan;
perbaruiTampilan = function(data) {
    dataTermutakhir = data; // Simpan untuk data logger
    _perbaruiTampilanAsli(data);
};

// Mulai
muatPengaturan();
inisialisasiGrafik();
hubungkanMQTT();


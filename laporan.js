/* ========================================
   LAPORAN.JS - Mesin Data Logger & Render
   ======================================== */

const KUNCI_DATA = 'jamurDataLog';
const MAKS_HARI = 7;

// ==========================================
// UTILITAS TANGGAL & WAKTU
// ==========================================
function formatTanggalKunci(date) {
    return date.toISOString().split('T')[0]; // "2024-01-15"
}

function formatTanggalTampil(tglStr) {
    const [y, m, d] = tglStr.split('-');
    return `${d}/${m}/${y}`;
}

function hariIniKunci() {
    return formatTanggalKunci(new Date());
}

// ==========================================
// DATA LOGGER (Baca/Tulis localStorage)
// ==========================================
function muatSemuaLog() {
    const data = localStorage.getItem(KUNCI_DATA);
    return data ? JSON.parse(data) : {};
}

function simpanSemuaLog(log) {
    localStorage.setItem(KUNCI_DATA, JSON.stringify(log));
}

function bersihkanDataLama() {
    const log = muatSemuaLog();
    const sekarang = new Date();
    let ada_perubahan = false;
    Object.keys(log).forEach(tgl => {
        const selisihHari = (sekarang - new Date(tgl)) / (1000 * 60 * 60 * 24);
        if (selisihHari > MAKS_HARI) {
            delete log[tgl];
            ada_perubahan = true;
        }
    });
    if (ada_perubahan) simpanSemuaLog(log);
}

function hitungInfoStorage() {
    const log = muatSemuaLog();
    const hari = Object.keys(log).sort();
    if (hari.length === 0) return 'Belum ada data tersimpan.';
    const totalMenit = Object.values(log).reduce((a, b) => a + b.length, 0);
    return `Data tersimpan: ${hari.length} hari terakhir (${totalMenit} menit data). Otomatis hapus setelah ${MAKS_HARI} hari.`;
}

// ==========================================
// HITUNG STATUS KONDISI
// ==========================================
function hitungStatus(suhu, lembab) {
    if (suhu > 30 || lembab < 75) return 'bahaya';
    if (suhu > 28 || lembab < 82) return 'warning';
    return 'optimal';
}

function labelStatus(status) {
    if (status === 'bahaya') return '🔴 Bahaya';
    if (status === 'warning') return '⚠️ Warning';
    return '✅ Optimal';
}

// ==========================================
// RENDER RINGKASAN HARIAN
// ==========================================
function renderRingkasan(dataHarian) {
    if (!dataHarian || dataHarian.length === 0) {
        ['val-jam-optimal','val-jam-warning','val-jam-bahaya','val-suhu-maks',
         'val-suhu-min','val-lembab-maks','val-lembab-min','val-total-ews',
         'val-kipas-total','val-pompa-total'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '--';
        });
        return;
    }

    // Kelompokkan per jam untuk menghitung jam optimal/warning/bahaya
    const perJam = {};
    dataHarian.forEach(d => {
        const jam = d.waktu.split(':')[0];
        if (!perJam[jam]) perJam[jam] = [];
        perJam[jam].push(d);
    });

    let jamOptimal = 0, jamWarning = 0, jamBahaya = 0;
    Object.values(perJam).forEach(menit => {
        const statusCounts = { optimal: 0, warning: 0, bahaya: 0 };
        menit.forEach(m => statusCounts[m.status]++);
        if (statusCounts.bahaya > 0) jamBahaya++;
        else if (statusCounts.warning > 0) jamWarning++;
        else jamOptimal++;
    });

    const allSuhu = dataHarian.map(d => d.suhu);
    const allLembab = dataHarian.map(d => d.lembab);
    const suhuMaks = Math.max(...allSuhu);
    const suhuMin = Math.min(...allSuhu);
    const lembabMaks = Math.max(...allLembab);
    const lembabMin = Math.min(...allLembab);

    const waktuSuhuMaks = dataHarian.find(d => d.suhu === suhuMaks)?.waktu || '--';
    const waktuSuhuMin = dataHarian.find(d => d.suhu === suhuMin)?.waktu || '--';

    const totalEws = dataHarian.filter(d => d.status !== 'optimal').length;
    const totalKipas = dataHarian.filter(d => d.kipas).length;
    const totalPompa = dataHarian.filter(d => d.pompa).length;

    document.getElementById('val-jam-optimal').textContent = jamOptimal + ' jam';
    document.getElementById('val-jam-warning').textContent = jamWarning + ' jam';
    document.getElementById('val-jam-bahaya').textContent = jamBahaya + ' jam';
    document.getElementById('val-suhu-maks').textContent = suhuMaks.toFixed(1) + '°C';
    document.getElementById('sub-suhu-maks').textContent = 'pukul ' + waktuSuhuMaks;
    document.getElementById('val-suhu-min').textContent = suhuMin.toFixed(1) + '°C';
    document.getElementById('sub-suhu-min').textContent = 'pukul ' + waktuSuhuMin;
    document.getElementById('val-lembab-maks').textContent = lembabMaks.toFixed(1) + '%';
    document.getElementById('val-lembab-min').textContent = lembabMin.toFixed(1) + '%';
    document.getElementById('val-total-ews').textContent = totalEws + ' kali';
    document.getElementById('val-kipas-total').textContent = totalKipas + ' menit';
    document.getElementById('val-pompa-total').textContent = totalPompa + ' menit';

    // Warnai kartu ringkasan
    document.getElementById('rm-optimal').className = 'kartu-mini optimal';
    document.getElementById('rm-warning').className = 'kartu-mini warning';
    document.getElementById('rm-bahaya').className = 'kartu-mini bahaya';
}

// ==========================================
// RENDER GRAFIK HARIAN
// ==========================================
let grafikHarian = null;

function renderGrafikHarian(dataHarian) {
    const ctx = document.getElementById('grafik-harian').getContext('2d');

    // Ambil 1 titik tiap 5 menit agar grafik tidak terlalu padat
    const step = Math.ceil(dataHarian.length / 120);
    const filtered = dataHarian.filter((_, i) => i % step === 0);

    const labels = filtered.map(d => d.waktu);
    const dataSuhu = filtered.map(d => d.suhu);
    const dataLembab = filtered.map(d => d.lembab);

    // Tandai titik merah jika ada EWS
    const pointColorsSuhu = filtered.map(d => d.status === 'bahaya' ? '#e74c3c' : d.status === 'warning' ? '#f39c12' : 'transparent');
    const pointSizes = filtered.map(d => d.status !== 'optimal' ? 5 : 0);

    if (grafikHarian) {
        grafikHarian.destroy();
    }

    grafikHarian = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Suhu (°C)',
                    data: dataSuhu,
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231,76,60,0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: pointSizes,
                    pointBackgroundColor: pointColorsSuhu,
                    pointBorderColor: 'transparent'
                },
                {
                    label: 'Kelembaban (%)',
                    data: dataLembab,
                    borderColor: '#2980b9',
                    backgroundColor: 'rgba(41,128,185,0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: true },
                annotation: {}
            },
            scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } },
                y: {
                    grid: { color: '#f0f0f0' },
                    // Arsiran hijau area ideal (22-26 suhu) tidak bisa via annotation tanpa plugin
                    // Kita gunakan pendekatan ticks saja
                }
            }
        }
    });
}

// ==========================================
// RENDER DAFTAR LAPORAN PER JAM
// ==========================================
function renderLaporan(dataHarian, filterAktif) {
    const kontainer = document.getElementById('kontainer-laporan');

    if (!dataHarian || dataHarian.length === 0) {
        kontainer.innerHTML = `
            <div class="kosong-pesan">
                <div style="font-size:3rem;">📭</div>
                <h3>Belum Ada Data untuk Tanggal Ini</h3>
                <p>Data direkam otomatis setiap menit saat sensor terhubung.</p>
                <p style="margin-top:10px; font-size:0.9rem; color:var(--teks-sekunder);">
                    Buka <a href="index.html">Dashboard Utama</a> agar data mulai direkam.
                </p>
            </div>`;
        return;
    }

    // Kelompokkan data per jam
    const perJam = {};
    dataHarian.forEach(d => {
        const jam = d.waktu.split(':')[0];
        if (!perJam[jam]) perJam[jam] = [];
        perJam[jam].push(d);
    });

    let html = '';
    const jamUrut = Object.keys(perJam).sort();

    jamUrut.forEach(jam => {
        const menit = perJam[jam];
        const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

        const suhuArr = menit.map(d => d.suhu);
        const lembabArr = menit.map(d => d.lembab);

        const rataaSuhu = avg(suhuArr).toFixed(1);
        const minSuhu = Math.min(...suhuArr).toFixed(1);
        const maksSuhu = Math.max(...suhuArr).toFixed(1);

        const rataaLembab = avg(lembabArr).toFixed(1);
        const minLembab = Math.min(...lembabArr).toFixed(1);
        const maksLembab = Math.max(...lembabArr).toFixed(1);

        const statusCounts = { optimal: 0, warning: 0, bahaya: 0 };
        menit.forEach(m => statusCounts[m.status]++);
        const statusDominan = statusCounts.bahaya > 0 ? 'bahaya' : statusCounts.warning > 0 ? 'warning' : 'optimal';

        const ewsCount = menit.filter(m => m.status !== 'optimal').length;
        const kipasCount = menit.filter(m => m.kipas).length;
        const pompaCount = menit.filter(m => m.pompa).length;

        // Apply filter
        if (filterAktif !== 'semua' && statusDominan !== filterAktif) return;

        const labelJam = `${jam.padStart(2,'0')}:00 — ${String(parseInt(jam)+1).padStart(2,'0')}:00`;

        html += `
        <div class="blok-jam">
            <div class="blok-jam-header ${statusDominan}" onclick="toggleDetail('jam-${jam}', this)">
                <div class="baris-jam-atas">
                    <span class="label-waktu-jam">🕒 ${labelJam}</span>
                    <span class="badge-status-jam ${statusDominan}">${labelStatus(statusDominan)}</span>
                </div>
                <div class="grid-stat-jam">
                    <div class="stat-jam-item">🌡️ Suhu: <strong>rata² ${rataaSuhu}°C</strong> | min ${minSuhu} | maks ${maksSuhu}</div>
                    <div class="stat-jam-item">💧 Lembab: <strong>rata² ${rataaLembab}%</strong> | min ${minLembab} | maks ${maksLembab}</div>
                    <div class="stat-jam-item">🔔 Peringatan: <strong>${ewsCount} kali</strong></div>
                    <div class="stat-jam-item">💨 Kipas: <strong>${kipasCount} mnt</strong> | 💦 Pompa: <strong>${pompaCount} mnt</strong></div>
                </div>
                <div class="baris-jam-bawah">
                    <button class="btn-detail-jam">Lihat Detail ▼</button>
                </div>
            </div>
            <div class="detail-menit" id="jam-${jam}">
                <div class="table-responsive">
                    <table class="tabel-menit">
                        <thead>
                            <tr>
                                <th>Waktu</th>
                                <th>Suhu (°C)</th>
                                <th>Lembab (%)</th>
                                <th>Status</th>
                                <th>Kipas</th>
                                <th>Pompa</th>
                                <th>EWS</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${menit.map(d => `
                                <tr class="${d.status !== 'optimal' ? 'row-'+d.status : ''}">
                                    <td>${d.waktu}</td>
                                    <td>${d.suhu.toFixed(1)}</td>
                                    <td>${d.lembab.toFixed(1)}</td>
                                    <td><span class="badge-tabel ${d.status}">${labelStatus(d.status)}</span></td>
                                    <td>${d.kipas ? '✅ Nyala' : '⭕ Mati'}</td>
                                    <td>${d.pompa ? '✅ Nyala' : '⭕ Mati'}</td>
                                    <td>${d.ews || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;
    });

    if (!html) {
        kontainer.innerHTML = `
            <div class="kosong-pesan">
                <div style="font-size:2.5rem;">🔍</div>
                <h3>Tidak ada data untuk filter ini</h3>
                <p>Coba pilih filter "Semua".</p>
            </div>`;
    } else {
        kontainer.innerHTML = html;
    }
}

// ==========================================
// TOGGLE DETAIL (ACCORDION)
// ==========================================
function toggleDetail(id, headerEl) {
    const detail = document.getElementById(id);
    if (!detail) return;
    const terbuka = detail.classList.toggle('terbuka');
    const btn = headerEl.querySelector('.btn-detail-jam');
    if (btn) btn.textContent = terbuka ? 'Sembunyikan ▲' : 'Lihat Detail ▼';
}

// ==========================================
// EKSPOR CSV
// ==========================================
function eksporCSV(dataHarian, tanggal) {
    if (!dataHarian || dataHarian.length === 0) {
        alert('Tidak ada data untuk diekspor!');
        return;
    }

    const header = 'Waktu,Suhu (°C),Kelembaban (%),Status,Kipas,Humidifier,EWS';
    const baris = dataHarian.map(d =>
        `${tanggal} ${d.waktu},${d.suhu.toFixed(1)},${d.lembab.toFixed(1)},${d.status},${d.kipas ? 'Nyala' : 'Mati'},${d.pompa ? 'Nyala' : 'Mati'},${d.ews || '-'}`
    );

    const csvContent = [header, ...baris].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `laporan-jamur-${tanggal}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

// ==========================================
// INISIALISASI HALAMAN LAPORAN
// ==========================================
let tanggalAktif = hariIniKunci();
let filterAktif = 'semua';

function muatHalaman() {
    bersihkanDataLama();
    document.getElementById('teks-storage').textContent = hitungInfoStorage();

    const log = muatSemuaLog();
    const dataHarian = log[tanggalAktif] || [];

    // Update label tanggal
    const inputTgl = document.getElementById('input-tanggal');
    inputTgl.value = tanggalAktif;
    const isHariIni = tanggalAktif === hariIniKunci();
    document.getElementById('label-hari').textContent = isHariIni ? 'Hari Ini' : formatTanggalTampil(tanggalAktif);

    renderRingkasan(dataHarian);
    if (dataHarian.length > 0) {
        renderGrafikHarian(dataHarian);
    }
    renderLaporan(dataHarian, filterAktif);
}

// ==========================================
// EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    muatHalaman();

    // Navigasi tanggal
    document.getElementById('btn-kemarin').addEventListener('click', () => {
        const tgl = new Date(tanggalAktif);
        tgl.setDate(tgl.getDate() - 1);
        tanggalAktif = formatTanggalKunci(tgl);
        muatHalaman();
    });

    document.getElementById('btn-hariini').addEventListener('click', () => {
        tanggalAktif = hariIniKunci();
        muatHalaman();
    });

    document.getElementById('input-tanggal').addEventListener('change', (e) => {
        tanggalAktif = e.target.value;
        muatHalaman();
    });

    // Filter status
    document.querySelectorAll('.btn-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('aktif'));
            btn.classList.add('aktif');
            filterAktif = btn.dataset.filter;
            const log = muatSemuaLog();
            renderLaporan(log[tanggalAktif] || [], filterAktif);
        });
    });

    // Ekspor CSV
    document.getElementById('btn-unduh-csv').addEventListener('click', () => {
        const log = muatSemuaLog();
        eksporCSV(log[tanggalAktif] || [], tanggalAktif);
    });
});

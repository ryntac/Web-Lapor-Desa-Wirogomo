# Info Desa Wirogomo

Web super ringan untuk warga Desa Wirogomo, Kecamatan Banyubiru, Kabupaten Semarang. Dirancang untuk daerah dengan sinyal buruk: halaman kecil, tetap bisa dibuka tanpa internet setelah pernah dimuat, dan semua fitur penting bisa dipakai dari HP.

**Versi:** 1.0

## Fitur

- **Cuaca:** kondisi terkini dan prakiraan beberapa hari ke depan. Data diperbarui otomatis dua kali sehari.
- **Notifikasi cuaca:** peringatan cuaca buruk (hujan lebat, petir, angin kencang) dan ringkasan cuaca harian.
- **Kontak darurat:** 112, ambulans, pemadam kebakaran, polisi, Basarnas, BPBD, PLN, dan nomor desa. Satu ketuk untuk menelepon.
- **Lapor kejadian:** formulir singkat dengan pratinjau pesan, lokasi GPS opsional, lalu dikirim lewat WhatsApp atau SMS ke penerima yang dipilih.
- **Offline:** service worker menyimpan halaman dan data cuaca terakhir.

## Struktur berkas

```
.
├── index.html                  # halaman utama (semua tab, gaya, dan skrip)
├── sw.js                       # service worker: cache offline, notifikasi latar belakang
├── notif.js                    # logika notifikasi (dipakai halaman dan sw.js)
├── cuaca.json                  # data cuaca (dihasilkan otomatis, jangan diedit manual)
├── scripts/
│   └── ambil-cuaca.js          # mengambil data cuaca dan menulis cuaca.json
└── .github/workflows/
    └── cuaca.yml               # jadwal GitHub Actions yang menjalankan skrip di atas
```

Tidak ada langkah build dan tidak ada dependensi. Semua berkas bisa disajikan apa adanya oleh hosting statis.

## Konfigurasi

Pengaturan ada di bagian atas `<script>` di `index.html`:

| Nama               | Fungsi                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| `NAMA_DESA`        | Nama desa yang muncul di pesan laporan                                                              |
| `PENERIMA_WA.desa` | Nomor WhatsApp piket atau Kepala Desa, format `62...` tanpa `+`. Tombolnya tersembunyi sampai diisi |
| `PENERIMA_WA.bpbd` | Nomor WhatsApp BPBD                                                                                 |
| `NOMOR_SMS`        | Nomor tujuan SMS. Kosongkan untuk menyembunyikan tombol SMS                                         |
| `NOMOR_TELP`       | Nomor untuk tombol telepon darurat (112)                                                            |
| `ENDPOINT`         | URL penampung laporan (opsional, mengaktifkan antrean offline)                                      |
| `KONTAK`           | Daftar kontak di tab Kontak                                                                         |

Versi yang tampil di gelembung kiri bawah ditulis langsung di `index.html` (`Versi 1.0`). Ubah teksnya saat merilis versi baru.

Lokasi pengambilan data cuaca ada di `scripts/ambil-cuaca.js`: kode wilayah BMKG (`ADM4`) dan koordinat cadangan Open-Meteo (`LAT`, `LON`).

## Menjalankan di komputer

Pasang Node.js (LTS), lalu di folder proyek:

```
node scripts/ambil-cuaca.js
npx http-server -p 8000 -c-1
```

Buka `http://localhost:8000`. Service worker, notifikasi, dan GPS hanya berfungsi di `localhost` atau alamat HTTPS.

Untuk mencoba dari HP, gunakan alamat HTTPS sementara, misalnya fitur Ports di VS Code atau `cloudflared tunnel --url http://localhost:8000`. Alamat sementara itu terbuka untuk siapa saja yang memilikinya, jadi tutup setelah selesai.

## Memasang ke internet

Situs ini statis dan bisa dipasang di hosting statis gratis mana pun (GitHub Pages, Cloudflare Pages, Netlify). Syarat umum: sambungkan ke repo GitHub, kosongkan build command, dan arahkan folder publikasi ke akar repo. Alamat harus HTTPS agar notifikasi dan service worker berfungsi.

Catatan: setiap commit `cuaca.json` memicu deploy ulang. Dengan jadwal dua kali sehari, itu sekitar 60 deploy per bulan.

## Pembaruan cuaca otomatis

Workflow `.github/workflows/cuaca.yml` menjalankan `scripts/ambil-cuaca.js` pada pukul sekitar 05.07 dan 17.07 WIB, lalu meng-commit `cuaca.json` jika berubah. Ia juga berjalan saat `ambil-cuaca.js` atau `cuaca.yml` diubah, dan bisa dijalankan manual lewat **Actions > Perbarui cuaca > Run workflow**.

Urutan sumber data:

1. **BMKG** (utama).
2. **Open-Meteo** (cadangan kalau BMKG gagal diakses). Halaman menuliskan sumbernya dan menyebut bahwa ini model global, bukan BMKG.

Pengaturan repo yang dibutuhkan: **Settings > Actions > General > Workflow permissions > Read and write permissions**.

Hal yang perlu diketahui:

- Jadwal GitHub bisa tertunda dan tidak presisi.
- Di repo publik, GitHub menonaktifkan jadwal otomatis kalau 60 hari tidak ada aktivitas. Kalau data berhenti berubah, aktifkan lagi di tab Actions.
- Bot menambah commit di GitHub, jadi lakukan **Pull** sebelum mengedit berkas dari komputer.

## Notifikasi

- Tekan **Aktifkan notifikasi cuaca** di tab Cuaca dan izinkan.
- Notifikasi muncul saat web dibuka. Di Chrome/Edge Android dengan web yang sudah ditambahkan ke layar utama, pembaruan latar belakang (periodic sync) juga bisa jalan, tetapi waktunya ditentukan browser dan tidak dijamin.
- iPhone tidak mendukung pembaruan latar belakang itu.
- Notifikasi saat web tertutup sepenuhnya butuh server push, yang tidak termasuk di proyek statis ini. Alternatif yang lebih andal: kirim peringatan ke channel Telegram atau grup WhatsApp desa lewat GitHub Actions.
- Peringatan cuaca buruk muncul bila dalam 12 jam ke depan ada hujan lebat, petir, atau angin 30 km/jam ke atas. Ringkasan harian muncul sekali sehari mulai pukul 06.00 WIB.

## Laporan kejadian

Tombol WhatsApp dan SMS membuka aplikasinya dengan pesan sudah terisi. Pengguna tetap harus menekan tombol kirim, dan nomor pengirim ikut terlihat oleh penerima. Untuk kondisi bahaya yang sedang berlangsung, formulir mengarahkan pengguna menelepon 112 terlebih dahulu.

## Batasan

- Prakiraan cuaca bukan peringatan dini resmi. Untuk peringatan dini, rujuk BMKG.
- Pembaruan cuaca dua kali sehari, sehingga perubahan mendadak bisa terlambat terlihat.
- Aplikasi ini melengkapi, bukan menggantikan, panggilan ke layanan darurat.

## Sumber data

- **BMKG:** prakiraan cuaca per desa lewat API publik BMKG.
- **Open-Meteo:** data cadangan, tersedia gratis dengan atribusi. Periksa ketentuan penggunaannya di open-meteo.com.

## Pemeliharaan

- Setelah mengubah `index.html`, naikkan nama cache di `sw.js` (`info-desa-v6` menjadi `v7`, dan seterusnya) agar pengguna lama mendapat versi baru.
- Muat ulang dua kali setelah deploy untuk memuat service worker baru.

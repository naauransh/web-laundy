# PRD: Web App Manajemen Laundry

Versi 1.0 · Stack: Next.js + Google Sheets (tanpa database) + deploy di Vercel

## 1. Ringkasan

Web app untuk usaha laundry yang dipakai kasir/pemilik untuk: (1) mencatat pesanan pelanggan, (2) mengirim struk lewat WhatsApp, dan (3) melihat dashboard pendapatan harian, bulanan, 3 bulan, dan rentang tanggal custom, lengkap dengan grafik. Semua data disimpan di **Google Sheets** (bukan database), dan aplikasi di-deploy di **Vercel**.

**Jawaban singkat: bisa.** Google Sheets bisa dipakai sebagai "database" lewat Google Sheets API, dan kirim struk ke WhatsApp bisa dilakukan dengan dua cara (lihat bagian 8).

## 2. Tujuan dan Non-Tujuan

**Tujuan**

- Input pesanan baru cepat (kurang dari 1 menit per pelanggan).
- Struk otomatis terbentuk dan bisa dikirim ke WhatsApp pelanggan.
- Pemilik bisa lihat pendapatan dan tren dalam satu layar.
- Data tetap bisa dibuka dan diedit manual di Google Sheets.

**Non-Tujuan (tidak dibuat di versi 1)**

- Multi-cabang, multi-toko.
- Integrasi payment gateway.
- Manajemen stok deterjen, gaji karyawan, akuntansi lengkap.
- Aplikasi mobile native (cukup web responsif).

## 3. Pengguna

| Peran | Kebutuhan |
| --- | --- |
| Kasir | Tambah pesanan, cetak/kirim struk, ubah status pesanan |
| Pemilik (Owner) | Semua akses kasir, plus dashboard pendapatan, kelola daftar layanan dan harga |

Versi 1 hanya punya **dua akun tetap**: satu **Admin** (pemilik) dan satu **Kasir**. Tidak ada halaman kelola user dan tidak ada sheet `Users`. Peran "Pemilik (Owner)" di tabel di atas = Admin.

## 4. Asumsi yang Dipakai

Jika ada yang berbeda dari kebutuhan, ubah bagian ini sebelum dikasih ke AI.

- Mata uang Rupiah (IDR), format `Rp 25.000`.
- Zona waktu `Asia/Jakarta` untuk semua perhitungan tanggal.
- **Pendapatan** dihitung dari total pesanan berdasarkan **tanggal pesanan dibuat**, hanya pesanan berstatus bayar **Lunas**. Pesanan **Belum Lunas** ditampilkan terpisah sebagai "Piutang".
- Pesanan yang dibatalkan tidak dihitung.
- Bahasa antarmuka: Bahasa Indonesia.
- Satu pesanan bisa berisi beberapa jenis layanan (contoh: cuci + setrika kiloan, plus 1 selimut).

## 5. Fitur dan Kebutuhan Fungsional

### 5.1 Autentikasi

- Halaman `/login` dengan satu input password (tanpa username).
- Server membandingkan password dengan `ADMIN_PASSWORD` dan `KASIR_PASSWORD` (perbandingan timing-safe). Cocok dengan yang pertama berarti peran `admin`, cocok dengan yang kedua berarti peran `kasir`. Kedua password harus berbeda dan minimal 8 karakter.
- Buat session cookie JWT (library `jose`) yang berisi peran, httpOnly, secure, sameSite=lax, berlaku 12 jam, ditandatangani `SESSION_SECRET`.
- Semua halaman dan API selain `/login` wajib login (middleware Next.js). **Peran dicek di server pada setiap API route**, bukan hanya disembunyikan di tampilan.
- Batasi percobaan login gagal (maksimal 5 kali per menit per IP). Tombol logout ada di navbar.
- Setelah login, Admin diarahkan ke `/` (dashboard) dan Kasir ke `/antrian`.

**Hak akses per peran**

| Fitur | Admin | Kasir |
| --- | --- | --- |
| Dashboard pendapatan dan grafik | Ya | Tidak |
| Tambah pesanan, cetak struk, kirim WhatsApp | Ya | Ya |
| Antrian dan checklist selesai/diambil | Ya | Ya |
| Daftar pesanan, ubah status, tandai lunas | Ya | Ya |
| Batalkan pesanan, ubah harga di pesanan yang sudah disimpan | Ya | Tidak |
| Kelola layanan dan pengaturan usaha | Ya | Tidak |

### 5.2 Dashboard (`/`)

Halaman ini dan API `/api/stats` **hanya untuk Admin**. Kasir yang membukanya diarahkan ke `/antrian`.

**Kartu ringkasan (summary cards)**

1. Pendapatan Hari Ini
2. Pendapatan Bulan Ini (dari tanggal 1 sampai hari ini)
3. Pendapatan 3 Bulan Terakhir (90 hari ke belakang sampai hari ini)
4. Pendapatan Custom (sesuai rentang tanggal yang dipilih)

Setiap kartu menampilkan: total rupiah, jumlah pesanan, dan perbandingan dengan periode sebelumnya (persen naik/turun, warna hijau/merah). Tambahan kartu kecil: **Total Piutang** (pesanan belum lunas) dan **Pesanan Belum Selesai**.

**Filter rentang tanggal custom**

- Date range picker (dari tanggal, sampai tanggal) plus preset cepat: Hari Ini, 7 Hari, Bulan Ini, 3 Bulan, Tahun Ini.
- Saat filter diubah, kartu custom dan grafik ikut berubah.
- Validasi: tanggal akhir tidak boleh sebelum tanggal awal.

**Grafik**

1. **Grafik harian**: bar atau line chart, sumbu X tanggal, sumbu Y pendapatan, mengikuti rentang filter (default 30 hari terakhir). Tooltip menampilkan tanggal, pendapatan, dan jumlah pesanan.
2. **Grafik bulanan**: bar chart, 12 bulan terakhir, sumbu X nama bulan (Jan, Feb, ...), sumbu Y pendapatan.
3. **Grafik komposisi layanan** (opsional tapi diinginkan): pie atau donut chart yang menunjukkan kontribusi pendapatan per jenis layanan pada rentang terpilih.

Gunakan library **Recharts**. Hari tanpa transaksi tetap ditampilkan dengan nilai 0 supaya grafik tidak bolong. Tampilkan skeleton saat loading dan pesan jelas jika data kosong.

**Omset, perbandingan bulanan, dan total kilo (hanya Admin)**

"Omset" di aplikasi sama dengan pendapatan: total pesanan Lunas yang tidak dibatalkan.

- Kartu **Bulan Ini vs Bulan Lalu**: omset bulan ini sampai hari ini dibandingkan dengan omset bulan lalu pada rentang tanggal yang sama (contoh 1 sampai 22 Oktober dibanding 1 sampai 22 September). Tampilkan selisih rupiah dan persen dengan panah hijau (naik) atau merah (turun). Di bawahnya tampilkan omset bulan lalu penuh sebagai referensi.
- Kartu **Total Kilo Dicuci**: jumlah kilo cucian hari ini, bulan ini (dengan perbandingan ke bulan lalu pada tanggal yang sama), dan pada rentang tanggal yang dipilih di filter.
- Tabel **Rekap Bulanan** (12 bulan terakhir, bulan terbaru di atas) dengan kolom: Bulan, Omset, Selisih dari bulan sebelumnya (Rp dan persen), Total kg, Jumlah pesanan, dan Rata-rata omset per pesanan. Bulan pertama tanpa pembanding menampilkan "-". Jika bulan sebelumnya bernilai 0, persen ditampilkan "Baru", bukan angka tak terhingga.
- Grafik batang **Total Kilo per Bulan** (12 bulan terakhir), di samping grafik omset bulanan yang sudah ada, dengan tooltip berisi bulan, total kg, dan jumlah pesanan.
- **Aturan hitung kilo**: jumlahkan `quantity` dari sheet `OrderItems` yang `unit` = kg, untuk semua pesanan yang tidak Dibatalkan, baik Lunas maupun Belum Lunas, karena cucian tetap dikerjakan. Ini berbeda dari aturan omset, yang hanya menghitung Lunas. Layanan satuan (pcs) tidak dimasukkan ke kilo; tampilkan terpisah sebagai "+ N pcs satuan". Hitung dengan gram (bilangan bulat) lalu tampilkan dalam kg, contoh 1.250 kg ditampilkan "1.250 kg" atau "1,25 kg" sesuai format `id-ID`.

**Omset per metode bayar (hanya Admin)**

Panel kecil yang mengikuti filter tanggal, untuk mencocokkan uang di laci dan di rekening.

- Tampilkan tiga baris: Tunai, Transfer, QRIS. Tiap baris berisi omset (rupiah), jumlah pesanan, dan persen dari total omset.
- Tonjolkan angka **Uang Tunai Hari Ini** sebagai kartu terpisah, supaya pemilik tinggal mencocokkannya dengan uang di laci.
- Aturan hitung sama dengan omset: hanya pesanan **Lunas** dan tidak Dibatalkan, dikelompokkan berdasarkan kolom `payment_method`.

**Layanan terlaris (hanya Admin)**

Tabel 5 layanan teratas pada rentang tanggal yang dipilih.

- Kolom: Layanan, Jumlah pesanan, Total kuantitas (kg atau pcs sesuai satuan layanan), Omset, dan Persen dari total.
- Ada tombol pilihan urutan: berdasarkan **omset** atau berdasarkan **jumlah pesanan**.
- Data dihitung dari `line_total` di `OrderItems` yang digabung dengan `Orders` (Lunas, tidak Dibatalkan). Karena diskon pesanan tidak dibagi ke tiap layanan, jumlah semua baris bisa sedikit lebih besar dari omset total; tampilkan catatan kecil tentang hal ini.
- Grafik donat komposisi layanan yang sudah ada memakai data yang sama.

**Panel Perlu Perhatian (hanya Admin)**

- Jumlah pesanan yang **telat** (sudah lewat `estimated_done` tapi belum Selesai).
- Jumlah cucian yang **sudah Selesai tapi belum diambil** lebih dari `pickup_warning_days` hari.
- Tiap angka bisa diklik dan membuka halaman `/antrian` yang sudah terfilter.

**Susunan layar dashboard (dari atas ke bawah)**

1. Kartu omset (hari ini, bulan ini, 3 bulan, custom), total kilo, dan piutang.
2. Perbandingan Bulan Ini vs Bulan Lalu.
3. Panel Perlu Perhatian.
4. Grafik omset harian dan bulanan, lalu grafik Total Kilo per Bulan.
5. Layanan Terlaris dan Omset per Metode Bayar.
6. Rekap Bulanan dan tabel pesanan terbaru.

Di HP, susunan yang sama ditumpuk satu kolom dengan urutan yang sama.

**Tabel pesanan terbaru**: 10 pesanan terakhir (no. order, nama, total, status), klik membuka detail.

### 5.3 Tambah Pesanan (`/orders/new`)

Form untuk setiap pelanggan yang datang.

**Data pelanggan**

- Nama (wajib)
- Nomor telepon/WhatsApp (wajib; validasi nomor Indonesia)
- Alamat (opsional, textarea)
- Autocomplete: saat mengetik nama atau nomor telepon, sarankan pelanggan lama dari sheet pesanan sebelumnya, lalu isi otomatis nama, telepon, alamat.

**Item layanan (bisa lebih dari satu baris, tombol "+ Tambah Item")**

Setiap baris berisi:

- Layanan (dropdown dari daftar layanan di sheet `Services`, contoh: Cuci Kiloan, Cuci + Setrika Kiloan, Setrika Saja, Selimut, Bed Cover, Sepatu)
- Jumlah: untuk layanan kiloan, berat diisi lewat dua kolom, kg dan gram (contoh 2 kg 700 gram), atau satu kolom desimal (2,7) yang saling tersinkron. Disimpan di `quantity` sebagai kg desimal (2,7), kelipatan 10 gram. Untuk layanan satuan, isi jumlah pcs (bilangan bulat).
- Harga satuan (terisi otomatis dari `Services`, tetap bisa diubah manual oleh kasir)
- Subtotal (otomatis = jumlah × harga satuan)
- Tombol hapus baris

**Perhitungan harga kiloan:** subtotal = berat (kg) × harga per kg, dihitung dari gram (bilangan bulat) supaya tidak ada selisih desimal: `subtotal = gram × harga_per_kg / 1000`. Contoh: 2 kg 700 gram × Rp 6.000 = **Rp 16.200**; 1 kg 200 gram × Rp 6.000 = Rp 7.200. Subtotal dan total langsung berubah saat kasir mengetik berat. Hasil dibulatkan ke Rp 100 terdekat (diatur di `Settings` dengan key `price_rounding`, isi 0 untuk tanpa pembulatan).

**Keterangan isi cucian dan catatan pesanan**

Selain nama pelanggan dan berat, tiap pesanan menyimpan keterangan apa saja yang dicuci dan catatan khusus dari pelanggan.

- **Isi cucian** (di tiap baris item layanan, opsional tapi disarankan): teks pendek tentang apa yang dicuci, contoh `Baju`, `Celana jeans`, `Sprei`, ditambah **jumlah potong** (angka, opsional). Contoh: Cuci Kering Setrika, 5,6 kg, isi cucian: Baju, 20 potong.
- **Catatan item** (di tiap baris item, opsional): instruksi khusus untuk item itu, contoh "baju putih dipisah" atau "jangan pakai pelembut".
- **Catatan pesanan** (satu per pesanan, kolom `notes`): kolom teks bebas dengan **tombol cepat (chip)** yang bisa diklik untuk menambahkan teks, misalnya "Pisahkan baju putih", "Jangan digabung", "Jangan disetrika", "Ada noda, mohon dicek", dan "Pewangi ekstra". Kasir tetap bisa mengetik bebas. Daftar chip diatur Admin di `Settings` dengan key `note_presets` (dipisah koma).

**Tampilan keterangan di halaman lain**

- **Struk dan teks WhatsApp**: isi cucian ditampilkan di bawah nama layanan, dan catatan pesanan di bagian bawah struk.
- **Antrian (`/antrian`)**: kartu pesanan menampilkan nama pelanggan, total kg, ringkasan isi cucian, dan catatan dengan **penanda mencolok** (ikon peringatan dan latar kuning) supaya petugas cuci tidak melewatkan instruksi.
- **Halaman detail pesanan (`/orders/[id]`)**: menampilkan data pelanggan, semua item beserta isi cucian dan catatannya, catatan pesanan, status bayar dan status pesanan, waktu selesai dan diambil, serta tombol ke struk. Kasir dan Admin boleh mengubah isi cucian dan catatan selama pesanan belum berstatus Selesai; setiap perubahan memperbarui `updated_at` melalui `PATCH /api/orders/[id]`.

**Data pesanan**

- Diskon (nominal rupiah, opsional, default 0)
- Total akhir (otomatis = jumlah subtotal − diskon), ditampilkan besar dan jelas
- Metode pembayaran: Tunai, Transfer, QRIS (hanya sebagai keterangan; aplikasi tidak memproses atau memverifikasi pembayaran, kasir mengecek sendiri lalu memilih status Lunas)
- Status pembayaran: Lunas atau Belum Lunas (default Lunas)
- Estimasi selesai (pemilih tanggal dan jam, default diisi waktu sekarang + `duration_hours` dari layanan terlama (misalnya Express 1 jam atau Reguler 48 jam), bisa diubah kasir)
- Catatan (opsional, contoh: "pisahkan baju putih")

**Aksi**

- Tombol **Simpan Pesanan**: simpan ke Google Sheets lalu arahkan ke halaman struk.
- Tombol **Simpan dan Kirim WhatsApp**: simpan lalu langsung buka WhatsApp dengan struk terisi.
- Cegah klik ganda: tombol disabled dan menampilkan loading selama proses simpan.
- Error ditampilkan jelas (contoh: "Gagal menyimpan ke Google Sheets, coba lagi"), data form tidak boleh hilang saat gagal.

**Nomor pesanan**: format `LDR-YYMMDD-NNN` (contoh `LDR-261022-001`), urutan NNN reset tiap hari, dibuat di server saat simpan dengan membaca jumlah pesanan hari itu.

### 5.4 Struk (`/orders/[id]/receipt`)

- Tampilan struk bergaya kertas thermal 58mm/80mm: nama usaha, alamat, nomor telepon usaha (dari sheet `Settings`), no. pesanan, tanggal-jam, nama pelanggan, daftar item (nama layanan, jumlah, harga, subtotal), diskon, **total**, status bayar, metode bayar, estimasi selesai, catatan, dan teks penutup (contoh: "Terima kasih").
- Tombol **Cetak** (memakai `window.print()` dengan CSS `@media print` khusus struk).
- Tombol **Kirim ke WhatsApp**.
- Tombol **Salin teks struk**.

### 5.5 Kirim Struk ke WhatsApp

Lihat bagian 8 untuk opsi teknis. Versi 1 memakai **opsi A (link wa.me)**.

**Normalisasi nomor**: hapus spasi, tanda hubung, dan tanda plus. Jika diawali `0` ganti dengan `62`. Jika diawali `62` biarkan. Contoh: `0812-3456-7890` menjadi `6281234567890`.

**Format teks struk WhatsApp** (contoh):

```
*NAMA LAUNDRY*
Alamat usaha · Telp usaha
--------------------------
No: LDR-261022-001
Tanggal: 22/10/2026 14:30
Pelanggan: Budi
--------------------------
Cuci + Setrika Kiloan
2,5 kg x Rp 8.000 = Rp 20.000
Selimut
1 pcs x Rp 25.000 = Rp 25.000
--------------------------
Diskon: Rp 0
*TOTAL: Rp 45.000*
Status: Lunas (Tunai)
Estimasi selesai: 24/10/2026
--------------------------
Terima kasih!
```

Link dibentuk dengan `https://wa.me/<nomor>?text=<teks di-encodeURIComponent>`.

### 5.6 Daftar Pesanan (`/orders`)

- Tabel semua pesanan, terbaru di atas, dengan pagination (20 per halaman).
- Pencarian berdasarkan nama, telepon, atau nomor pesanan.
- Filter: status pesanan, status bayar, rentang tanggal.
- Aksi per baris: lihat detail dan struk, ubah status pesanan, tandai lunas, kirim ulang WhatsApp, batalkan pesanan.
- **Status pesanan**: Diterima, Diproses, Selesai, Diambil, Dibatalkan.
- Tombol cepat "Selesai, kabari pelanggan" yang membuka WhatsApp dengan teks pemberitahuan cucian sudah selesai.
- Hapus pesanan tidak dilakukan permanen. Gunakan status Dibatalkan agar riwayat tetap utuh.

Kasir hanya bisa melihat, mengubah status, dan menandai lunas. **Membatalkan pesanan hanya bisa dilakukan Admin.**

### 5.7 Kelola Layanan (`/services`)

- Tabel layanan: nama, satuan (kg atau pcs), harga, estimasi durasi (jam), aktif atau nonaktif.
- Tambah, ubah, dan nonaktifkan layanan. Data disimpan di sheet `Services`.

**Form tambah dan ubah layanan.** Tombol **+ Tambah Layanan** membuka form di modal. Tombol **Ubah** di tiap baris membuka form yang sama dengan data layanan itu sudah terisi. Isi form:

- **Nama layanan** (wajib, unik, maksimal 60 karakter), contoh `Cuci Sepatu Deep Clean`.
- **Satuan**: `kg`, `pcs`, atau `pasang` (untuk sepatu). Satuan `kg` memakai input kg dan gram; `pcs` dan `pasang` memakai bilangan bulat. Kolom `unit` di sheet `Services` dan `OrderItems` juga boleh berisi `pasang`.
- **Harga per satuan** (wajib, rupiah, 0 atau lebih).
- **Estimasi durasi dalam jam** (wajib, bilangan bulat, minimal 1), contoh 48. Sediakan tombol pintas 1, 6, 24, 48, dan 72 jam. Di bawah input tampil padanan otomatis, misalnya "48 jam = 2 hari". Estimasi ini dipakai sebagai nilai awal `estimated_done` saat kasir membuat pesanan (diambil dari layanan dengan durasi terlama di pesanan itu).
- **Aktif** (toggle).

Contoh: Cuci Sepatu Deep Clean, satuan pasang, harga diisi pemilik, estimasi 48 jam.

**Aturan saat mengubah layanan**

- Perubahan harga dan durasi hanya berlaku untuk **pesanan baru**. Pesanan lama tetap memakai harga dan estimasi saat pesanan itu dibuat.
- Layanan tidak dihapus permanen, hanya dinonaktifkan. Layanan nonaktif tidak muncul di dropdown pesanan baru, tetapi tetap tampil di riwayat pesanan lama.
- Nama layanan boleh diubah kapan saja. **Satuan tidak boleh diubah** jika layanan sudah pernah dipakai di pesanan (supaya hitungan kilo dan pcs tidak kacau). Kalau butuh satuan lain, buat layanan baru.
- Nama yang sama dengan layanan lain ditolak dengan pesan yang jelas.
- Admin juga bisa mengubah harga atau durasi langsung di tabel (klik angkanya, ubah, tekan Enter untuk menyimpan).
- Saat disimpan, aplikasi memperbarui baris di sheet `Services` berdasarkan `service_id` (layanan baru memakai nomor berikutnya, contoh `SVC-007`), menampilkan notifikasi "Tersimpan", dan menyegarkan daftar layanan di form pesanan.
- Jika pemilik mengubah sheet `Services` langsung di Google Sheets, perubahan tampil di website dalam sekitar 1 menit. Baris dengan `unit` selain kg, pcs, atau pasang, atau dengan harga dan durasi yang bukan angka, diabaikan dan ditandai peringatan di halaman `/services`.

### 5.8 Pengaturan Usaha

Nama usaha, alamat, nomor telepon, teks penutup struk dibaca dari sheet `Settings` (pasangan key dan value). Halaman `/settings` untuk mengubahnya.

Halaman `/services` dan `/settings` **hanya untuk Admin**.

### 5.9 Antrian dan Checklist Pesanan (`/antrian`)

Halaman untuk Admin dan Kasir menandai cucian yang sudah selesai dan sudah diambil, supaya semua orang tahu status tiap pesanan.

- Ada dua tab: **Antrian** (pesanan yang belum diambil, yang paling lama masuk di atas) dan **Riwayat** (pesanan yang sudah diambil).
- Tiap pesanan punya dua checkbox: **Selesai dicuci** dan **Sudah diambil**. "Sudah diambil" baru bisa dicentang setelah "Selesai dicuci".
- Centang "Selesai dicuci" mengisi `done_at` dan `done_by`, lalu mengubah `order_status` menjadi Selesai.
- Centang "Sudah diambil" mengisi `picked_up_at` dan `picked_up_by`, mengubah `order_status` menjadi Diambil, dan memindahkan pesanan ke Riwayat.
- Salah centang bisa dibatalkan: status mundur satu langkah dan kolom waktunya dikosongkan.
- Penanda warna: **merah** jika sudah lewat `estimated_done` tapi belum Selesai, **kuning** jika sudah Selesai tapi belum diambil lebih dari 3 hari (angka diatur di `Settings` dengan key `pickup_warning_days`).
- Jika `payment_status` masih Belum Lunas saat mencentang "Sudah diambil", tampilkan konfirmasi: tandai lunas dulu atau lanjut tanpa lunas.
- Setelah "Selesai dicuci" dicentang, muncul tombol **Kabari lewat WhatsApp** dengan teks pemberitahuan bahwa cucian dengan nomor pesanan tersebut sudah selesai dan bisa diambil.
- Ada pencarian berdasarkan nama, nomor pesanan, atau telepon. Data diperbarui otomatis tiap 30 detik (SWR `refreshInterval`).
- `done_by` dan `picked_up_by` berisi `admin` atau `kasir`, sesuai akun yang login.

## 6. Struktur Google Sheets

Satu spreadsheet dengan 4 sheet (tab). Baris pertama adalah header persis seperti di bawah. Kode harus membaca berdasarkan nama header, bukan posisi kolom saja.

**Sheet `Orders`** (satu baris per pesanan)

| Kolom | Isi |
| --- | --- |
| order_id | LDR-261022-001 |
| created_at | ISO 8601, zona Asia/Jakarta |
| customer_name | teks |
| customer_phone | format 62xxxxxxxxxx |
| customer_address | teks |
| subtotal | angka |
| discount | angka |
| total | angka |
| payment_method | Tunai, Transfer, QRIS |
| payment_status | Lunas, Belum Lunas |
| order_status | Diterima, Diproses, Selesai, Diambil, Dibatalkan |
| estimated_done | tanggal dan jam (ISO 8601) |
| notes | teks |
| updated_at | ISO 8601 |

Tambahkan kolom berikut di sheet `Orders`, setelah `updated_at`, untuk fitur antrian:

| Kolom | Isi |
| --- | --- |
| done_at | waktu centang Selesai dicuci (ISO 8601), kosong jika belum |
| done_by | admin atau kasir |
| picked_up_at | waktu centang Sudah diambil (ISO 8601), kosong jika belum |
| picked_up_by | admin atau kasir |

**Sheet `OrderItems`** (satu baris per item layanan)

| Kolom | Isi |
| --- | --- |
| order_id | referensi ke Orders |
| service_name | teks |
| unit | kg, pcs, atau pasang |
| quantity | angka desimal |
| unit_price | angka |
| line_total | angka |

Tambahkan kolom berikut di sheet `OrderItems`, setelah `line_total`:

| Kolom | Isi |
| --- | --- |
| item_description | isi cucian, contoh Baju, Celana jeans, Sprei (teks, boleh kosong) |
| piece_count | jumlah potong (angka, boleh kosong) |
| item_notes | catatan khusus untuk item itu (teks, boleh kosong) |

**Sheet `Services`**

| Kolom | Isi |
| --- | --- |
| service_id | SVC-001 |
| name | teks |
| unit | kg, pcs, atau pasang |
| price | angka |
| duration_hours | angka |
| active | TRUE atau FALSE |

Contoh isi awal sheet `Services`: Cuci Kering Setrika Reguler (kg, Rp 6.000, 48 jam) dan Cuci Express 1 Jam (kg, harga diisi pemilik, 1 jam). Pemilik menambah atau mengubah layanan dan harga langsung di sheet ini atau lewat halaman `/services`; perubahan tampil di website dalam sekitar 1 menit karena data di-cache.

**Sheet `Settings`**: kolom `key` dan `value` dengan key: `business_name`, `business_address`, `business_phone`, `receipt_footer`.

Key tambahan di `Settings`: `pickup_warning_days` (default 3, batas hari penanda kuning di antrian) dan `price_rounding` (default 100, pembulatan harga ke rupiah terdekat; 0 = tanpa pembulatan).

Seed awal: sediakan file `sample-data.md` atau script yang berisi header dan contoh 5 layanan supaya langsung bisa dipakai.

## 7. Arsitektur Teknis

**Stack**

- Next.js (App Router) + TypeScript
- Tailwind CSS untuk styling, desain mobile-first dan responsif (kasir sering pakai HP atau tablet)
- Recharts untuk grafik
- `googleapis` (paket resmi) untuk akses Google Sheets API v4
- `zod` untuk validasi input di client dan server
- `date-fns` dan `date-fns-tz` untuk tanggal dan zona waktu
- SWR atau TanStack Query untuk fetching data di client

**Prinsip penting**

- **Semua akses Google Sheets hanya lewat server** (Route Handlers `/api/...`). Kredensial tidak boleh pernah ada di kode client.
- Autentikasi ke Google memakai **Service Account**. Spreadsheet di-share ke email service account dengan akses Editor.
- Jangan memakai penyimpanan file lokal. Vercel bersifat serverless dan filesystem-nya tidak persisten. Jangan juga memakai localStorage, sessionStorage, atau IndexedDB untuk menyimpan data pesanan, layanan, atau pengaturan: satu-satunya sumber data adalah Google Sheets. Browser hanya boleh menyimpan cookie sesi login.

**Environment variables (di Vercel dan `.env.local`)**

```
GOOGLE_SHEET_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=   # ganti newline dengan \n, di kode lakukan .replace(/\\n/g, "\n")
ADMIN_PASSWORD=
KASIR_PASSWORD=
SESSION_SECRET=       # string acak minimal 32 karakter
TZ=Asia/Jakarta
```

Sertakan file `.env.example`.

`ADMIN_PASSWORD` untuk akun Admin. `KASIR_PASSWORD` untuk akun Kasir (harus berbeda dari `ADMIN_PASSWORD`, minimal 8 karakter).

**API endpoints**

| Method | Path | Fungsi |
| --- | --- | --- |
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| GET | /api/orders | Daftar pesanan (query: search, status, from, to, page) |
| POST | /api/orders | Buat pesanan baru (header dan item sekaligus) |
| GET | /api/orders/[id] | Detail pesanan beserta item |
| PATCH | /api/orders/[id] | Ubah status pesanan atau status bayar |
| GET | /api/customers/search?q= | Autocomplete pelanggan |
| GET | /api/services | Daftar layanan |
| POST/PATCH | /api/services | Tambah atau ubah layanan |
| GET/PATCH | /api/settings | Baca atau ubah pengaturan usaha |
| GET | /api/stats?from=&to= | Ringkasan dashboard dan data grafik |

Endpoint tambahan: `GET /api/queue` (daftar antrian dan riwayat) dan `PATCH /api/orders/[id]/checklist` (centang atau batal centang selesai dan diambil, berisi `{ "step": "done" | "picked_up", "checked": true | false }`). Endpoint yang **hanya Admin**: `/api/stats`, tulis ke `/api/services`, tulis ke `/api/settings`, dan pembatalan pesanan di `PATCH /api/orders/[id]`. Semua endpoint lain boleh diakses Admin dan Kasir.

**Logika `/api/stats`**: baca sheet `Orders`, filter `order_status != Dibatalkan` dan `payment_status = Lunas`, kelompokkan per tanggal dan per bulan (zona Asia/Jakarta), hitung total, jumlah pesanan, dan pembanding periode sebelumnya. Kembalikan JSON siap pakai untuk grafik.

`/api/stats` juga mengembalikan: perbandingan bulan ini vs bulan lalu pada rentang tanggal yang sama, rekap 12 bulan terakhir (omset, total kg, jumlah pesanan per bulan), dan total kg untuk hari ini, bulan ini, dan rentang filter. Untuk menghitung kilo, baca sheet `Orders` dan `OrderItems` sekaligus dengan `batchGet`, lalu gabungkan berdasarkan `order_id`. Hasil di-cache 30 sampai 60 detik seperti endpoint lain.

`/api/stats` juga mengembalikan: rincian omset per metode bayar (Tunai, Transfer, QRIS), 5 layanan terlaris (diurutkan menurut omset dan menurut jumlah pesanan), dan jumlah pesanan yang telat serta yang sudah Selesai tapi belum diambil lebih dari `pickup_warning_days` hari.

**Batasan Google Sheets yang harus ditangani**

- Kuota API sekitar 60 request per menit per user. Gunakan caching di server (revalidate 30 sampai 60 detik) untuk endpoint baca, dan baca rentang besar dalam satu request (`batchGet`).
- Penulisan memakai `values.append` agar baris baru aman ditambahkan.
- Tulis `Orders` dan `OrderItems` dalam satu `batchUpdate` atau append berurutan. Jika item gagal tersimpan, laporkan error ke user.
- Nomor pesanan dibuat di server untuk menghindari duplikat. Jika dua kasir menyimpan di detik yang sama, lakukan pengecekan ulang sebelum append.
- Simpan angka sebagai number dan tanggal sebagai teks ISO supaya mudah diolah.
- Cocok untuk skala kecil sampai menengah (ribuan pesanan). Jika data mencapai puluhan ribu baris, pertimbangkan migrasi ke database.

**Struktur folder yang diharapkan**

```
/app
  /(auth)/login/page.tsx
  /(app)/page.tsx                 # dashboard
  /(app)/orders/page.tsx
  /(app)/orders/new/page.tsx
  /(app)/orders/[id]/receipt/page.tsx
  /(app)/services/page.tsx
  /(app)/settings/page.tsx
  /api/...
/lib
  sheets.ts      # klien Google Sheets dan helper baca/tulis
  stats.ts       # perhitungan dashboard
  receipt.ts     # pembuat teks struk dan link wa.me
  phone.ts       # normalisasi nomor
  session.ts     # login session
/components
  SummaryCard, RevenueChart, MonthlyChart, ServiceDonut, OrderForm, ReceiptView, DateRangePicker
middleware.ts
```

## 8. Opsi Pengiriman Struk WhatsApp

**Opsi A: Link `wa.me` (dipakai di versi 1)**

- Gratis, tanpa registrasi, tanpa API.
- Saat tombol diklik, WhatsApp (aplikasi atau WhatsApp Web) terbuka dengan chat ke pelanggan dan teks struk sudah terisi. Kasir tinggal menekan Kirim.
- Kekurangan: **tidak otomatis**, tetap perlu satu klik manual dari kasir.

**Opsi B: WhatsApp Business Cloud API atau layanan gateway (fase 2)**

- Struk terkirim otomatis dari server tanpa interaksi kasir.
- Pilihan: WhatsApp Business Cloud API resmi dari Meta (butuh akun Meta Business, nomor khusus, dan template pesan yang disetujui, ada biaya per percakapan), atau gateway pihak ketiga lokal seperti Fonnte (lebih mudah, berbayar, tetapi memakai jalur tidak resmi sehingga ada risiko nomor diblokir).
- Siapkan kode dengan antarmuka `sendReceipt(order)` supaya nanti mudah diganti dari opsi A ke opsi B tanpa mengubah form.

## 9. Kebutuhan Non-Fungsional

- **Performa**: dashboard tampil kurang dari 3 detik dengan data hingga 5.000 pesanan (gunakan cache).
- **Responsif**: nyaman dipakai di layar HP 360px sampai desktop.
- **Keamanan**: kredensial hanya di environment variable, cookie httpOnly, validasi semua input di server, sanitasi teks sebelum ditulis ke sheet (hindari nilai yang diawali `=`, `+`, `-`, `@` supaya tidak menjadi formula; awali dengan tanda petik tunggal).
- **Aksesibilitas**: label form jelas, kontras warna cukup, ukuran tombol minimal 44px.
- **Penanganan error**: setiap kegagalan memberi pesan Bahasa Indonesia yang mudah dipahami.
- **Lokalisasi**: format angka `id-ID`, tanggal `dd/MM/yyyy`.

### 9.1 Desain Responsif (HP, Tablet, Laptop/Komputer)

Satu aplikasi yang sama, tampilannya menyesuaikan lebar layar. Pakai pendekatan mobile-first dengan breakpoint Tailwind (`sm`, `md`, `lg`).

| Perangkat | Lebar layar | Pemakaian utama | Tata letak |
| --- | --- | --- | --- |
| HP | 360 sampai 767 px | Kasir input pesanan dan mencentang antrian | Satu kolom, navigasi tab di bawah |
| Tablet | 768 sampai 1023 px | Kasir di meja, Admin melihat laporan | Dua kolom, sidebar ringkas (ikon) |
| Laptop/komputer | 1024 px ke atas | Admin melihat dashboard dan kelola layanan | Sidebar penuh di kiri, konten multi kolom |

**Aturan responsif**

- **Navigasi**: di HP berupa bottom navigation (Antrian, Tambah Pesanan, Pesanan, dan untuk Admin juga Dashboard serta menu Lainnya berisi Layanan dan Pengaturan). Di tablet berupa sidebar ringkas, di laptop sidebar penuh dengan label.
- **Kartu ringkasan dashboard**: 1 atau 2 kolom di HP, 2 kolom di tablet, 4 kolom di laptop.
- **Grafik**: pakai `ResponsiveContainer` dari Recharts. Tinggi sekitar 240 px di HP dan 320 px di laptop. Di HP, label sumbu X dikurangi atau dimiringkan supaya tidak bertumpuk, dan tooltip muncul saat grafik disentuh.
- **Tabel** (daftar pesanan, rekap bulanan, layanan): di laptop berupa tabel biasa. Di HP daftar pesanan dan layanan berubah menjadi daftar kartu (satu pesanan satu kartu), sedangkan tabel rekap bulanan boleh digeser horizontal di dalam kontainernya.
- **Form tambah pesanan**: di HP satu kolom dan tiap item layanan berupa kartu yang ditumpuk. Total dan tombol Simpan menempel di bagian bawah layar (sticky) supaya selalu terlihat. Di laptop dua kolom: data pelanggan di kiri, item layanan dan ringkasan total di kanan.
- **Input dan tombol**: tombol dan checkbox minimal 44 x 44 px (mudah ditekan satu tangan). Input telepon memakai `inputmode="tel"`, input berat dan harga memakai `inputmode="decimal"` atau `numeric` supaya keyboard angka muncul di HP. Ukuran font input minimal 16 px agar iPhone tidak memperbesar layar otomatis.
- **Antrian**: checkbox Selesai dicuci dan Sudah diambil dibuat besar dan berjarak di HP.
- **Struk**: tampil pas di layar HP. Saat dicetak, CSS print memakai lebar 58 mm atau 80 mm dan menyembunyikan navigasi serta tombol.
- Halaman tidak boleh punya scroll horizontal (kecuali di dalam kontainer tabel), dan tidak boleh ada teks atau tombol yang terpotong.
- Wajib ada `<meta name="viewport" content="width=device-width, initial-scale=1">`. Uji di lebar 360, 390, 768, 1024, dan 1440 px, mode potret dan lanskap.

## 10. Alur Pengguna Utama

1. Kasir login.
2. Pelanggan datang, kasir klik **Tambah Pesanan**.
3. Isi nama, telepon, alamat (atau pilih dari autocomplete).
4. Tambah item: misalnya Cuci + Setrika 2,5 kg dan Selimut 1 pcs. Total terhitung otomatis.
5. Pilih metode dan status bayar, klik **Simpan dan Kirim WhatsApp**.
6. Data masuk ke Google Sheets, halaman struk muncul, WhatsApp terbuka dengan struk terisi, kasir klik Kirim.
7. Saat cucian selesai, kasir ubah status ke Selesai dan kabari pelanggan lewat tombol WhatsApp.
8. Owner membuka dashboard untuk melihat pendapatan dan tren.

## 11. Kriteria Penerimaan

- [ ] Pesanan baru dengan 2 item berbeda tersimpan: 1 baris di `Orders` dan 2 baris di `OrderItems`.
- [ ] Total dan subtotal di form sama dengan yang tersimpan di sheet dan yang tampil di struk.
- [ ] Nomor `0812...` berubah menjadi `62812...` pada link WhatsApp, dan teks struk terisi benar.
- [ ] Kartu pendapatan hari ini, bulan ini, 3 bulan, dan custom menampilkan angka yang cocok dengan penjumlahan manual di Google Sheets.
- [ ] Pesanan Dibatalkan dan Belum Lunas tidak masuk angka pendapatan.
- [ ] Grafik harian dan bulanan tampil benar, termasuk hari tanpa transaksi bernilai 0.
- [ ] Halaman selain `/login` tidak bisa diakses tanpa login.
- [ ] Kredensial Google tidak muncul di bundle client atau di repository.
- [ ] Aplikasi berhasil di-deploy di Vercel hanya dengan mengisi environment variables.
- [ ] Semua halaman nyaman dipakai di layar HP.
- [ ] Login dengan `ADMIN_PASSWORD` menghasilkan peran Admin, dengan `KASIR_PASSWORD` menghasilkan peran Kasir.
- [ ] Kasir yang membuka `/` atau memanggil `/api/stats` ditolak (403), bukan hanya disembunyikan di menu.
- [ ] Kasir tidak bisa membatalkan pesanan, mengubah layanan, atau mengubah pengaturan, baik lewat tampilan maupun lewat API.
- [ ] "Sudah diambil" tidak bisa dicentang sebelum "Selesai dicuci".
- [ ] Centang selesai dan diambil mengisi kolom `done_at`, `done_by`, `picked_up_at`, `picked_up_by` serta `order_status` di sheet, dan pesanan yang sudah diambil pindah ke tab Riwayat.
- [ ] Mencentang "Sudah diambil" pada pesanan Belum Lunas menampilkan konfirmasi.
- [ ] Perubahan checklist dari satu perangkat muncul di perangkat lain dalam maksimal 30 detik.
- [ ] Kartu Bulan Ini vs Bulan Lalu menampilkan selisih rupiah dan persen yang cocok dengan hitungan manual di Google Sheets, dengan rentang tanggal yang sama untuk kedua bulan.
- [ ] Total Kilo Dicuci cocok dengan penjumlahan kolom `quantity` (unit kg) di `OrderItems` untuk pesanan yang tidak dibatalkan, termasuk pesanan Belum Lunas.
- [ ] Pesanan Dibatalkan tidak masuk ke omset maupun total kilo, dan layanan pcs tidak dihitung sebagai kilo.
- [ ] Tabel Rekap Bulanan menampilkan 12 bulan dengan selisih dari bulan sebelumnya; bulan pertama menampilkan "-" dan bulan dengan pembanding 0 menampilkan "Baru".
- [ ] Grafik Total Kilo per Bulan tampil benar, termasuk bulan tanpa transaksi bernilai 0.
- [ ] Admin bisa menambah layanan baru (contoh Cuci Sepatu Deep Clean, pasang, 48 jam) dan layanan itu langsung muncul di dropdown form pesanan.
- [ ] Admin bisa mengubah nama, harga, estimasi jam, dan status aktif; perubahan tersimpan di sheet `Services`.
- [ ] Mengubah harga atau durasi tidak mengubah total pesanan lama.
- [ ] Layanan nonaktif tidak muncul di form pesanan baru, tetapi tetap tampil di pesanan lama.
- [ ] Satuan layanan yang sudah pernah dipakai tidak bisa diubah, dan nama layanan kembar ditolak.
- [ ] Memilih layanan dengan durasi 48 jam mengisi estimasi selesai otomatis menjadi 48 jam dari waktu sekarang.
- [ ] Kasir tidak bisa membuka `/services` maupun menulis ke `/api/services`.
- [ ] Semua halaman bisa dipakai tanpa scroll horizontal pada lebar 360, 768, 1024, dan 1440 px.
- [ ] Navigasi berupa tab di bawah pada HP, dan sidebar pada tablet dan laptop.
- [ ] Di HP, total dan tombol Simpan pada form pesanan tetap terlihat saat form di-scroll.
- [ ] Di HP, daftar pesanan dan daftar layanan tampil sebagai kartu yang mudah dibaca.
- [ ] Keyboard angka muncul untuk input telepon, berat, dan harga di HP.
- [ ] Grafik dan tabel dashboard tidak terpotong di layar kecil.
- [ ] Cetak struk menyembunyikan navigasi dan pas pada kertas 58 mm atau 80 mm.
- [ ] Setiap baris item bisa diisi isi cucian, jumlah potong, dan catatan item; datanya tersimpan di `item_description`, `piece_count`, dan `item_notes` di sheet `OrderItems`.
- [ ] Catatan pesanan bisa diisi bebas atau lewat tombol cepat, dan tersimpan di kolom `notes`.
- [ ] Isi cucian dan catatan muncul di struk, teks WhatsApp, kartu antrian, dan halaman detail pesanan.
- [ ] Pesanan yang punya catatan tampil dengan penanda mencolok di halaman antrian.
- [ ] Isi cucian dan catatan bisa diubah selama pesanan belum Selesai, dan tidak bisa diubah setelahnya.
- [ ] Panel Omset per Metode Bayar menampilkan Tunai, Transfer, dan QRIS, dan jumlahnya sama dengan omset total pada rentang yang sama.
- [ ] Uang Tunai Hari Ini cocok dengan penjumlahan manual pesanan Lunas bermetode Tunai hari itu.
- [ ] Layanan Terlaris menampilkan 5 layanan teratas dan bisa diurutkan menurut omset atau jumlah pesanan.
- [ ] Panel Perlu Perhatian menghitung pesanan telat dan cucian selesai yang belum diambil, dan klik angkanya membuka antrian yang sudah terfilter.
- [ ] Susunan dashboard mengikuti urutan di PRD, termasuk di tampilan HP.

## 12. Rencana Rilis

**Versi 1 (MVP)**: login dua peran (admin dan kasir), tambah pesanan, struk dan link WhatsApp, daftar pesanan, halaman antrian dengan checklist selesai dan diambil, dashboard dengan kartu dan grafik, kelola layanan, pengaturan usaha.

**Fase 2**: pengiriman WhatsApp otomatis, ekspor laporan ke PDF atau Excel, laporan pengeluaran dan laba bersih, pengingat cucian belum diambil, program member atau poin.

Data dashboard yang ditunda ke fase 2, menunggu data terkumpul beberapa bulan: perbandingan Express vs Reguler, hari dan jam tersibuk, pelanggan baru vs langganan beserta pelanggan teratas, serta laba bersih setelah pengeluaran.

## 13. Panduan Setup Google Sheets (untuk dikerjakan manual)

1. Buat project di Google Cloud Console, aktifkan **Google Sheets API**.
2. Buat **Service Account**, lalu buat key format JSON. Ambil `client_email` dan `private_key`.
3. Buat Google Sheet baru dengan 4 tab sesuai bagian 6 (header persis sama).
4. Klik Share di spreadsheet, tambahkan email service account sebagai **Editor**.
5. Salin ID spreadsheet dari URL (bagian di antara `/d/` dan `/edit`).
6. Masukkan semua nilai ke environment variables di Vercel (Project Settings, Environment Variables), lalu deploy.

## 14. Instruksi untuk AI Coding Tool

Buatkan aplikasi lengkap sesuai PRD ini dengan Next.js App Router, TypeScript, Tailwind, Recharts, dan googleapis. Kerjakan berurutan: (1) setup project dan struktur folder, (2) `lib/sheets.ts` dengan fungsi baca dan tulis, (3) autentikasi dua peran (admin dan kasir) dan middleware, (4) API routes, (5) halaman tambah pesanan dan struk, (6) dashboard dan grafik, (7) halaman antrian dengan checklist, daftar pesanan, layanan, dan pengaturan. Sertakan `.env.example`, README berisi langkah setup Google Sheets dan deploy ke Vercel, serta data contoh untuk sheet `Services` dan `Settings`. Jika ada hal yang belum jelas, ikuti bagian Asumsi dan jangan menambah fitur di luar PRD ini.

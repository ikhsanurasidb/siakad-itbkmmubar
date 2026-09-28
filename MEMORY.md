# Memory

## 2026-09-28 — SIAKAD-02 D1 migration

- Error yang terjadi: endpoint `masterData/list` dan `masterData/create` mengembalikan HTTP 500 dengan `D1_ERROR: no such table: study_programs`.
- Penyebab: migration SIAKAD-02 sudah ada di repository, tetapi belum diterapkan pada database D1 lokal/target yang dipakai server.
- Pencegahan: setelah menambah atau mengubah schema, pastikan migration diterapkan pada database target melalui alur migration Alchemy/Wrangler yang dikonfigurasi sebelum menguji endpoint atau menjalankan seed data.
- Build, type-check, lint, dan unit test tidak membuktikan bahwa tabel pada D1 target sudah tersedia. Saat ada error schema, verifikasi tabel dan riwayat migration pada database yang benar.

## 2026-09-28 — SIAKAD-02 copywriting dan validasi perubahan

- Kesalahan: beberapa label dan status enum masih tampil dalam bahasa Inggris, seperti `Master Data`, `Import`, `Upload`, `Preview`, `Commit`, `ACTIVE`, dan `ARCHIVED`.
- Pencegahan: semua teks UI harus mengikuti aturan copywriting pada implementation plan; terjemahkan istilah teknis yang terlihat pengguna dan petakan enum/status ke label Bahasa Indonesia sebelum dirender.
- Kesalahan: pesan error mutation berpotensi menampilkan pesan exception mentah kepada pengguna.
- Pencegahan: gunakan pesan error aman, singkat, dan dapat ditindaklanjuti; simpan detail teknis hanya di log server.
- Kesalahan: halaman master data sempat terlalu besar sehingga diagnosis React Doctor menandai kompleksitas komponen.
- Pencegahan: pecah halaman berdasarkan tanggung jawab (dashboard, form, daftar, dan tipe bersama), lalu jalankan React Doctor dengan scope `changed` sebelum commit.
- Kesalahan: validasi penuh dapat ikut gagal karena perubahan lokal lain yang belum terkait, khususnya modul settings yang belum selesai.
- Pencegahan: periksa `git status` sebelum validasi dan commit; jalankan lint/type-check terarah bila ada perubahan pengguna lain, lalu stage file secara eksplisit agar perubahan yang tidak terkait tidak ikut ter-commit.

## 2026-09-28 — SIAKAD-05 KRS Paket dan pembelajaran agent

- Kesalahan saya: pada implementasi awal saya menganggap seluruh schema tersedia dari package root `@db/index`, padahal package database hanya mengekspor factory database. Akibatnya type-check server gagal sampai import diarahkan ke alias schema yang eksplisit.
- Pencegahan: sebelum menambah modul, periksa `package.json` exports dan pola import modul yang sudah ada; gunakan `@db/schema/<modul>` untuk schema dan jangan mengasumsikan re-export baru.
- Kesalahan saya: generator pertama belum menyimpan checkpoint student secara durable dan cabang mahasiswa tanpa kurikulum melewati update progress. Retry dapat mengulang halaman atau menggandakan failure detail.
- Pencegahan: simpan checkpoint setelah setiap row yang diproses, termasuk row gagal, dan mulai retry dengan predicate cursor `id > checkpoint`; pertahankan urutan write agar checkpoint tidak melompati row.
- Kesalahan saya: saya menjalankan script root generate migration yang memicu task Turbo interaktif tanpa TTY. Ini bukan kegagalan kode, tetapi memperlambat validasi dan sempat membuat status migration belum jelas.
- Pencegahan: untuk perubahan schema, jalankan generator Drizzle langsung dari workspace database setelah schema stabil, lalu jalankan `drizzle-kit check` dan verifikasi file migration masuk ke diff.
- Catatan implementasi: React Doctor `--scope changed` untuk SIAKAD-05 tetap 91/100; dua warning yang tampil berasal dari `curriculum-detail-page.tsx` dan `master-data-dashboard-page.tsx` lama, bukan file perubahan KRS.
- Kesalahan validasi saya: saya berhenti pada `drizzle-kit check` dan belum menjalankan apply D1 lokal setelah menambah migration, sehingga migration pending sebelumnya yang memakai `PRAGMA foreign_keys=OFF` untuk mengganti parent table dengan child rows belum terdeteksi.
- Pencegahan: setiap perubahan migration harus diuji dengan apply batch pada D1 lokal yang memiliki data FK nyata; untuk rebuild parent table di batch/transaksi gunakan `PRAGMA defer_foreign_keys=ON` lalu matikan setelah tabel pengganti selesai dibuat.
- Kesalahan validasi saya: saat memperluas akses KRS ke Superadmin, saya sempat membuat komponen halaman generator membutuhkan props tanpa memperbarui route Admin Akademik yang sudah ada; type-check langsung menangkap regresi ini.
- Pencegahan: setiap perubahan props komponen route harus dicari seluruh call site-nya dan diverifikasi dengan type-check sebelum dianggap selesai.

## 2026-09-28 — SIAKAD-06 Kelas Kuliah dan Penjadwalan

- Kesalahan implementasi saya: pada pemeriksaan awal saya hampir menganggap `drizzle-kit check` cukup, padahal database D1 lokal yang dipakai Alchemy masih belum memiliki tabel SIAKAD-06. Migration perlu diterapkan ke database target yang benar dan dicatat pada `__alchemy_migrations` sebelum pengujian runtime.
- Pencegahan: setiap tiket schema harus memverifikasi tiga hal secara terpisah: generator migration, `drizzle-kit check`, dan keberadaan tabel/riwayat migration pada D1 target yang dipakai server.
- Kesalahan implementasi saya: kontrak policy penjadwalan yang sudah ada memakai `onlineMeetingLimit`, tetapi service baru sempat merujuk nama properti yang berbeda. Type-check menangkapnya sebelum merge.
- Pencegahan: sebelum memakai policy configurable, baca interface dan adapter service yang menjadi sumber nilainya; tambahkan test default policy dan jangan mengarang nama properti baru.
- Kesalahan desain yang saya koreksi: UI awal menampilkan enum status database secara langsung. Semua status yang terlihat pengguna harus dipetakan ke label Bahasa Indonesia dan tidak boleh membocorkan istilah internal seperti `SUBMITTED` atau `PUBLISHED`.
- Pencegahan: buat map label/status di layer UI sebelum menambahkan kartu/list baru, lalu jalankan pemeriksaan copywriting bersamaan dengan React Doctor.

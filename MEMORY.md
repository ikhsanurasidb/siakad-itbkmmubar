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

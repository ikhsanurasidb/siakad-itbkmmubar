# Memory

## 2026-09-28 — SIAKAD-02 D1 migration

- Error yang terjadi: endpoint `masterData/list` dan `masterData/create` mengembalikan HTTP 500 dengan `D1_ERROR: no such table: study_programs`.
- Penyebab: migration SIAKAD-02 sudah ada di repository, tetapi belum diterapkan pada database D1 lokal/target yang dipakai server.
- Pencegahan: setelah menambah atau mengubah schema, pastikan migration diterapkan pada database target melalui alur migration Alchemy/Wrangler yang dikonfigurasi sebelum menguji endpoint atau menjalankan seed data.
- Build, type-check, lint, dan unit test tidak membuktikan bahwa tabel pada D1 target sudah tersedia. Saat ada error schema, verifikasi tabel dan riwayat migration pada database yang benar.

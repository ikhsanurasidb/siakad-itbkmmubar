# Implementation Plan SIAKAD ITB KMMU BAR

## Metadata Dokumen

| Atribut | Nilai |
|---|---|
| Status | Draft siap implementasi |
| Tanggal | 28 September 2026 |
| Repository | `siakad-itbkmmubar` |
| Arsitektur utama | React 19, TanStack Router/Query/Form, Hono, oRPC, Better Auth, Drizzle ORM, Cloudflare Workers, D1, R2, Alchemy |
| Strategi delivery | Satu tiket besar per modul, dengan checklist implementasi di dalam tiket |
| Zona waktu bisnis | `Asia/Jakarta` |
| Penyimpanan waktu | UTC epoch/timestamp, dikonversi secara eksplisit pada boundary aplikasi |

---

## 1. Tujuan Dokumen

Dokumen ini menjadi rencana implementasi teknis dan fungsional untuk membangun SIAKAD yang mencakup:

- Identitas, akses, login, role, scope, dan sesi.
- Master Data.
- Pengaturan sistem dan kebijakan akademik.
- Kurikulum.
- KRS Paket dengan extension point untuk KRS Bebas.
- Kelas Kuliah, pemetaan, jadwal, ujian, approval, dan perubahan jadwal.
- LMS sederhana.
- Presensi mahasiswa dan dosen berbasis waktu, lokasi, dan foto.
- Nilai, KHS, IPS, IPK, dan transkrip.
- Audit, notifikasi, testing, observability, serta release readiness.

Dokumen ini juga menetapkan keputusan arsitektur agar:

- Implementasi sesuai stack dan convention repository saat ini.
- Query Cloudflare D1 tetap stabil dan tidak melampaui batas platform.
- Operasi multi-statement menggunakan atomic batch atau pola kompensasi yang tepat.
- Operasi bulk dapat dilanjutkan, diulang, dan diaudit tanpa menghasilkan data ganda.
- Semua import kode aplikasi menggunakan alias.
- TypeScript check, lint, formatter, test, build, dan React Doctor menjadi quality gate wajib.

---

## 2. Kondisi Awal Repository

Repository saat ini merupakan fondasi Better-T-Stack dengan kondisi berikut:

- Frontend menggunakan React 19, Vite, TanStack Router, TanStack Query, dan TanStack Form.
- Backend menggunakan Hono dan oRPC di Cloudflare Workers.
- Database menggunakan Drizzle ORM dengan Cloudflare D1.
- Authentication menggunakan Better Auth dengan email/password dasar.
- Schema database saat ini baru berisi schema Better Auth.
- Halaman login belum memiliki implementasi UI.
- Belum ada domain schema untuk SIAKAD.
- Cloudflare R2 belum dikonfigurasi.
- Belum ada test runner dan test suite domain.
- App shell, sidebar, top bar, dan role-aware navigation belum tersedia.
- `bun run check-types` pada baseline belum lulus karena referensi komponen scaffold yang sudah tidak tersedia.
- Alias `@/*` sudah tersedia pada aplikasi web, tetapi belum distandardkan pada semua workspace.

Implikasinya, tiket fondasi harus diselesaikan sebelum modul bisnis dikembangkan agar seluruh modul memakai pola yang konsisten sejak awal.

---

## 3. Keputusan Bisnis yang Sudah Dikunci

### 3.1 Aturan perubahan maksimal H-7

Aturan H-7 menggunakan **perhitungan tanggal kalender secara inklusif**, bukan selisih tepat `7 × 24 jam`.

Contoh resmi:

- Kelas berlangsung tanggal 7.
- Tanggal terakhir perubahan adalah tanggal 1.
- Perubahan pada tanggal 1 masih diizinkan.
- Mulai tanggal 2 perubahan ditolak.

Formula domain:

```text
latestAllowedChangeDate = classLocalDate - (configuredLeadDays - 1 hari)
```

Dengan konfigurasi `configuredLeadDays = 7`:

```text
classLocalDate = 7 Oktober 2026
latestAllowedChangeDate = 1 Oktober 2026
```

Aturan teknis:

- Gunakan tanggal lokal `Asia/Jakarta`.
- Perubahan diperbolehkan sampai `23:59:59.999` pada tanggal terakhir yang diizinkan.
- Sejak `00:00:00` pada hari berikutnya, API menolak perubahan.
- Aturan berlaku untuk perubahan sesi menjadi online dan pengajuan perubahan jadwal offline.
- Tidak ada tombol bypass pada UI maupun API, termasuk untuk Superadmin.
- Apabila Superadmin perlu melakukan perubahan darurat langsung di database, tindakan berada di luar flow aplikasi dan wajib mengikuti runbook operasional serta pencatatan audit manual.
- Nilai tujuh hari dibuat configurable melalui Modul Pengaturan, tetapi default dan seed awal adalah `7`.

### 3.2 Sesi dan password

- Idle session timeout adalah **3 hari atau 72 jam**.
- Sesi menggunakan sliding inactivity expiration: aktivitas valid memperpanjang sesi, pengguna yang tidak aktif selama 72 jam wajib login kembali.
- Refresh aktivitas sesi dibatasi interval tertentu, misalnya satu jam, agar tidak menulis ke D1 pada setiap request.
- Password minimal **16 karakter**.
- Batas minimal divalidasi pada UI dan server.
- Server tetap menjadi sumber kebenaran.
- Password temporary, password reset, dan password first-login tunduk pada batas minimal yang sama.
- Password plaintext tidak pernah disimpan di database, R2, log, audit log, atau analytics.

### 3.3 Kebijakan configurable

Kebijakan operasional dan akademik dibuat configurable melalui **Modul Pengaturan**, bukan hard-coded di berbagai service.

Pengaturan minimum:

- Idle session timeout.
- Interval refresh aktivitas sesi.
- Password minimum length.
- Masa berlaku password sementara.
- Login rate limit dan lock window.
- Lead time perubahan kelas, default tujuh hari inklusif.
- Maksimum pertemuan online per kelas, default dua.
- Radius presensi offline, default 1.000 meter.
- Offset pembukaan presensi, default 30 menit setelah kelas mulai.
- Offset penutupan presensi, default 60 menit setelah kelas selesai.
- Grade scale angka ke huruf.
- Bobot mutu setiap nilai huruf.
- Metode pembulatan nilai.
- Presisi pembulatan.
- Kebijakan mata kuliah ulang untuk transkrip: nilai tertinggi atau nilai terbaru.
- Batas ukuran dan tipe file per kategori upload.
- Batas batch import/mapping yang aman.

Perubahan setting harus versioned, audited, tervalidasi, dan tidak boleh mengubah hasil transaksi historis secara retroaktif.

---

## 4. Scope dan Non-Scope

### 4.1 Dalam scope

- Seluruh modul yang tercantum pada bagian tujuan.
- Web responsive untuk role Superadmin, Admin Akademik, Kaprodi, Dosen, Mahasiswa, Admin Keuangan, dan Staf.
- In-app notification.
- Upload file private ke R2.
- Pengujian D1 dan R2 secara lokal.
- Audit perubahan data dan security event.
- CSV dan XLSX untuk import Master Data.
- Print-friendly view untuk KHS dan transkrip.

### 4.2 Di luar scope tahap ini

- KRS Bebas dan seluruh aturan pemilihannya.
- Modul Keuangan; role Admin Keuangan hanya disiapkan untuk identity dan segregation of duties.
- Editor dokumen kurikulum lengkap, version comparison, merge, dan clone.
- Integrasi video conference; kelas online hanya menyimpan link/instruksi.
- Face recognition atau analisis isi foto presensi.
- Anti-GPS-spoofing tingkat perangkat.
- Push notification, WhatsApp, SMS, atau email notification.
- Plagiarism detection.
- Native mobile application.
- Digital signature resmi untuk KHS/transkrip.

---

## 5. Prinsip Arsitektur Sistem

### 5.1 Modular monolith

Sistem dibangun sebagai modular monolith pada monorepo yang sudah ada. Setiap modul memiliki boundary schema, service, policy, router, dan UI sendiri, tetapi tetap dideploy sebagai aplikasi web dan Worker yang sama.

Keuntungan:

- Transaksi D1 lintas tabel tetap dapat dilakukan dalam satu database.
- Deployment dan local development tetap sederhana.
- Type sharing melalui oRPC tetap optimal.
- Boundary domain sudah siap jika suatu modul perlu dipisahkan di masa depan.

### 5.2 Layering

```text
Route/UI
  ↓
oRPC Router + Zod Input/Output
  ↓
Authorization Policy
  ↓
Application Service / Use Case
  ↓
Repository + Atomic Batch Adapter
  ↓
Drizzle ORM / D1 / R2
```

Ketentuan:

- Router tidak berisi business logic kompleks.
- UI tidak menentukan authorization.
- Repository tidak menentukan aturan role.
- Business service tidak mengakses environment binding secara global.
- D1, R2, clock, ID generator, dan notification publisher di-inject melalui context/service dependency.
- Semua waktu untuk business rule diperoleh dari `Clock` abstraction agar boundary time dapat dites.

### 5.3 Struktur direktori target

```text
apps/
  server/src/
    context.ts
    index.ts
    middleware/
    services/
  web/src/
    components/
    features/
      identity/
      master-data/
      settings/
      curriculum/
      study-plan/
      classes/
      lms/
      attendance/
      grades/
      notifications/
    routes/
      superadmin/
      admin-akademik/
      kaprodi/
      dosen/
      mahasiswa/
      admin-keuangan/
      staff/
packages/
  api/src/modules/
    identity/
    master-data/
    settings/
    curriculum/
    study-plan/
    classes/
    lms/
    attendance/
    grades/
  auth/src/
  db/src/
    schema/
    queries/
    migrations/
  ui/src/
```

Setiap API module minimal memiliki:

```text
router.ts
schema.ts
service.ts
repository.ts
policy.ts
errors.ts
```

Hindari barrel file yang mengekspor semua simbol. Gunakan explicit subpath import.

### 5.4 Import alias wajib

Alias target:

| Workspace | Alias lokal |
|---|---|
| Web | `@/*` |
| Server | `@server/*` |
| API | `@api/*` |
| Auth | `@auth/*` |
| Database | `@db/*` |
| UI | `@siakad-itbkmmubar/ui/*` |
| Cross-workspace | `@siakad-itbkmmubar/<package>/*` |

Aturan:

- Seluruh import TypeScript/TSX kode aplikasi wajib memakai alias.
- Relative import hanya diizinkan untuk stylesheet side-effect, generated file, atau konfigurasi tooling yang memang tidak dapat membaca path alias.
- Tambahkan `no-restricted-imports` untuk mencegah `../` pada kode aplikasi.
- Path alias harus dapat diselesaikan oleh TypeScript, Vite, tsdown, Drizzle Kit, Vitest, dan Playwright.
- Jangan membuat alias yang mengarah ke barrel file besar.
- Cross-package import wajib melewati public package export.

### 5.5 Kontrak error

Semua error API memakai bentuk stabil:

```ts
interface ApiErrorPayload {
  code: string;
  message: string;
  requestId: string;
  fieldErrors?: Record<string, string[]>;
  retryAfterSeconds?: number;
  details?: Record<string, unknown>;
}
```

Ketentuan:

- `details` tidak boleh berisi stack trace atau data sensitif di production.
- Error validasi menggunakan mapping field.
- Conflict akibat optimistic concurrency menggunakan code khusus.
- Rate limit menggunakan `retryAfterSeconds`.
- Error login tidak membocorkan apakah identifier terdaftar.

### 5.6 State machine

Entity yang memiliki workflow wajib memakai transisi eksplisit, bukan assignment status bebas.

Contoh:

```text
DRAFT → SUBMITTED → APPROVED → PUBLISHED
                  ↘ REJECTED
```

Setiap transisi harus:

- Memeriksa current status.
- Memeriksa actor dan scope.
- Memakai conditional update.
- Menaikkan `version`.
- Menulis audit log.
- Menulis notification/outbox bila diperlukan.
- Menolak stale update.

---

## 6. Strategi Cloudflare D1

### 6.1 Batas platform yang harus dianggap sebagai constraint desain

Berdasarkan dokumentasi Cloudflare D1 saat dokumen ini dibuat:

- Maksimum bound parameter per query: **100**.
- Maksimum panjang satu SQL statement: **100 KB**.
- Maksimum kolom per tabel: **100**.
- Maksimum ukuran string/BLOB/row: **2 MB**.
- Maksimum durasi query: **30 detik**.
- Maksimum argumen SQL function: **32**.
- Maksimum pola `LIKE`/`GLOB`: **50 byte**.
- Limit query per Worker invocation berbeda antara plan Free dan Paid.
- Limit individual query tetap berlaku pada setiap statement di dalam batch.

Referensi: [Cloudflare D1 Limits](https://developers.cloudflare.com/d1/platform/limits/).

### 6.2 Interactive transaction dilarang sebagai asumsi arsitektur

Kode aplikasi **tidak boleh** mengandalkan pola berikut pada D1:

```text
BEGIN
await query A
await logic aplikasi
await query B
COMMIT / ROLLBACK
```

Alasan:

- Boundary jaringan dan Worker membuat interactive transaction lintas awaited round-trip tidak aman untuk dijadikan fondasi.
- Implementasi `db.transaction()` dari ORM dapat berubah dan tidak boleh diasumsikan identik dengan transaction koneksi SQLite lokal.
- Long-running transaction bertentangan dengan karakteristik serverless D1.

### 6.3 Atomic `D1Database.batch()`

Cloudflare mendokumentasikan `D1Database.batch()` sebagai transaksi SQL: statement dijalankan berurutan dan jika satu statement gagal, seluruh urutan dibatalkan/di-roll back.

Referensi: [D1 Database batch API](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch).

Karena itu:

- Atomic multi-statement write menggunakan `db.batch()`/`D1Database.batch()` melalui adapter terpusat.
- Jangan mencampur validation read yang berubah-ubah di tengah atomic batch.
- Seluruh prepared statement harus sudah dibentuk sebelum batch dieksekusi.
- Jika hasil statement pertama dibutuhkan untuk menyusun statement kedua, gunakan salah satu:
  - Satu SQL statement dengan CTE/`INSERT ... SELECT`/`RETURNING` jika memungkinkan.
  - Generate ID di application sebelum batch.
  - Conditional write dengan `WHERE` dan cek `meta.changes`.
  - Pre-read lalu optimistic concurrency predicate.
- Semua statement penting pada batch harus diperiksa hasilnya; jangan hanya menganggap Promise resolve berarti business invariant terpenuhi.

### 6.4 Adapter transaksi aplikasi

Buat abstraction eksplisit:

```ts
interface AtomicBatchExecutor {
  execute(statements: readonly PreparedStatement[]): Promise<BatchResult>;
}
```

Tujuan:

- Menghindari pemakaian `db.transaction()` secara tidak sengaja.
- Menyatukan logging, metrics, statement count, retry classification, dan failure injection test.
- Membatasi jumlah statement per batch.
- Menjaga urutan hasil batch.
- Memungkinkan local integration test dengan D1 runtime asli.

### 6.5 Bound parameter budgeting

Tetapkan constant aplikasi:

```text
D1_HARD_MAX_BOUND_PARAMS = 100
D1_SAFE_MAX_BOUND_PARAMS = 80
```

Safety headroom dipakai untuk:

- Fixed filter parameter.
- Scope parameter.
- Future schema addition.
- Parameter audit/version predicate.

Helper chunking wajib menghitung:

```text
rowsPerStatement = floor(
  (D1_SAFE_MAX_BOUND_PARAMS - fixedParameterCount) / parametersPerRow
)
```

Contoh:

- Satu row bulk insert membutuhkan 12 parameter.
- Tidak ada fixed parameter.
- `floor(80 / 12) = 6` row per statement.
- Data 1.000 row dibagi menjadi statement kecil dan job chunk, bukan satu `INSERT` besar.

Aturan query:

- `WHERE id IN (...)` maksimal menggunakan safe parameter budget.
- ID harus di-dedupe sebelum chunking.
- Hasil setiap chunk digabung secara deterministik.
- Query yang membutuhkan ratusan/ribuan ID sebaiknya memakai staging table/job table, bukan `IN` besar.
- Jangan melakukan string interpolation untuk menghindari bound parameter; semua value tetap melalui bind.
- Pattern search divalidasi dan dipotong sesuai limit D1.

### 6.6 Statement batch budgeting

Tetapkan setting internal `d1BatchStatementLimit`, default konservatif **25 statement per batch**.

Alasan:

- Memberi ruang untuk query lain dalam Worker invocation.
- Menghindari payload batch terlalu besar.
- Mempermudah retry dan diagnosis row gagal.
- Tidak mengikat desain pada limit plan Cloudflare tertentu.

Setting dapat dinaikkan setelah load test, tetapi harus:

- Divalidasi terhadap environment/plan deployment.
- Dibatasi maksimum yang aman.
- Tidak dapat diubah oleh role selain Superadmin.
- Diukur melalui telemetry.

### 6.7 Pola write yang diwajibkan

#### Conditional state transition

```sql
UPDATE schedule_drafts
SET status = ?, version = version + 1, updated_at = ?
WHERE id = ? AND status = ? AND version = ?;
```

Jika `changes !== 1`, kembalikan conflict/stale state.

#### Unique constraint sebagai penjaga terakhir

Contoh:

- Satu KRS per mahasiswa dan periode.
- Satu presensi per participant dan pertemuan.
- Satu enrollment per mahasiswa dan kelas.
- Satu username/identifier.
- Satu idempotency key per operation scope.

#### Atomic counter

Sequence identifier staf memakai satu upsert atomic dengan `RETURNING`, bukan read-counter lalu update terpisah.

#### Transactional outbox

Mutation domain, audit log, dan outbox event dimasukkan dalam atomic batch yang sama.

Contoh publish jadwal:

1. Conditional update draft menjadi published.
2. Insert schedule revision.
3. Insert audit log.
4. Insert notification/outbox records.

Jika satu gagal, seluruh batch gagal.

### 6.8 Operasi yang terlalu besar untuk satu transaksi

Import, generate KRS, mapping kelas, generate ALPA, dan publish massal tidak dipaksa menjadi satu transaksi besar.

Gunakan durable job pattern:

- `jobId` dan idempotency key.
- Status `PENDING`, `RUNNING`, `COMPLETED`, `PARTIAL_FAILED`, `FAILED`, `CANCELLED`.
- Cursor/checkpoint terakhir.
- Total, processed, succeeded, warning, failed.
- Lease owner dan lease expiry untuk mencegah dua worker memproses chunk sama.
- Setiap chunk menggunakan atomic batch.
- Row hasil menyimpan success/error sendiri.
- Retry melanjutkan dari checkpoint.
- Unique constraint mencegah duplicate output.
- UI membaca progress dari job table.

Konsistensi proses besar adalah **chunk-atomic dan resumable**, bukan all-or-nothing seluruh file.

### 6.9 D1 dan R2 tidak dapat menjadi satu transaksi

Operasi D1 + R2 menggunakan saga/compensation.

Pola upload:

1. Validasi metadata dan authorization.
2. Generate object key acak.
3. Upload ke R2 dengan status temporary/pending.
4. Insert metadata D1 melalui atomic batch bersama domain mutation/audit.
5. Jika D1 gagal, hapus object R2 sebagai kompensasi.
6. Jika cleanup gagal, catat orphan cleanup job.
7. Setelah metadata committed, object dianggap active.

Pola replacement:

1. Upload object baru.
2. Atomic update metadata D1 dengan optimistic version.
3. Setelah commit, hapus object lama secara asynchronous.
4. Cleanup object lama harus idempotent.

Pola delete:

- Soft-delete metadata D1 terlebih dahulu.
- Object tidak lagi dapat diakses.
- Outbox cleanup menghapus R2.
- Jika penghapusan R2 gagal, retry tanpa menghidupkan kembali akses file.

### 6.10 Konsistensi read

- Selama read replication belum digunakan, seluruh query berjalan terhadap primary sesuai binding D1 standar.
- Jika read replication diaktifkan kemudian, gunakan D1 Sessions API dan bookmark untuk menjamin sequential consistency/read-your-own-writes.
- Mutation response sebaiknya mengembalikan representation yang diperlukan UI agar tidak selalu membutuhkan immediate refetch.
- Read setelah mutation yang wajib latest menggunakan `first-primary` atau bookmark sebelumnya.

Referensi: [D1 Sessions dan read replication](https://developers.cloudflare.com/d1/best-practices/read-replication/).

### 6.11 Query performance

Aturan wajib:

- Tidak memakai `SELECT *` pada query production.
- Server-side pagination.
- Gunakan cursor pagination untuk tabel besar; offset hanya untuk dataset kecil/admin sederhana.
- Hindari N+1 query; lakukan join terkontrol atau bulk fetch yang di-chunk.
- Composite index mengikuti filter dan sort aktual.
- Foreign key/filter/status/date yang sering dipakai harus memiliki index.
- Search memakai normalized columns dan pola yang dibatasi.
- Query penting diperiksa menggunakan `EXPLAIN QUERY PLAN` pada integration/performance test.
- Response list tidak menyertakan blob atau payload JSON besar yang tidak dipakai.
- Audit before/after menyimpan diff relevan, bukan menyalin dokumen/file besar.
- Semua list memiliki maximum page size.

### 6.12 Test D1 wajib

- Test memakai Workers runtime lokal dan binding D1, bukan SQLite Node biasa saja.
- Migration production diterapkan pada test database.
- Test atomic rollback ketika statement tengah batch gagal.
- Test optimistic concurrency dua writer.
- Test duplicate idempotency key.
- Test bound parameter chunking pada 80, 81, 100, dan >100 parameter.
- Test job resume setelah chunk gagal.
- Test query plan pada query kritis.
- Test timeouts dan mapping volume representatif.
- Test compensation D1/R2 dengan injected failure.

---

## 7. Cloudflare R2 dan File Security

### 7.1 Bucket dan key

- Gunakan bucket private.
- Object key tidak mengandung NIM, nama, email, atau data personal.
- Gunakan namespace:

```text
curriculum/<curriculumId>/<uuid>
imports/<importJobId>/<uuid>
lms/materials/<materialId>/<uuid>
lms/assignments/<assignmentId>/<uuid>
lms/submissions/<submissionId>/<uuid>
attendance/<attendanceRecordId>/<uuid>
```

### 7.2 Metadata D1

- Object key.
- Original filename yang sudah disanitasi.
- MIME terdeteksi.
- Declared MIME.
- Size.
- Checksum.
- Owner/domain reference.
- Status `PENDING | ACTIVE | DELETED | ORPHANED`.
- Created by/at.

### 7.3 Access

- Jangan menyimpan public URL.
- Preview/download melalui endpoint yang melakukan authorization ulang.
- Response memakai content disposition yang sesuai.
- Photo evidence tidak di-load di list; hanya setelah tombol preview.
- File type dan size divalidasi sebelum dan selama upload.
- Extension file tidak dianggap sebagai MIME source of truth.
- Range request dapat ditambahkan jika file material besar membutuhkan streaming.

---

## 8. Authorization dan Role Model

### 8.1 Role sistem

- `SUPERADMIN`
- `ADMIN_AKADEMIK`
- `ADMIN_KEUANGAN`
- `KAPRODI`
- `DOSEN`
- `MAHASISWA`
- `STAFF`

Asumsi kerja: istilah Operator Akademik pada requirements merujuk pada `ADMIN_AKADEMIK`. Jika kelak dipisah, permission catalog tetap memungkinkan role baru tanpa mengubah business service utama.

### 8.2 Policy layers

Setiap procedure dilindungi oleh kombinasi:

- Authenticated session.
- Password-change-required guard.
- Active account guard.
- Active role.
- Permission.
- Prodi scope.
- Assignment, misalnya dosen pengampu.
- Ownership, misalnya mahasiswa pemilik KRS.
- Process state.
- Optimistic entity version.

### 8.3 Segregation of duties

- `ADMIN_AKADEMIK` dan `ADMIN_KEUANGAN` tidak boleh dimiliki user yang sama.
- Conflict matrix disimpan pada database dan divalidasi saat assignment role.
- Kaprodi hanya dapat diberikan kepada user yang memiliki profile Dosen.
- Superadmin dapat mengakses seluruh menu tetapi seluruh mutation tetap diaudit.

### 8.4 Route per role

| Role | Root path |
|---|---|
| Superadmin | `/superadmin/*` |
| Admin Akademik | `/admin-akademik/*` |
| Kaprodi | `/kaprodi/*` |
| Dosen | `/dosen/*` |
| Mahasiswa | `/mahasiswa/*` |
| Admin Keuangan | `/admin-keuangan/*` |
| Staff | `/staff/*` |

Menu domain bersama wajib memiliki path role-specific. Komponen presentasional boleh digunakan ulang, tetapi route loader, action, copy, dan available action disusun sesuai role.

---

## 9. UI, Form, dan Design System

### 9.1 Warna

- Navy: primary/action/navigation.
- White: base background.
- Emas kekuningan: accent/highlight.
- Hijau daun: success/approved/active.
- Merah: error/destructive/rejected.
- Abu/muted: helper text, hint, metadata.

### 9.2 Form validation

- Gunakan TanStack Form dan Zod.
- Error tidak ditampilkan sebelum submit pertama.
- Setelah submit pertama, field yang disentuh dapat divalidasi saat change/blur.
- Error harus spesifik dan membantu.
- Helper text menjelaskan format yang diterima.
- Server validation error dipetakan kembali ke field.
- Submit button memiliki loading dan mencegah double submit.
- Form mutation yang sensitif memakai idempotency key.

### 9.3 shadcn

- Cari primitive/block shadcn terlebih dahulu.
- Jika tidak tersedia, cek registry yang relevan.
- Custom component dibangun di atas primitive shadcn dan ditempatkan pada package UI bila benar-benar reusable.
- Jangan menyalin komponen besar ke banyak feature.

### 9.4 Accessibility

- Semantic HTML.
- Label terhubung ke input.
- Focus state terlihat.
- Keyboard navigation untuk sidebar, dialog, table action, dan upload.
- Status tidak dibedakan berdasarkan warna saja.
- Error summary dapat dibaca screen reader.
- Modal mengelola focus dengan benar.
- Foto evidence mempunyai alt text generik yang tidak membocorkan PII.

---

## 10. Model Audit, Notifikasi, dan Idempotency

### 10.1 Audit log

Field minimum:

- `id`
- `requestId`
- `actorUserId`
- `activeRole`
- `scopeType/scopeId`
- `action`
- `entityType/entityId`
- `beforeDiff`
- `afterDiff`
- `reason`
- `ipAddress`
- `userAgent`
- `createdAt`

Password, token, session token, dan isi file tidak pernah masuk audit.

### 10.2 Notification

Tahap pertama hanya in-app:

- Notification rows dibuat melalui outbox/domain mutation.
- Unread counter.
- List dengan pagination.
- Mark one/read all.
- Link menuju route yang sesuai active role.
- Notification payload tidak menjadi sumber kebenaran authorization.

### 10.3 Idempotency

Gunakan tabel `idempotency_keys` untuk mutation yang rentan retry:

- Provisioning.
- Import commit.
- Generate KRS.
- Mapping kelas.
- Publish jadwal.
- Upload metadata commit.
- Submit presensi.
- Publish nilai.

Simpan operation scope, actor, request hash, result reference, status, dan expiry. Request dengan key sama tetapi payload berbeda harus ditolak.

---

## 11. Roadmap Tiket

| ID | Modul | Ukuran | Dependency utama |
|---|---|---:|---|
| SIAKAD-00 | Platform Foundation dan Engineering Guardrails | XL | - |
| SIAKAD-01 | Identitas, Akses, Login, dan Sesi | XL | 00 |
| SIAKAD-02 | Master Data dan Import | XL | 00, kontrak IAM 01 |
| SIAKAD-03 | Pengaturan Sistem dan Kebijakan Akademik | L/XL | 00, 01 |
| SIAKAD-04 | Kurikulum | L/XL | 01, 02, 03 |
| SIAKAD-05 | KRS Paket | L/XL | 01–04 |
| SIAKAD-06 | Kelas Kuliah dan Penjadwalan | XL | 01–05 |
| SIAKAD-07 | LMS Sederhana | XL | 01, 06 |
| SIAKAD-08 | Presensi Evidence-Based | XL | 01–03, 06, 07 |
| SIAKAD-09 | Nilai, KHS, dan Transkrip | XL | 01–06 |
| SIAKAD-10 | Integration dan Release Readiness | XL | 01–09 |

---

## 12. Detail Implementasi per Tiket

## SIAKAD-00 — Platform Foundation dan Engineering Guardrails

### Outcome

Repository kembali buildable dan seluruh modul berikutnya memiliki fondasi arsitektur, UI, database, testing, dan quality gate yang sama.

### Checklist implementasi

#### Repository health

- Perbaiki seluruh missing import dari scaffold.
- Pastikan route tree dapat di-generate.
- Pastikan web dan Worker dapat start secara lokal.
- Pastikan build seluruh workspace lulus.

#### Import alias

- Tambahkan alias per workspace sesuai bagian arsitektur.
- Sinkronkan `tsconfig`, Vite, tsdown, test config, dan package exports.
- Migrasikan semua import project code ke alias.
- Tambahkan lint rule deep-relative import.
- Tambahkan test/build case yang membuktikan alias bekerja pada runtime bundle, bukan hanya TypeScript.

#### API foundation

- Standard error contract.
- Request ID middleware.
- Structured logger.
- Context berisi database, auth, storage, clock, request metadata, dan active-role resolver.
- Base policy helpers.
- Pagination/cursor schema.
- Idempotency middleware/helper.
- Safe result mapping untuk D1.

#### D1 foundation

- Buat `AtomicBatchExecutor`.
- Buat bound parameter chunk helper.
- Buat batch statement chunk helper.
- Buat optimistic concurrency helper.
- Buat typed repository result dan conflict error.
- Tambahkan migration conventions dan naming conventions.
- Tambahkan local D1 test setup yang memakai migration production.
- Tambahkan failure injection untuk statement batch.

#### R2 foundation

- Tambahkan Alchemy R2 resource dan binding.
- Buat `FileStorage` interface.
- Implementasikan R2 adapter dan in-runtime local testing.
- Implementasikan upload metadata contract, checksum, MIME/size validation, dan compensation helper.

#### Cross-cutting schema

- `audit_logs`
- `notifications`
- `outbox_events`
- `idempotency_keys`
- `file_objects`
- `background_jobs`
- Index sesuai lookup actor, entity, unread status, job status, dan idempotency scope.

#### UI foundation

- Design token warna.
- Sidebar responsive.
- Top bar.
- Breadcrumb.
- Role switcher placeholder.
- Notification center placeholder.
- Page header.
- Data table.
- Pagination.
- Filter bar.
- Empty/error/forbidden/loading states.
- Confirmation dialog.
- Form field wrapper dengan delayed validation.
- File upload component.
- Preview file/image dialog.

#### Test and CI scripts

- Unit test runner.
- Workers Vitest integration.
- React component test.
- Playwright setup.
- `test`, `test:unit`, `test:integration`, `test:e2e`, dan `verify` scripts.
- Test DB reset dan seed.
- Test R2 reset.

### Acceptance criteria

- Fresh clone dapat install, migrate, seed, start, test, typecheck, dan build.
- `bun run check-types` lulus.
- Tidak ada deep relative import pada application TS/TSX.
- D1 atomic batch rollback terbukti melalui integration test.
- D1 >100 parameter tidak pernah dibuat karena helper melakukan chunking.
- R2 upload/download/delete berhasil pada local Worker runtime.
- App shell responsive dan keyboard accessible.
- Semua quality gate global lulus.

---

## SIAKAD-01 — Identitas, Akses, Login, dan Sesi

### Outcome

Seluruh pengguna dapat diprovision, login dengan identifier resmi, mengganti temporary password, dan hanya mengakses data sesuai role/scope.

### Schema

- Extend Better Auth user dengan username immutable.
- `identity_accounts`
- `roles`
- `permissions`
- `role_permissions`
- `user_roles`
- `user_scopes`
- `role_conflicts`
- `identifier_sequences`
- `program_heads`
- `security_events`
- Better Auth rate limit table bila database storage digunakan.

### Identifier

- Mahasiswa memakai NIM.
- Dosen memakai kode dosen.
- Kaprodi tetap memakai akun Dosen.
- Staf memakai `{PREFIX3}{YYYYMMDD}{SEQ3}`.
- Prefix role tiga huruf uppercase.
- Sequence dibuat dengan atomic upsert/returning.
- Identifier dinormalisasi sebelum uniqueness check.
- Username Better Auth immutable.

### Provisioning

- Manual satu akun.
- Bulk provisioning dengan preview.
- Integrasi event dari Master Data import.
- Admin Akademik hanya dapat membuat akun Mahasiswa dan Dosen.
- Superadmin membuat admin/staf.
- Dosen di-assign sebagai Kaprodi; tidak dibuat akun Kaprodi terpisah.
- Temporary password random dan minimal 16 karakter.
- Plaintext ditampilkan/diunduh satu kali.
- Temporary password expiry berasal dari Modul Pengaturan.
- Provisioning idempotent berdasarkan master record + identity type.

### Authentication

- Gunakan Better Auth username plugin server dan client.
- Login dengan identifier + password.
- Generic invalid credential message.
- Inactive account message sesuai requirements setelah kredensial diverifikasi aman.
- Rate limit disimpan D1 dan menggunakan trusted `cf-connecting-ip`.
- Response 429 membawa retry-after.
- Username/email tidak dapat dienumerasi dari error maupun response timing yang mudah dibedakan.

### First login

- Account ditandai `mustChangePassword`.
- Setelah temporary credential valid, sesi hanya mempunyai capability `CHANGE_PASSWORD`.
- Seluruh business route menolak limited session.
- Password baru minimal 16 karakter.
- Setelah berhasil, limited session dicabut dan sesi normal diterbitkan.
- Temporary credential tidak dapat digunakan lagi.

### Session policy

- `expiresIn = 72 jam` idle.
- Sliding refresh hanya setelah interval setting, default satu jam.
- Aktivitas anonim tidak memperpanjang sesi.
- Failed authorization tidak dianggap sebagai business activity untuk tujuan refresh kecuali session validation memang dilakukan.
- Logout current device.
- List active sessions.
- Revoke one.
- Revoke other sessions.
- Revoke all sessions.
- Password reset/deactivation mencabut semua sesi.
- UI menampilkan device/user-agent, created time, last activity, masked IP, dan current session marker.

### Role dan scope

- Active role disimpan pada session preference yang tervalidasi terhadap assignment aktif.
- Kaprodi mempunyai Prodi scope dan periode assignment.
- Dosen memakai assignment kelas.
- Mahasiswa memakai ownership.
- Superadmin bypass tetap menulis audit.
- Conflict `ADMIN_AKADEMIK` + `ADMIN_KEUANGAN` dicegah sebelum atomic batch assignment.

### API group

- `identity.accounts.list/detail/create/activate/deactivate`
- `identity.accounts.bulkPreview/bulkCommit`
- `identity.accounts.resetPassword`
- `identity.roles.list/assign/revoke`
- `identity.scopes.assign/revoke`
- `identity.programHeads.assign/end`
- `identity.sessions.list/revoke/revokeOthers/revokeAll`
- Better Auth username sign-in dan password endpoint.

### UI routes

- `/login`
- `/first-login/change-password`
- `/<role>/akun/keamanan`
- `/admin-akademik/identitas/akun`
- `/superadmin/identitas/akun`
- `/superadmin/identitas/roles`
- `/superadmin/identitas/scopes`

### Atomicity/query plan

- Create account domain metadata, role assignment, audit, dan provisioning result dalam atomic batch setelah Better Auth credential creation berhasil.
- Jika domain batch gagal setelah credential dibuat, jalankan compensation delete/disable credential.
- Reset password menggunakan idempotency key dan revoke session.
- Role assignment memakai conditional checks + unique constraint.
- Bulk provisioning memakai durable job dan chunk atomic, bukan satu batch seluruh file.

### Test minimum

- Login NIM/kode dosen.
- Generic invalid credential.
- Inactive account.
- First-login limited capability.
- Password 15 ditolak, 16 diterima.
- Idle timeout sebelum/tepat/setelah 72 jam.
- Session refresh throttling.
- Rate limit boundary dan countdown.
- Role conflict.
- Kaprodi bukan Dosen ditolak.
- Scope lintas Prodi ditolak.
- Reset/deactivate revoke all.
- Concurrent sequence identifier menghasilkan kode unik.

### Acceptance criteria

- Seluruh flow requirements Identitas & Akses dan Login terpenuhi.
- Tidak ada route bisnis yang dapat dibuka dengan `mustChangePassword=true`.
- Session tidak aktif 72 jam selalu ditolak.
- Semua role/scope enforcement ada di API.
- Temporary password tidak tersimpan plaintext.

---

## SIAKAD-02 — Master Data dan Import Massal

### Outcome

Sistem mempunyai satu sumber data resmi dan tervalidasi untuk identitas akademik serta referensi operasional.

### Schema

- `study_programs`
- `cohorts`
- `students`
- `lecturers`
- `staff_profiles`
- `rooms`
- `courses`
- `academic_years`
- `academic_periods`
- `import_jobs`
- `import_rows`
- `identifier_usages`

### Field penting

- Mahasiswa: NIM, nama, Prodi, angkatan, email, telepon, status akademik.
- Dosen: kode dosen, NIDN, NUPTK, nama, email, telepon, status.
- Prodi: kode, nama, jenjang, status.
- Angkatan: tahun masuk, Prodi, status.
- Ruang: kode, nama, kapasitas, latitude, longitude, status.
- Mata kuliah: kode, nama, SKS, default semester, owning Prodi, status.
- Periode: tahun akademik, term, tanggal mulai/akhir, status.

### Validation

- Normalize whitespace dan case.
- Unique index pada identifier resmi.
- Latitude `-90..90`.
- Longitude `-180..180`.
- Kapasitas ruang positif.
- SKS dalam rentang yang dikonfigurasi.
- Referensi harus aktif pada saat create.
- Data referenced tidak dapat di-hard-delete.
- Identifier locked setelah masuk transaksi akademik.

### CRUD

- Server-side search/filter/sort/pagination.
- Histori koreksi field.
- Archive/reactivate.
- Detail usage untuk menjelaskan mengapa identifier terkunci.
- Export data terfilter.

### Import flow

1. Pilih entity type.
2. Download template versioned.
3. Upload CSV/XLSX.
4. Simpan original file private di R2.
5. Parse streaming/chunk agar tidak menampung seluruh file besar di memory.
6. Stage row ke `import_rows` dengan nomor baris.
7. Validate format, required, reference, duplicate file, duplicate DB.
8. Status `VALID`, `WARNING`, atau `INVALID`.
9. Preview dan filter berdasarkan status.
10. Download validation report.
11. Confirm commit.
12. Commit chunk-safe.
13. Simpan result setiap row.
14. Emit provisioning outbox untuk Mahasiswa/Dosen yang membutuhkan akun.

### D1 strategy

- Tidak membuat `IN` berisi seluruh NIM file.
- Dedup di memory per parsing chunk dan staging unique index.
- Lookup existing identifier memakai chunk maksimal safe parameter budget.
- Insert staging dan commit memakai batch maksimal setting.
- Import job resumable dari checkpoint.
- Satu row gagal tidak membatalkan seluruh file; hanya chunk yang diulang.
- Unique constraint menjamin retry tidak menggandakan master row.
- Validation summary dihitung incremental, bukan scan penuh berulang.

### UI routes

- `/admin-akademik/master-data/mahasiswa`
- `/admin-akademik/master-data/dosen`
- `/admin-akademik/master-data/prodi`
- `/admin-akademik/master-data/angkatan`
- `/admin-akademik/master-data/ruang`
- `/admin-akademik/master-data/mata-kuliah`
- `/admin-akademik/master-data/semester`
- `/admin-akademik/master-data/import`
- Versi Superadmin di `/superadmin/master-data/*`.

### Test minimum

- Duplicate antarbaris dan database.
- Header/template version salah.
- Invalid reference.
- Coordinate boundary.
- Identifier locked.
- Import failure di tengah chunk dan resume.
- Recommit idempotent.
- File besar melampaui satu Worker invocation.
- Parameter chunk boundary.
- Provisioning outbox hanya satu per record.

### Acceptance criteria

- Semua flow input manual/import requirements terpenuhi.
- Baris valid/warning/invalid terlihat jelas.
- Error field hanya tampil setelah submit.
- Import dapat dilanjutkan setelah failure tanpa duplicate.
- Ruang selalu mempunyai latitude/longitude valid.
- Koreksi dan penggunaan identifier dapat diaudit.

---

## SIAKAD-03 — Pengaturan Sistem dan Kebijakan Akademik

### Outcome

Semua kebijakan yang dapat berubah dikelola terpusat, typed, versioned, scoped, dan dapat diubah melalui menu Pengaturan.

### Schema

- `setting_definitions`
- `setting_values`
- `setting_versions`
- `grade_scale_sets`
- `grade_scale_entries`
- `policy_activation_histories`

Scope setting:

- `SYSTEM`
- `STUDY_PROGRAM`
- Opsional `ACADEMIC_PERIOD` untuk policy yang perlu dibekukan per semester.

### Typed settings

Jangan menyebarkan akses raw key/value. Buat typed configuration service:

- `getSecurityPolicy()`
- `getSchedulingPolicy(scope)`
- `getAttendancePolicy(scope)`
- `getGradingPolicy(scope, period)`
- `getFilePolicy(category)`
- `getBatchPolicy()`

Setiap config type memiliki Zod schema, default, min/max, dan description.

### Menu

- `/superadmin/pengaturan/keamanan`
- `/superadmin/pengaturan/penjadwalan`
- `/superadmin/pengaturan/presensi`
- `/superadmin/pengaturan/nilai`
- `/superadmin/pengaturan/file`
- `/superadmin/pengaturan/database-job`
- Kaprodi dapat melihat effective setting Prodi; override hanya diberikan jika permission khusus disetujui.

### Versioning/effectivity

- Perubahan membuat versi baru.
- Versi mempunyai `effectiveFrom`.
- Satu versi aktif per scope dan waktu.
- Grade policy dan scale yang dipakai transaksi disnapshot/reference version ID.
- Attendance record menyimpan radius dan time-window policy version yang digunakan.
- Schedule change menyimpan lead-days policy version.
- Perubahan setting tidak menghitung ulang transaksi historis.
- Rollback dilakukan dengan membuat versi baru berdasarkan versi lama, bukan menghapus history.

### Validation

- Password minimum tidak boleh di bawah 16 tanpa perubahan requirement baru.
- Idle timeout default 72 jam dan memiliki batas aman.
- Lead time default 7 dan minimal 1.
- Online meeting limit default 2 dan tidak negatif.
- Radius positif.
- Attendance open/close offset tidak menghasilkan window terbalik.
- Grade range tidak overlap, gap ditolak saat aktivasi.
- Bobot mutu valid dan konsisten.
- Retake policy enum `HIGHEST | LATEST`.

### D1 strategy

- Publish version + deactivate previous + audit dilakukan dalam atomic batch.
- Conditional update memakai version.
- Setting dibaca sekali per request/use case, bukan pada setiap row loop.
- Cache in-memory per invocation boleh digunakan; tidak boleh menjadi sumber kebenaran lintas invocation.
- Effective setting query mempunyai composite index `(key, scope_type, scope_id, effective_from)`.

### Test minimum

- Invalid range/overlap.
- Concurrent setting update.
- Effective date boundary.
- Scope precedence system vs Prodi.
- Historic snapshot tidak berubah setelah setting baru aktif.
- Unauthorized setting mutation.
- Rollback version.

### Acceptance criteria

- Seluruh kebijakan pada keputusan bisnis dapat diubah melalui UI yang sesuai.
- Perubahan selalu versioned dan audited.
- Tidak ada service domain membaca raw setting tanpa typed configuration service.
- Default seed: idle 72 jam, password min 16, H-7 inklusif, online max 2, radius 1 km, open +30, close +60.

---

## SIAKAD-04 — Kurikulum per Prodi dan Angkatan

### Outcome

Kaprodi dapat mengunggah dokumen kurikulum, menyusun struktur mata kuliah semester 1–8, dan mengatur komponen nilai.

### Schema

- `curricula`
- `curriculum_documents`
- `curriculum_courses`
- `course_assessment_defaults`
- `curriculum_assessment_overrides`

### Workflow

```text
DRAFT → ACTIVE → ARCHIVED
```

- Upload dokumen membuat draft curriculum record.
- Satu kurikulum terhubung ke Prodi dan angkatan.
- Struktur semester 1–8.
- Mata kuliah dapat wajib/pilihan untuk future compatibility, walaupun KRS Bebas belum aktif.
- Komponen nilai dapat memakai default mata kuliah lalu dioverride.
- Aktivasi hanya jika struktur dan policy valid.

### File

- Dokumen private di R2.
- Allowlist tipe file diambil dari Modul Pengaturan.
- Download terotorisasi.
- Replacement memakai saga R2/D1.

### Grade component rules

- Draft boleh mempunyai total bobot belum 100%.
- Aktivasi ditolak jika total bukan tepat 100%.
- Bobot disimpan dalam integer scale.
- Perubahan kurikulum tidak mengubah snapshot komponen kelas existing.

### Authorization

- Kaprodi hanya Prodi assignment aktif.
- Admin Akademik read access.
- Superadmin full access.
- Mahasiswa/Dosen tidak mengakses draft.

### D1 strategy

- Aktivasi kurikulum, deactivation versi aktif lama, audit, dan outbox dilakukan atomic batch.
- Struktur bulk disimpan per safe chunk; final activation menjadi gate konsistensi.
- Unique index mencegah mata kuliah duplicate pada curriculum/semester.

### UI routes

- `/kaprodi/kurikulum`
- `/kaprodi/kurikulum/$curriculumId`
- `/kaprodi/kurikulum/$curriculumId/struktur`
- `/kaprodi/kurikulum/$curriculumId/komponen-nilai`
- `/superadmin/kurikulum/*`

### Test dan acceptance criteria

- Semester di luar 1–8 ditolak.
- Kaprodi lintas Prodi ditolak.
- Dokumen tidak mempunyai public URL.
- Total bobot tidak valid mencegah aktivasi.
- Hanya satu kurikulum efektif untuk kombinasi policy yang disepakati.
- KRS dapat menemukan kurikulum aktif secara deterministik.

---

## SIAKAD-05 — KRS Paket

### Outcome

Admin Akademik dapat menghasilkan KRS Paket dan memfinalisasinya sebagai input Kelas Kuliah, sementara schema tetap siap untuk KRS Bebas.

### Schema

- `study_plans`
- `study_plan_items`
- `study_plan_histories`
- `study_plan_generation_jobs`

Field `mode`:

- `PACKAGE`
- `FREE`, reserved dan belum mempunyai UI/use case.

Status:

```text
DRAFT → FINAL
FINAL → DRAFT hanya melalui reopen dengan alasan
```

### Generation flow

1. Pilih periode.
2. Ambil mahasiswa aktif scoped Prodi/angkatan.
3. Resolve kurikulum aktif.
4. Resolve semester kurikulum.
5. Generate draft secara asynchronous/chunked.
6. Tampilkan progress dan row failure.
7. Review total mata kuliah/SKS.
8. Finalisasi.
9. Mahasiswa melihat read-only.

### Extension point

- `StudyPlanStrategy` interface.
- Implementasi saat ini `PackageStudyPlanStrategy`.
- Schema item tidak bergantung pada asumsi bahwa seluruh item selalu auto-generated.
- Tidak membuat prasyarat, kuota, approval, atau selection UI KRS Bebas.

### Rules

- Satu KRS per mahasiswa/periode.
- Generate ulang idempotent.
- Mahasiswa tidak dapat mutation KRS Paket.
- KRS final immutable.
- Reopen wajib alasan dan membatalkan downstream draft mapping yang belum published sesuai policy.
- Hanya `FINAL` yang dipakai mapping.

### D1 strategy

- Generation memakai job + checkpoint.
- KRS dan items per mahasiswa dimasukkan dalam atomic batch kecil.
- Unique constraint menangani retry.
- Finalisasi massal dilakukan per chunk dan mencatat hasil.
- Tidak memuat seluruh mahasiswa/kurikulum ke satu `IN` query.

### UI routes

- `/admin-akademik/krs`
- `/admin-akademik/krs/generate`
- `/admin-akademik/krs/$studyPlanId`
- `/mahasiswa/krs`
- `/kaprodi/krs`

### Test dan acceptance criteria

- Generate dua kali tidak duplicate.
- Kurikulum tidak ditemukan menghasilkan row failure yang jelas.
- Mahasiswa nonaktif dilewati.
- Draft tidak masuk mapping.
- Reopen audited.
- Authorization dan ownership lulus negative tests.
- Parameter/job chunking diuji dengan data besar.

---

## SIAKAD-06 — Kelas Kuliah dan Penjadwalan

### Outcome

Kelas terbentuk dari KRS final, konflik dapat diselesaikan, Kaprodi melakukan approval, jadwal dipublikasikan, dan perubahan pertemuan mengikuti H-7.

### Schema

- `class_mapping_jobs`
- `class_sections`
- `class_enrollments`
- `teaching_assignments`
- `lecturer_availabilities`
- `schedule_drafts`
- `schedule_slots`
- `exam_schedules`
- `schedule_conflicts`
- `schedule_approvals`
- `class_meetings`
- `schedule_change_requests`
- `schedule_revisions`

### Mapping

- Input hanya KRS final.
- Kelompok berdasarkan Prodi dan mata kuliah.
- Bagi mahasiswa menurut configured class capacity dan kapasitas ruang.
- Gunakan kandidat dosen dan availability.
- Assign ruang/slot.
- Assignment yang tidak dapat diselesaikan tetap muncul sebagai blocking conflict, bukan diam-diam diabaikan.
- Job progress persisted dan dapat dilanjutkan.

### Conflict engine

Blocking conflict minimum:

- Mahasiswa overlap.
- Dosen overlap.
- Ruang overlap.
- Ujian overlap.
- Kapasitas ruang kurang.
- Dosen/ruang nonaktif.
- Jadwal di luar periode.
- Meeting tanpa modality requirement yang lengkap.

Conflict menyimpan type, entities, time range, severity, resolution, resolvedBy, resolvedAt.

### Approval state

```text
DRAFT → SUBMITTED → APPROVED → PUBLISHED
                  ↘ REJECTED → DRAFT
```

- Submit ditolak jika blocking conflict tersisa.
- Kaprodi hanya Prodi sendiri.
- Reject wajib alasan.
- Publish hanya dari approved state.
- Published schedule immutable; perubahan menggunakan revision/request.

### Online meeting

- Default meeting offline.
- Maksimum online meeting default dua per kelas, dibaca dari policy snapshot.
- Dosen dapat mengubah offline ke online tanpa approval Admin Akademik jika belum melewati cutoff.
- Online meeting memerlukan link/instruksi.
- Perubahan ketiga ditolak.
- Perubahan online menulis revision, audit, dan notification.

### Offline schedule change

- Dosen mengajukan waktu/ruang baru.
- Harus belum melewati cutoff H-7 inklusif.
- Membutuhkan approval Admin Akademik.
- Jadwal lama tetap aktif selama pending.
- Approval melakukan conflict check terbaru.
- Approval atomically menerbitkan revision baru, menutup revision lama, dan mengirim notification.

### Cutoff H-7 exact behavior

Helper domain tunggal:

```text
canChangeMeeting(classStartAt, requestAt, policy, timezone)
```

Test resmi:

- Kelas 7 Oktober, request 1 Oktober 23:59:59.999 → boleh.
- Kelas 7 Oktober, request 2 Oktober 00:00:00 → ditolak.
- Kelas melewati bulan/tahun → hasil tetap benar.
- DST tidak relevan untuk Jakarta, tetapi logic tetap memakai local date API, bukan millisecond subtraction.
- Superadmin via API juga ditolak setelah cutoff.

### D1 strategy

- Mapping adalah durable job per course group/chunk.
- Enrollment insert memakai unique constraint.
- Conflict generation dilakukan per class/time window dengan indexed query, bukan Cartesian scan seluruh semester.
- Submission/approval/publish memakai conditional version update.
- Publish domain mutation + revision + audit + notification dilakukan dalam atomic batch.
- Conflict recheck wajib dilakukan segera sebelum approval batch; hasil dilindungi version predicate.

### UI routes

- `/admin-akademik/kelas`
- `/admin-akademik/kelas/pemetaan`
- `/admin-akademik/jadwal/draft/$draftId`
- `/admin-akademik/jadwal/perubahan`
- `/kaprodi/jadwal/persetujuan`
- `/dosen/jadwal`
- `/mahasiswa/jadwal`

### Test dan acceptance criteria

- Mapping hanya KRS final.
- Retry tidak duplicate enrollment.
- Progress bertahan setelah refresh.
- Semua overlap boundary dites.
- Blocking conflict mencegah submit.
- Kaprodi lintas Prodi ditolak.
- Online meeting ketiga ditolak.
- H-7 mengikuti contoh tanggal 7/1/2.
- Offline change belum berlaku sebelum approve.
- Publish mengirim notifikasi mahasiswa/dosen.

---

## SIAKAD-07 — LMS Sederhana

### Outcome

Dosen dan mahasiswa mempunyai ruang pembelajaran per kelas dan sesi untuk materi, tugas, submission, forum, dan akses presensi.

### Schema

- `learning_materials`
- `material_files`
- `assignments`
- `assignment_files`
- `assignment_submissions`
- `submission_files`
- `forum_threads`
- `forum_posts`
- `forum_attachments`

### Materi

- Per kelas/pertemuan.
- Draft/published.
- Dosen pengampu create/edit/publish.
- Mahasiswa hanya published.
- Attachment private R2.

### Tugas

- Judul, instruksi, due date, attachment, allow-resubmit, publish state.
- Submission versioned.
- Server menentukan on-time/late.
- Dosen melihat dan mengunduh submission.
- Auto-grade ke modul Nilai belum termasuk.

### Forum

- Thread per kelas atau sesi.
- Reply.
- Edit/delete own post sesuai policy.
- Dosen dapat close/moderate.
- Notification thread/reply.

### Presensi

- LMS hanya menyediakan entry point ke service Presensi.
- Tidak membuat data atau business rule presensi duplikat.
- Status hasil check-in ditampilkan kembali pada sesi LMS.

### D1/R2 strategy

- List tidak mengambil attachment payload.
- File authorization dilakukan pada endpoint download.
- Submission metadata + audit/outbox atomic setelah upload R2 berhasil.
- Compensation menghapus object jika commit D1 gagal.
- Forum list memakai cursor pagination.
- Counter reply dapat didenormalisasi hanya jika diupdate atomic dengan post insert.

### UI routes

- `/dosen/kelas/$classId/lms`
- `/dosen/kelas/$classId/lms/sesi/$meetingId`
- `/mahasiswa/kelas/$classId/lms`
- `/mahasiswa/kelas/$classId/lms/sesi/$meetingId`

### Test dan acceptance criteria

- Dosen non-pengampu ditolak.
- Mahasiswa non-enrolled ditolak.
- Draft tidak terlihat mahasiswa.
- File tidak dapat diakses dengan object key langsung.
- Late status memakai server clock.
- Upload failure tidak meninggalkan metadata aktif.
- Forum ownership/moderation berjalan.
- Presensi dari LMS sama dengan menu Presensi.

---

## SIAKAD-08 — Presensi Evidence-Based

### Outcome

Mahasiswa dan dosen dapat melakukan presensi dalam window yang benar dengan evidence sesuai modality, serta Admin Akademik/Kaprodi dapat meninjau bukti sesuai scope.

### Schema

- `attendance_sessions`
- `attendance_records`
- `attendance_evidences`
- `attendance_requests`
- `attendance_adjustments`
- `attendance_review_logs`
- `attendance_generation_jobs`

Participant:

- `STUDENT`
- `LECTURER`

Status:

- `HADIR`
- `IZIN`
- `SAKIT`
- `ALPA`

### Window

- Buka `class start + 30 menit` berdasarkan policy snapshot.
- Tutup `class end + 60 menit` berdasarkan policy snapshot.
- Boundary bersifat inklusif sesuai keputusan yang dikunci di test.
- Server clock adalah sumber kebenaran.
- Published schedule revision terbaru menjadi sumber waktu.

### Offline evidence

- Foto wajib.
- Latitude/longitude wajib.
- Optional accuracy direkam.
- Reference coordinate berasal dari ruang.
- Jarak dihitung Haversine.
- Diterima jika `distance <= 1000 meter` berdasarkan effective policy.
- Simpan submitted coordinate, reference coordinate, calculated distance, dan policy version.

### Online evidence

- Foto wajib.
- Lokasi tidak wajib.
- Tidak ada pemeriksaan wajah/isi foto.

### Status flow

Rancangan default:

- Self check-in normal membuat `HADIR`.
- `IZIN`/`SAKIT` diajukan dengan catatan dan optional evidence pendukung lalu direview.
- `ALPA` digenerate setelah window tutup bagi participant tanpa record valid.
- Koreksi status memakai adjustment, bukan overwrite tanpa history.

### Evidence preview

- List hanya metadata.
- Tombol preview memanggil endpoint terotorisasi.
- Tidak ada eager image rendering.
- Admin Akademik scoped sesuai permission.
- Kaprodi hanya Prodi assignment.
- Dosen hanya kelas assignment, sesuai permission review yang diputuskan.

### Atomicity

- Unique record participant/session.
- Upload evidence R2 lalu atomic insert record + metadata + audit.
- Jika D1 gagal, delete object.
- Double submit menggunakan idempotency key dan mengembalikan hasil stabil.
- Generate ALPA memakai durable job/chunk.
- Adjustment menggunakan conditional version.

### UI routes

- `/mahasiswa/presensi`
- `/dosen/presensi`
- `/dosen/kelas/$classId/presensi`
- `/admin-akademik/presensi`
- `/kaprodi/presensi`

### Test minimum

- Sebelum, tepat, dan setelah open time.
- Sebelum, tepat, dan setelah close time.
- Jarak 999, 1000, dan 1001 meter.
- Invalid coordinate.
- Missing photo/location.
- Online tanpa location.
- Duplicate submit/concurrent submit.
- R2 berhasil D1 gagal.
- Modality revision.
- Scope evidence preview.
- Foto tidak diminta sebelum klik preview.

### Acceptance criteria

- Seluruh rule evidence dan waktu requirements terpenuhi.
- Tidak ada public evidence URL.
- Mahasiswa/Dosen tidak dapat submit atas nama orang lain.
- Historical record dapat direproduksi dari policy snapshot.
- ALPA generation resumable dan idempotent.

---

## SIAKAD-09 — Nilai, KHS, IPS/IPK, dan Transkrip

### Outcome

Dosen dapat menginput dan mengunci nilai; Admin Akademik mempublikasikan; mahasiswa hanya melihat nilai resmi; KHS dan transkrip dihitung dengan policy configurable dan versioned.

### Schema

- `class_grade_components`
- `student_component_scores`
- `grade_submission_batches`
- `final_grade_snapshots`
- `grade_publications`
- `study_result_snapshots`
- `transcript_entries`
- `grade_adjustments`

Grade policy utama berada di Modul Pengaturan.

### Component snapshot

- Saat kelas dibuat, component berasal dari curriculum/default.
- Snapshot kelas tidak berubah jika curriculum kemudian diedit.
- Total bobot harus tepat 100% sebelum submit.
- Bobot dan skor disimpan integer berskala.

### State

```text
DRAFT → SUBMITTED → LOCKED → PUBLISHED
```

- Dosen input/preview/submit.
- Missing required score mencegah submit.
- Lock mencegah edit.
- Admin Akademik menutup periode/publish.
- Reopen wajib alasan dan adjustment history.
- Mahasiswa tidak dapat membaca sebelum published.

### Calculation

- Weighted final score.
- Rounding berdasarkan policy version.
- Numeric-to-letter berdasarkan active grade scale set.
- Snapshot menyimpan raw result, rounded result, letter, grade point, dan policy version.
- Formula preview dan final memakai function domain yang sama.

### KHS/IPS/IPK/transkrip

- KHS hanya nilai published pada periode.
- IPS memakai total quality points / counted credits.
- IPK memakai seluruh nilai yang memenuhi retake policy.
- Retake policy `HIGHEST` atau `LATEST` dibaca dari setting dan disnapshot pada result build.
- Transkrip tidak menampilkan draft/locked-unpublished.
- Print-friendly view.

### D1 strategy

- Score bulk save di-chunk sesuai parameter budget.
- Upsert score memakai unique student/component constraint.
- Submit melakukan completeness aggregate dengan indexed query.
- Lock/publish memakai versioned conditional update.
- Publish snapshot + status + audit + notifications dilakukan atomic per class/chunk.
- Publish periode besar memakai durable job dan checkpoint.
- KHS/transcript snapshot mencegah query agregasi mahal setiap page load.
- Rebuild snapshot memakai idempotent job.

### UI routes

- `/dosen/kelas/$classId/nilai`
- `/admin-akademik/nilai/periode`
- `/admin-akademik/nilai/publikasi`
- `/kaprodi/nilai`
- `/mahasiswa/nilai`
- `/mahasiswa/khs/$periodId`
- `/mahasiswa/transkrip`

### Test minimum

- Total bobot kurang/lebih 100%.
- Missing score.
- Score range.
- Rounding boundary untuk setiap mode.
- Grade scale boundary.
- Concurrent score edit.
- Lock mutation denial.
- Visibility sebelum/sesudah publish.
- Retake highest/latest.
- IPS/IPK reproducibility.
- Large publish resume/idempotency.

### Acceptance criteria

- Preview identik dengan final calculation.
- Mahasiswa hanya melihat published values.
- Policy version membuat hasil historis tetap stabil.
- Semua perubahan setelah lock mempunyai adjustment history.
- KHS, IPS, IPK, dan transkrip dapat direproduksi.

---

## SIAKAD-10 — Integration dan Release Readiness

### Outcome

Seluruh modul terbukti bekerja sebagai satu sistem yang aman, konsisten, dapat dioperasikan, dan siap release.

### End-to-end journey wajib

1. Bootstrap Superadmin.
2. Buat Admin Akademik.
3. Import Mahasiswa/Dosen/Prodi/Angkatan/Ruang/Mata Kuliah.
4. Provision akun.
5. First login dan password change 16 karakter.
6. Assign Dosen sebagai Kaprodi.
7. Konfigurasi policy awal.
8. Upload dan aktifkan kurikulum.
9. Generate/finalisasi KRS Paket.
10. Mapping kelas dan resolve conflict.
11. Submit/approve/publish jadwal.
12. Verifikasi notification Dosen/Mahasiswa.
13. Upload materi/tugas.
14. Submission tugas.
15. Presensi offline Mahasiswa dan Dosen.
16. Ubah sesi online sebelum cutoff dan lakukan presensi online.
17. Buktikan perubahan setelah cutoff tanggal ditolak.
18. Input/submit/lock/publish nilai.
19. Verifikasi KHS/IPS/IPK/transkrip.
20. Revoke session/reset password/deactivate account.

### Security hardening

- Direct API access tanpa menu.
- ID enumeration.
- Cross-Prodi access.
- Cross-class ownership.
- MIME spoofing.
- Oversized upload.
- Object key guessing.
- Brute force/rate limit.
- Stale version update.
- Duplicate idempotency key dengan payload berbeda.
- Log inspection untuk secret/PII.

### D1/R2 hardening

- Atomic batch rollback.
- Batch result validation.
- Parameter boundary.
- Query invocation budget.
- Worker timeout simulation.
- Job lease expiry dan takeover.
- R2 orphan cleanup.
- D1 success/R2 delete failure.
- R2 success/D1 failure.
- Migration dari empty dan staging-like database.
- Time Travel/backup restore runbook.

### Performance

Dataset minimum performance test ditetapkan sebelum implementasi akhir, mencakup:

- Ribuan Mahasiswa.
- Ratusan Dosen.
- Puluhan Prodi/angkatan/periode.
- Import ribuan row.
- Generate KRS satu periode.
- Mapping kelas satu periode.
- Presensi satu kelas penuh secara concurrent.
- Bulk score save/publish.

Ukur:

- p50/p95/p99 latency.
- D1 rows read/written.
- Statement count.
- Batch size.
- Worker CPU/wall time.
- Retry/failure count.
- R2 bytes/operation.

### Accessibility dan UX

- Keyboard-only journey.
- Screen reader labels.
- Focus management.
- Responsive mobile/tablet/desktop.
- Empty/loading/error/forbidden states.
- Validation hanya setelah submit.
- Evidence preview benar-benar lazy.

### Operational docs

- Local setup.
- Migration.
- Seed.
- Deployment.
- Rollback.
- Backup/restore.
- Emergency direct DB change H-7 oleh Superadmin/operator infra.
- Manual audit record untuk emergency change.
- R2 orphan cleanup.
- Job retry/cancel.
- Account recovery.

### Release gate

- Tidak ada defect P0/P1.
- Seluruh role/scope negative tests lulus.
- Seluruh E2E journey lulus.
- D1/R2 local integration test lulus.
- Migration lulus pada database kosong dan staging copy.
- Performance target yang disepakati tercapai.
- Semua quality commands lulus.

---

## 13. Cross-Module Event Contract

Gunakan transactional outbox dengan event minimal:

- `master.student.created`
- `master.lecturer.created`
- `identity.provisioning.requested`
- `identity.account.activated`
- `curriculum.activated`
- `study-plan.finalized`
- `class-mapping.completed`
- `schedule.submitted`
- `schedule.approved`
- `schedule.rejected`
- `schedule.published`
- `meeting.modality.changed`
- `lms.material.published`
- `lms.assignment.published`
- `lms.submission.created`
- `attendance.recorded`
- `attendance.window.closed`
- `grade.submitted`
- `grade.published`

Event payload berisi ID dan metadata minimum, bukan snapshot penuh entity. Consumer selalu melakukan authorization/business lookup berdasarkan ID.

Outbox processing harus:

- Idempotent.
- Memiliki attempt count dan next retry.
- Mempunyai dead-letter status.
- Tidak menghapus event sebelum berhasil.
- Tidak memblokir domain mutation utama setelah event tersimpan.

---

## 14. Migration dan Seed Strategy

### Migration

- Satu migration per perubahan schema yang cohesive.
- Jangan mengedit migration yang sudah deployed.
- Backfill besar dilakukan melalui resumable job, bukan migration request panjang.
- Additive migration lebih dahulu, deploy code kompatibel, kemudian cleanup pada release berikutnya.
- Index besar ditambahkan setelah menilai dampaknya.
- Foreign key dan check constraint diuji pada local D1.

### Seed

- System roles dan permissions.
- Role conflict matrix.
- Default settings.
- Grade scale awal placeholder yang harus dikonfirmasi institusi sebelum production.
- Superadmin bootstrap melalui secret/one-time command, bukan credential hard-coded.
- Development fixtures untuk semua role dan modul.

### Rollback

- Rollback aplikasi tidak selalu berarti reverse migration.
- Gunakan forward-fix untuk schema production.
- Sebelum destructive migration, pastikan Time Travel/backup tersedia.
- Feature flag dapat digunakan untuk menahan menu/use case baru selama migration/backfill.

---

## 15. Testing Strategy

### Unit test

- Pure domain policy.
- H-7 local date calculation.
- Attendance time/radius.
- Grade calculation/rounding.
- Identifier generation formatting.
- Parameter/batch chunking.
- State transition.
- Permission/scope policy.

### D1 integration test

- Repository terhadap D1 lokal.
- Migration real.
- Constraint/index.
- Atomic batch rollback.
- Concurrency/idempotency.
- Query plan.
- Job resume.

### R2 integration test

- Upload/download/delete.
- Private access.
- MIME/size.
- Compensation/orphan cleanup.
- Preview authorization.

### API test

- Zod input/output.
- Error contract.
- Auth/role/scope/ownership/state.
- Rate limit.
- Idempotency.

### Component test

- Delayed form error.
- Accessible label.
- Data table/filter.
- Role-specific action visibility.
- Lazy evidence preview.

### E2E test

- Journey pada SIAKAD-10.
- Negative access antar-role.
- Session expiration.
- File flow.
- Mobile viewport minimum.

---

## 16. Quality Gate Wajib per Tiket

Urutan final sebelum commit:

```bash
bun run fix
bun run check
bun run check-types
bun test
bun run build
bun run react-doctor
```

Ketentuan:

- `bun run check-types` wajib dan tidak boleh diganti hanya dengan build.
- Tidak boleh menambahkan `@ts-ignore`/`any` untuk sekadar meloloskan check tanpa alasan terdokumentasi.
- Semua Promise harus ditunggu atau secara eksplisit ditangani.
- Tidak ada `console.log`, `debugger`, atau `alert` pada production code.
- Tidak ada skipped/only test yang masuk commit.
- React Doctor finding harus diperbaiki atau diberi keputusan teknis terdokumentasi.
- Formatter dijalankan sebelum lint/typecheck final.

---

## 17. Definition of Done Global

Satu tiket dinyatakan selesai hanya jika:

- Seluruh acceptance criteria tiket terpenuhi.
- Schema dan migration tersedia.
- Fresh migration berhasil.
- API input/output typed dan tervalidasi.
- Authorization berada di server.
- Audit dan notification sesuai kebutuhan tersedia.
- Operasi retry-safe dan idempotent.
- Query mematuhi bound parameter dan batch budget.
- Operasi multi-statement kritis menggunakan atomic batch.
- Operasi D1/R2 mempunyai compensation.
- Form validation mengikuti UX requirement.
- UI accessible dan responsive.
- Import alias digunakan.
- Unit, integration, negative authorization, dan E2E relevan lulus.
- D1/R2 dapat dites lokal.
- TypeScript check lulus.
- Lint/formatter/build/React Doctor lulus.
- Dokumentasi module dan operational note diperbarui.

---

## 18. Risiko Utama dan Mitigasi

| Risiko | Mitigasi |
|---|---|
| Query melewati 100 bind parameter | Central chunk helper dengan safe budget 80 dan boundary test |
| Import/mapping terlalu besar untuk satu Worker invocation | Durable job, checkpoint, lease, atomic chunk, idempotency |
| Developer memakai interactive transaction | Larang melalui convention/review; sediakan AtomicBatchExecutor |
| Batch sukses tetapi invariant business gagal | Conditional SQL, unique/check constraint, cek `meta.changes`, optimistic version |
| D1 committed tetapi R2 cleanup gagal | Outbox cleanup dan orphan retry |
| R2 upload berhasil tetapi D1 gagal | Immediate compensation delete + orphan job fallback |
| Stale read jika read replication aktif | D1 Sessions API/bookmark/first-primary untuk read-after-write |
| H-7 salah karena hitung jam/UTC | Local calendar helper Asia/Jakarta dan test contoh tanggal 7/1/2 |
| Session menulis D1 setiap request | Throttled sliding refresh interval |
| Role hanya disembunyikan di sidebar | Semua procedure memakai policy server |
| Perubahan setting mengubah hasil lama | Policy version/reference disimpan pada transaction snapshot |
| Duplicate akibat retry jaringan | Idempotency key dan unique constraints |
| Evidence photo bocor | Private R2, opaque key, authorized lazy preview |
| Grade berbeda antara preview/final | Satu pure calculation function dan policy version yang sama |

---

## 19. Referensi Teknis

- [Cloudflare D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Cloudflare D1 Database API dan batch transaction](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [Cloudflare D1 Sessions dan read replication](https://developers.cloudflare.com/d1/best-practices/read-replication/)
- [Cloudflare Workers Testing](https://developers.cloudflare.com/workers/testing/)
- [Cloudflare Workers Vitest Integration](https://developers.cloudflare.com/workers/testing/vitest-integration/)
- [Better Auth Username Plugin](https://better-auth.com/docs/plugins/username)
- [Better Auth Session Management](https://better-auth.com/docs/concepts/session-management)
- [Better Auth Rate Limit](https://better-auth.com/docs/concepts/rate-limit)

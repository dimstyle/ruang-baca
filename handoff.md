# Project Handoff — Ruang Baca

## Current Status
Seluruh task pada [specs/tasks.md](specs/tasks.md) telah selesai (`[ok]`), teruji (`99/99` unit test lulus across `7/7` suites, `2/2` e2e test lulus, `pnpm build` & `pnpm lint` bersih), dilengkapi dengan generator `.env` (`pnpm env:generate`), CLI pembuatan Admin langsung ke DB dengan validasi password minimal 8 karakter (`pnpm admin:create`), CLI reset database (`pnpm db:reset`), sistem pemilihan database otomatis (`SQLITE_PATH` vs PostgreSQL), setup production Docker (`Dockerfile` & `docker-compose.yml` PostgreSQL 18), dokumentasi developer di [README.md](README.md), serta UI SSR EJS Gmail-style dan dokumentasi UI di Framer yang selaras 1-to-1 dengan [specs/ui-specs.md](specs/ui-specs.md).

### Completed Modules
1. **Authentication (`src/auth`)**
   - `POST /api/auth/registration` (Admin-only via `AdminGuard`)
   - `POST /api/auth/login`
   - `POST /api/auth/logout`
   - `POST /api/auth/refresh_token`
   - Explicit raw SQL di `src/auth/sql/*.queries.sql`, `Logger`, dan unit test (`src/auth/auth.controller.spec.ts`, `src/auth/guards/admin.guard.spec.ts`).

2. **Admins Backoffice (`src/admins`)**
   - **Users Management**: `PUT /api/admins/updateuser`, `DELETE /api/admins/deleteuser`, `GET /api/admins/getuser`, `GET /api/admins/listuser`
   - **Denda Management**: `POST /api/admins/createdenda`, `PUT /api/admins/updatedenda`, `GET /api/admins/getdenda`
   - **Laporan Management**: `POST /api/admins/createlaporan`, `GET /api/admins/readlaporan`, `GET /api/admins/readlistlaporan`
   - Explicit raw SQL di `src/admins/sql/*.queries.sql`, `Logger`, dan unit test (`src/admins/admins.controller.spec.ts`).

3. **Books & Categories (`src/books`)**
   - **Categories CRUD**: `POST /api/books/createcategory`, `PUT /api/books/updatecategory`, `DELETE /api/books/deletecategory` (mengembalikan `409 Conflict` bila masih direferensikan buku), `GET /api/books/readlistcategories` (public)
   - **Books CRUD**: `POST /api/books/createbook`, `PUT /api/books/updatebook`, `GET /api/books/getbook` (public), `DELETE /api/books/deletebook`
   - Explicit raw SQL di `src/books/sql/*.queries.sql`, `Logger`, dan unit test (`src/books/books.controller.spec.ts`).

4. **Peminjaman & Pengembalian (`src/peminjaman`)**
   - **User/Admin Requests**: `POST /api/peminjaman/peminjaman` (`temp_peminjaman`), `POST /api/peminjaman/pengembalian` (`temp_pengembalian`)
   - **Admin Admissions**: `POST /api/peminjaman/acceptpeminjaman` (copy `temp_peminjaman` -> `peminjaman` & delete temp), `POST /api/peminjaman/acceptpengembalian` (copy `temp_pengembalian` -> `pengembalian`, opsional mencatat denda ke `daftar_denda` bila terlambat/rusak/hilang, & delete temp)
   - **List Endpoints**: `GET /api/peminjaman/listtemppeminjaman` (Admin), `GET /api/peminjaman/listtemppengembalian` (Admin), `GET /api/peminjaman/listpeminjaman` (User/Admin)
   - Explicit raw SQL di `src/peminjaman/sql/*.queries.sql`, `Logger`, dan unit test (`src/peminjaman/peminjaman.controller.spec.ts`).

5. **Database (`@ruangbaca/database` / `database/`)**
   - Prisma + Dual-Engine Adapter ([database/src/database-config.ts](database/src/database-config.ts), [database/src/postgres-adapter.ts](database/src/postgres-adapter.ts), [database/src/prisma.service.ts](database/src/prisma.service.ts)) yang tersinkronisasi penuh dengan [specs/database-contracts.md](specs/database-contracts.md):
     - **SQLite (`PrismaBetterSqlite3`)**: Aktif otomatis bila `SQLITE_PATH` terisi pada `.env` (prioritas utama).
     - **PostgreSQL 18 (`PrismaPostgresAdapterFactory`)**: Aktif otomatis bila `SQLITE_PATH` kosong/dikomentari dan variabel `POSTGRESS_USERNAME`, `POSTGRESS_PASSWORD`, `POSTGRESS_DATABASE` (beserta `POSTGRESS_HOST` default `localhost` & `POSTGRESS_PORT` default `5432`) terisi pada `.env`. Dilengkapi konversi otomatis placeholder `?` menjadi `$1, $2, ...` dan pemetaan constraint error `23505` -> `P2002` & `23503` -> `P2003`.
     - **Proteksi Developer**: Menampilkan pesan error eksplisit (`MISSING_DB_CONFIG_MESSAGE`) bila baik `SQLITE_PATH` maupun `POSTGRESS_*` belum dikonfigurasi di `.env`.
   - Migrasi terakhir: `20261114133139_add_temp_peminjaman_pengembalian_and_total_peminjam` (menambahkan tabel `temp_peminjaman`, `temp_pengembalian`, serta kolom `total_peminjam` pada tabel `laporan`).
   - Unit test konfigurasi database & adapter di [src/database-config.spec.ts](src/database-config.spec.ts).

6. **UML & Architecture Diagrams (`docs/uml` & `docs/diagrams`)**
   - ERD: `docs/uml/src/diagrams/list-diagrams/erd.mmd` (sesuai `specs/database-contracts.md`)
   - Use Case: `docs/uml/src/diagrams/list-diagrams/use-case.mmd`
   - Sequence Diagrams: `docs/uml/src/diagrams/list-diagrams/sequence-*.mmd` (25 diagram untuk seluruh gate pada `auth`, `admins`, `books`, dan `peminjaman`)
   - Flowcharts & Activity Diagrams: `docs/uml/src/diagrams/list-diagrams/flowchart-*.mmd` (25 diagram) dan `activity-*.mmd` (25 diagram lengkap dengan swimlane `User`, `Admin`, dan `Sistem` — commit `bde3d7c`).
   - **Draw.io Diagrams (`docs/diagrams` & `pnpm uml:drawio`)**: [scripts/generate-drawio.mjs](scripts/generate-drawio.mjs) mengonversi seluruh 77 file `.mmd` menjadi file native Draw.io (`.drawio` / `mxGraphModel`) yang dikelompokkan berdasarkan jenis diagram:
     - Workbook per kategori: `docs/diagrams/erd.drawio`, `docs/diagrams/use-case.drawio`, `docs/diagrams/sequence.drawio` (25 tab), `docs/diagrams/flowchart.drawio` (25 tab), `docs/diagrams/activity.drawio` (25 tab).
     - File individu per subdirektori kategori: `docs/diagrams/erd/erd.drawio`, `docs/diagrams/use-case/use-case.drawio`, `docs/diagrams/sequence/sequence-*.drawio` (25 file), `docs/diagrams/flowchart/flowchart-*.drawio` (25 file), dan `docs/diagrams/activity/activity-*.drawio` (25 file).
   - **Dokumen SRS & System Design (`docs/SRS_and_System_Design_Master_Planning.docx`)**: Diisi secara lengkap melalui [scripts/generate-srs-docx.py](scripts/generate-srs-docx.py) sesuai seluruh instruksi pada [docs/soal.pdf](docs/soal.pdf) (254 paragraf & 35 tabel mencakup Analisis Kebutuhan Fungsional/Non-Fungsional, Metodologi RPL & 6 tahapan SDLC, Use Case + 9 Skenario Use Case Detail, 25 Activity Diagram Swimlane, 25 Flowchart, 25 Sequence Diagram, ERD + Kamus Data 12 Tabel + 49 Query SQL Eksplisit untuk Test Lisan, Penerapan OOP, Debugging & Testing, serta Design System UI/UX 60-30-10 Gmail-Style).

7. **SSR Frontend Gmail-Style (`src/views`, `views/`, `styles/`, `public/`)**
   - **Spesifikasi UI**: [specs/ui-specs.md](specs/ui-specs.md) — palet 60/30/10 (`#F6F8FC` / `#E9EEF6` & `#D3E3FD` / `#0B57D0`), tipografi `Roboto` + `Roboto Mono`, komponen Avatar Inisial, Book Tile (`36×36px` & `72×72px`), Status Chip, Empty State, Pagination Info (`1–N dari N`), Floating Compose Window (`480px`), Confirm Dialog (`400px`), dan Snackbar.
   - **ViewsModule (`src/views`)**: [views.module.ts](src/views/views.module.ts), [views.controller.ts](src/views/views.controller.ts), [views.service.ts](src/views/views.service.ts), [view-helpers.ts](src/views/view-helpers.ts), [session.queries.sql](src/views/sql/session.queries.sql), dan unit test [views.controller.spec.ts](src/views/views.controller.spec.ts). Menangani sesi via cookie (`access_token` & `refresh_token`), auto-refresh token di server, serta proteksi rute `/app/admin/*`.
   - **11 Halaman SSR (`views/*.ejs`)**:
     1. `GET /login` — [views/login.ejs](views/login.ejs)
     2. `GET /buku` (dan `/daftar-buku`) — [views/buku.ejs](views/buku.ejs) *(Katalog buku publik untuk non-login user)*
     3. `GET /app/katalog` — [views/katalog.ejs](views/katalog.ejs)
     4. `GET /app/kategori` — [views/kategori.ejs](views/kategori.ejs)
     5. `GET /app/peminjaman-saya` — [views/peminjaman-saya.ejs](views/peminjaman-saya.ejs)
     6. `GET /app/admin/permintaan-peminjaman` — [views/permintaan-peminjaman.ejs](views/permintaan-peminjaman.ejs)
     7. `GET /app/admin/permintaan-pengembalian` — [views/permintaan-pengembalian.ejs](views/permintaan-pengembalian.ejs) *(dilengkapi input denda kondisional `<<extend>> Create Denda` saat status `Telat` atau kondisi buku `Rusak`/`Hilang`, dan disembunyikan saat `Baik` & belum telat)*
     8. `GET /app/admin/anggota` — [views/anggota.ejs](views/anggota.ejs)
     9. `GET /app/admin/denda` — [views/denda.ejs](views/denda.ejs) *(khusus untuk Read Denda, Total Denda Belum Lunas, dan Update Denda `<<extend>>` Delete Denda tanpa form tambah denda)*
     10. `GET /app/admin/laporan` — [views/laporan.ejs](views/laporan.ejs)
     11. `GET /app/admin/laporan/:id` — [views/laporan-detail.ejs](views/laporan-detail.ejs)
   - **12 Partials (`views/partials/*.ejs`)**: `head.ejs`, `shell-top.ejs`, `shell-bottom.ejs`, `icon.ejs`, `avatar.ejs`, `tile.ejs`, `chip.ejs`, `empty.ejs`, `pagination.ejs`, `compose-start.ejs`, `compose-end.ejs`, `snackbar.ejs`.
   - **Client & Styling**: [styles/tailwind.css](styles/tailwind.css) (`public/css/style.css` via `@tailwindcss/cli`) dan [public/js/app.js](public/js/app.js) (interaksi sidebar, pencarian live, filter dropdown, tab, pilih semua, compose window, confirm dialog, visibilitas & validasi dinamis input denda pada dialog pengembalian, serta integrasi `fetch` dengan auto-refresh token pada `401`).

8. **Dokumentasi UI di Framer (`SB3xpkK3lxFmxG3OZDKv`)**
   - Project URL: `https://framer.com/projects/SB3xpkK3lxFmxG3OZDKv` (`Dimss' Workspace`)
   - Seluruh 10 halaman telah dibangun 1-to-1 dengan `views/*.ejs`:
     - `/` (`augiA20Il`) — Katalog Buku
     - `/login` (`KpdfF8GEY`) — Login
     - `/kategori` (`yVMQ6KPye`) — Kategori
     - `/peminjaman-saya` (`ZUQYTPpj5`) — Peminjaman Saya
     - `/permintaan-peminjaman` (`cuvoKWOsZ`) — Permintaan Peminjaman
     - `/permintaan-pengembalian` (`tIV1LvTrS`) — Permintaan Pengembalian *(dilengkapi blok Input Denda Kondisional `<<extend>> Create Denda` pada dialog Terima Pengembalian Buku)*
     - `/anggota` (`wkYMk7YcH`) — Anggota
     - `/denda` (`HfTH3zufJ`) — Denda *(khusus untuk Total Denda Belum Lunas, Daftar Denda, dan Catat Pembayaran Denda)*
     - `/laporan` (`i7dGfMq1O`) — Laporan
     - `/laporan-detail` (`HrHojvUvg`) — Detail Laporan

9. **CLI Runners, Docker Production Setup, & Developer Docs (`scripts/`, `docker/`, `Dockerfile`, `docker-compose.yml`, `README.md`)**
   - **Generator `.env` (`pnpm env:generate`)**: [scripts/generate-env.mjs](scripts/generate-env.mjs) membaca [.env.example](.env.example), meminta input `username` (interaktif atau via `--username`), dan men-generate nilai acak `crypto.randomBytes(32)` yang di-hash dengan **SHA-256 (64 karakter hex)** untuk setiap secret key/password (`JWT_SECRET_KEY`, `POSTGRESS_PASSWORD`).
   - **CLI Pembuatan Akun Admin (`pnpm admin:create`)**: [scripts/create-admin.mjs](scripts/create-admin.mjs) terhubung langsung ke database aktif (SQLite maupun PostgreSQL sesuai `.env`) tanpa lewat API untuk meng-insert akun `admin` (`accounts` dengan validasi panjang password minimal 8 karakter dan hash `bcrypt` + `admins`).
   - **CLI Reset Database (`pnpm db:reset`)**: [scripts/reset-db.mjs](scripts/reset-db.mjs) mengosongkan seluruh tabel (`accounts`, `admins`, `users`, `categories`, `books`, `temp_peminjaman`, `peminjaman`, `temp_pengembalian`, `pengembalian`, `daftar_denda`, `laporan`, `refresh_token`) dan me-reset sequence auto-increment pada database aktif (SQLite maupun PostgreSQL).
   - **Docker Production Setup**: Multi-stage [Dockerfile](Dockerfile), [.dockerignore](.dockerignore), [docker-compose.yml](docker-compose.yml) (NestJS + `postgres:18-alpine`), serta skrip inisialisasi skema [docker/init-postgres.sql](docker/init-postgres.sql) dan [docker/entrypoint.sh](docker/entrypoint.sh).
   - **Dokumentasi Developer**: Panduan lengkap instalasi, konfigurasi dual-database, penggunaan CLI runner, testing, dan deployment Docker di [README.md](README.md).

---

## Execution Rules Reference
Lihat [.rules/AGENT.md](.rules/AGENT.md) dan [.rules/ARCHITECTURE.md](.rules/ARCHITECTURE.md):
- **Read-only specs**: `.rules/*`, `specs/*`, `.env` (kecuali mencentang `[ok]` pada `specs/tasks.md`).
- **Database queries**: Gunakan explicit raw SQL di `src/<feature>/sql/<task_name>.queries.sql` dan panggil `PrismaService` dari `@ruangbaca/database`.
- **UML**: Setiap gate/fitur baru wajib ditambahkan ke `docs/uml/src/diagrams/list-diagrams/use-case.mmd` dan dibuatkan `sequence-<nama-gate>.mmd`, `flowchart-<nama-gate>.mmd`, serta `activity-<nama-gate>.mmd`.

---

## Next Steps (Upcoming Work)
- Seluruh modul backend (`auth`, `admins`, `books`, `peminjaman`), modul SSR UI (`views`), diagram UML (`docs/uml`), dokumentasi UI Framer, CLI runners (`env:generate`, `admin:create`), sistem dual-database (`SQLITE_PATH` vs PostgreSQL 18), setup Docker production, dan dokumentasi [README.md](README.md) telah selesai 100%.
- Apabila ada penambahan fitur/gate baru ke depannya, tambahkan spesifikasi pada `specs/*` dan daftar task baru pada [specs/tasks.md](specs/tasks.md).

---

## Useful Commands
```bash
# Generate .env (random SHA-256 secret/password + username input)
pnpm env:generate

# Create Admin account directly in active DB (min 8-char password)
pnpm admin:create

# Reset all tables & sequences in active DB (SQLite / PostgreSQL)
pnpm db:reset
pnpm db:reset -- --yes

# Build & migrate database package
pnpm db:migrate
pnpm db:build

# Build Tailwind CSS
pnpm css:build

# Run unit & e2e tests
pnpm test
pnpm test:e2e

# Build backend & UML SPA
pnpm build
pnpm uml:build

# Run production stack (NestJS + PostgreSQL 18) with Docker Compose
docker compose up -d --build
docker compose exec app pnpm admin:create
```

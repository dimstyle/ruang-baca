# Ruang Baca — Sistem Informasi Perpustakaan

Aplikasi manajemen perpustakaan berbasis **NestJS 11**, **Server-Side Rendering (EJS + Tailwind CSS v4)** bergaya Gmail, serta **Dual-Database Engine (`@ruangbaca/database`)** yang mendukung **SQLite** untuk development lokal dan **PostgreSQL 18** untuk deployment production.

---

## Daftar Isi
1. [Arsitektur & Modul](#1-arsitektur--modul)
2. [Prasyarat Sistem](#2-prasyarat-sistem)
3. [Instalasi & Konfigurasi `.env` (`pnpm env:generate`)](#3-instalasi--konfigurasi-env-pnpm-envgenerate)
4. [Sistem Pemilihan Database Otomatis (SQLite vs PostgreSQL)](#4-sistem-pemilihan-database-otomatis-sqlite-vs-postgresql)
5. [Membuat Akun Admin via CLI (`pnpm admin:create`)](#5-membuat-akun-admin-via-cli-pnpm-admincreate)
6. [Menjalankan di Mode Development](#6-menjalankan-di-mode-development)
7. [Deployment Production dengan Docker (NestJS + PostgreSQL 18)](#7-deployment-production-dengan-docker-nestjs--postgresql-18)
8. [Pengujian & Daftar Perintah (`pnpm` Scripts)](#8-pengujian--daftar-perintah-pnpm-scripts)
9. [Rute Halaman UI & Endpoint API](#9-rute-halaman-ui--endpoint-api)

---

## 1. Arsitektur & Modul

Proyek ini menggunakan **Feature-Based Architecture** dengan query SQL eksplisit (`src/<feature>/sql/*.queries.sql`):

```text
ruang-baca/
├── src/
│   ├── auth/          # Autentikasi JWT (Cookie access_token & refresh_token) & AdminGuard
│   ├── admins/        # Backoffice Admin (Manajemen Anggota, Denda, & Laporan)
│   ├── books/         # Katalog Buku & Kategori CRUD
│   ├── peminjaman/    # Alur pengajuan & persetujuan Peminjaman / Pengembalian
│   └── views/         # SSR Controller & Service untuk 10 halaman UI Gmail-Style
├── views/             # Template EJS (10 halaman utama + 12 reusable partials)
├── styles/ & public/  # Tailwind CSS v4 & skrip interaksi klien (public/js/app.js)
├── database/          # Package @ruangbaca/database (Prisma 7 + SQLite & PostgreSQL adapter)
├── scripts/           # CLI Runner untuk developer (generate-env.mjs & create-admin.mjs)
├── docker/            # Skrip entrypoint & inisialisasi DDL PostgreSQL 18
└── docs/uml/          # Dokumentasi ERD, Use Case, Sequence, Flowchart, & Activity Diagram
```

---

## 2. Prasyarat Sistem

- **Node.js**: `v22.x` atau lebih baru
- **Package Manager**: `pnpm` (`corepack enable`)
- **Docker & Docker Compose**: diperlukan untuk menjalankan setup production (`NestJS + PostgreSQL 18`)

---

## 3. Instalasi & Konfigurasi `.env` (`pnpm env:generate`)

### 3.1. Install Dependencies
```bash
pnpm install
```

### 3.2. Generate File `.env` Otomatis
Template konfigurasi tersedia di [.env.example](file:///home/dimstyle/main/myProject/ruang-baca/.env.example):
```env
PORT=3000

JWT_SECRET_KEY=

#sqlite
SQLITE_PATH=database/database.sqlite

# postgresql
POSTGRESS_HOST=localhost
POSTGRESS_PORT=5432
POSTGRESS_PASSWORD=
POSTGRESS_USERNAME=
POSTGRESS_DATABASE=perpustakaan
```

Gunakan runner `pnpm env:generate` untuk membuat file `.env` dari `.env.example`. Runner ini akan:
- Menghasilkan nilai acak (`crypto.randomBytes(32)`) yang di-hash dengan **SHA-256 (64 karakter hex)** untuk setiap secret key dan password (`JWT_SECRET_KEY` serta `POSTGRESS_PASSWORD`).
- Meminta input `username` untuk mengisi `POSTGRESS_USERNAME`.

**Cara 1 — Mode Interaktif:**
```bash
pnpm env:generate
# Masukkan username database (POSTGRESS_USERNAME): dimas
```

**Cara 2 — Argumen CLI Langsung:**
```bash
pnpm env:generate dimas
# atau:
pnpm env:generate --username dimas
```

---

## 4. Sistem Pemilihan Database Otomatis (SQLite vs PostgreSQL)

Package `@ruangbaca/database` memilih engine database secara otomatis berdasarkan isi `.env`:

1. **Mode SQLite (Prioritas Utama bila `SQLITE_PATH` terisi)**
   Jika `SQLITE_PATH` memiliki nilai (contoh: `SQLITE_PATH=database/database.sqlite`), aplikasi otomatis menggunakan **SQLite** (`@prisma/adapter-better-sqlite3`), meskipun variabel `POSTGRESS_*` juga terisi di `.env`.
   ```env
   SQLITE_PATH=database/database.sqlite
   ```

2. **Mode PostgreSQL (Aktif bila `SQLITE_PATH` kosong/dikomentari)**
   Jika `SQLITE_PATH` dikosongkan (`SQLITE_PATH=`) atau dikomentari (`# SQLITE_PATH=...`), sistem otomatis beralih menggunakan **PostgreSQL** dengan membaca variabel berikut:
   ```env
   # SQLITE_PATH=database/database.sqlite
   POSTGRESS_HOST=localhost
   POSTGRESS_PORT=5432
   POSTGRESS_USERNAME=dimas
   POSTGRESS_PASSWORD=<hash_password_dari_env_generate>
   POSTGRESS_DATABASE=perpustakaan
   ```

3. **Pesan Proteksi Developer (Jika Keduanya Kosong)**
   Jika `SQLITE_PATH` kosong **dan** kredensial `POSTGRESS_USERNAME`, `POSTGRESS_PASSWORD`, serta `POSTGRESS_DATABASE` belum diisi, aplikasi akan menolak berjalan dan menampilkan pesan:
   > `[Ruang Baca Database] Konfigurasi database tidak ditemukan di .env! Silakan gunakan salah satu: (1) isi SQLITE_PATH untuk menggunakan SQLite, atau (2) kosongkan SQLITE_PATH dan isi POSTGRESS_USERNAME, POSTGRESS_PASSWORD, serta POSTGRESS_DATABASE untuk menggunakan PostgreSQL.`

---

## 5. Membuat Akun Admin (`pnpm admin:create`) & Reset Database (`pnpm db:reset`)

Karena endpoint `POST /api/auth/registration` hanya dapat diakses oleh Admin (`AdminGuard`), akun Admin pertama dibuat menggunakan script CLI `pnpm admin:create` ([scripts/create-admin.mjs](file:///home/dimstyle/main/myProject/ruang-baca/scripts/create-admin.mjs)) yang berinteraksi **langsung ke database aktif** (baik SQLite maupun PostgreSQL sesuai `.env`) tanpa melalui API.

> **Catatan Validasi Password**: Password Admin wajib memiliki **minimal 8 karakter**. Jika kurang dari 8 karakter, CLI akan menolak dan meminta input ulang.

**Cara 1 — Mode Interaktif:**
```bash
pnpm admin:create
```
Anda akan diminta mengisi `Username`, `Email`, `Password` (minimal 8 karakter, otomatis di-hash dengan `bcrypt`), `Nama Lengkap`, `Nomor HP`, dan `Alamat`.

**Cara 2 — Argumen CLI Langsung:**
```bash
pnpm admin:create \
  --username admin \
  --email admin@ruangbaca.id \
  --password PasswordAdmin123 \
  --nama-lengkap "Administrator Utama" \
  --no-hp 081234567890 \
  --alamat "Gedung Perpustakaan Lt. 1"
```

### Reset Seluruh Isi Database (`pnpm db:reset`)
Untuk mengosongkan seluruh tabel (`accounts`, `admins`, `users`, `categories`, `books`, `temp_peminjaman`, `peminjaman`, `temp_pengembalian`, `pengembalian`, `daftar_denda`, `laporan`, `refresh_token`) beserta sequence auto-increment pada database aktif (SQLite maupun PostgreSQL):

```bash
# Dengan konfirmasi interaktif (y/N):
pnpm db:reset

# Langsung eksekusi tanpa prompt konfirmasi:
pnpm db:reset -- --yes
```

---

## 6. Menjalankan di Mode Development

```bash
# 1. Jalankan migrasi & build package database (SQLite)
pnpm db:migrate
pnpm db:build

# 2. Build stylesheet Tailwind CSS
pnpm css:build

# 3. Buat akun Admin awal (jika belum ada)
pnpm admin:create

# 4. Jalankan server NestJS dalam mode watch
pnpm start:dev
```
Buka `http://localhost:3000` (atau sesuai `PORT` di `.env`).

---

## 7. Deployment Production dengan Docker (NestJS + PostgreSQL 18)

File [Dockerfile](file:///home/dimstyle/main/myProject/ruang-baca/Dockerfile) dan [docker-compose.yml](file:///home/dimstyle/main/myProject/ruang-baca/docker-compose.yml) telah dikonfigurasi untuk menjalankan **NestJS Production** bersama **PostgreSQL 18 (`postgres:18-alpine`)**.

### Langkah-langkah Menjalankan Docker Compose:

1. **Generate `.env` terlebih dahulu** (jika belum ada):
   ```bash
   pnpm env:generate admin_prod
   ```
   *(Catatan: Pada `docker-compose.yml`, container `app` otomatis mengosongkan `SQLITE_PATH=""` dan mengarahkan `POSTGRESS_HOST=postgres` ke container database PostgreSQL 18).*

2. **Build dan jalankan container di background:**
   ```bash
   docker compose up -d --build
   ```
   Saat container berjalan, skema tabel PostgreSQL ([docker/init-postgres.sql](file:///home/dimstyle/main/myProject/ruang-baca/docker/init-postgres.sql)) akan diinisialisasi secara otomatis.

3. **Buat akun Admin pada database PostgreSQL di container:**
   ```bash
   docker compose exec app pnpm admin:create
   ```

4. **Periksa status dan log aplikasi:**
   ```bash
   docker compose ps
   docker compose logs -f app
   ```

5. **Menghentikan container:**
   ```bash
   docker compose down
   # Tambahkan -v jika ingin menghapus volume data PostgreSQL:
   # docker compose down -v
   ```

---

## 8. Pengujian & Daftar Perintah (`pnpm` Scripts)

| Perintah | Deskripsi |
| :--- | :--- |
| `pnpm env:generate` | Generate `.env` dari `.env.example` dengan SHA-256 random secret/password & input username |
| `pnpm admin:create` | Buat akun Admin baru langsung ke database aktif (validasi password min. 8 karakter) |
| `pnpm db:reset` | Kosongkan seluruh tabel & reset sequence pada database aktif (SQLite / PostgreSQL) |
| `pnpm db:migrate` | Jalankan migrasi Prisma pada `@ruangbaca/database` |
| `pnpm db:build` | Generate Prisma Client & kompilasi TypeScript `@ruangbaca/database` |
| `pnpm css:build` | Kompilasi & minifikasi `styles/tailwind.css` ke `public/css/style.css` |
| `pnpm build` | Build database, CSS, dan aplikasi NestJS (`dist/`) |
| `pnpm start:dev` | Jalankan server NestJS dalam mode development (`--watch`) |
| `pnpm start:prod` | Jalankan hasil build production (`node dist/main`) |
| `pnpm test` | Jalankan seluruh unit test Jest |
| `pnpm test:e2e` | Jalankan end-to-end test Supertest |
| `pnpm lint` | Jalankan ESLint pada seluruh source code |
| `pnpm uml` / `pnpm uml:build` | Jalankan / build aplikasi dokumentasi diagram UML (`docs/uml`) |

---

## 9. Rute Halaman UI & Endpoint API

### Halaman SSR UI (Gmail-Style)
- `GET /login` — Halaman Login
- `GET /app/katalog` — Katalog Buku (Publik, Anggota, Admin)
- `GET /app/kategori` — Daftar Kategori Buku (Publik, Anggota, Admin)
- `GET /app/peminjaman-saya` — Daftar Peminjaman & Pengajuan Pengembalian (Anggota)
- `GET /app/admin/permintaan-peminjaman` — Verifikasi Permintaan Peminjaman (Admin)
- `GET /app/admin/permintaan-pengembalian` — Verifikasi Permintaan Pengembalian (Admin)
- `GET /app/admin/anggota` — Manajemen Anggota / Registrasi User (Admin)
- `GET /app/admin/denda` — Manajemen & Pembayaran Denda (Admin)
- `GET /app/admin/laporan` & `GET /app/admin/laporan/:id` — Laporan & Detail Laporan (Admin)

### Endpoint REST API (`/api/*`)
- **Auth**: `POST /api/auth/registration`, `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/refresh_token`
- **Admins**: `GET /api/admins/listuser`, `GET /api/admins/getuser`, `PUT /api/admins/updateuser`, `DELETE /api/admins/deleteuser`, `POST /api/admins/createdenda`, `PUT /api/admins/updatedenda`, `GET /api/admins/getdenda`, `POST /api/admins/createlaporan`, `GET /api/admins/readlaporan`, `GET /api/admins/readlistlaporan`
- **Books & Categories**: `GET /api/books/readlistcategories`, `POST /api/books/createcategory`, `PUT /api/books/updatecategory`, `DELETE /api/books/deletecategory`, `GET /api/books/getbook`, `POST /api/books/createbook`, `PUT /api/books/updatebook`, `DELETE /api/books/deletebook`
- **Peminjaman**: `POST /api/peminjaman/peminjaman`, `POST /api/peminjaman/pengembalian`, `POST /api/peminjaman/acceptpeminjaman`, `POST /api/peminjaman/acceptpengembalian`, `GET /api/peminjaman/listtemppeminjaman`, `GET /api/peminjaman/listtemppengembalian`, `GET /api/peminjaman/listpeminjaman`

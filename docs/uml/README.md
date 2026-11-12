# Ruang Baca — UML & Architecture Diagrams

Dokumentasi visual arsitektur sistem Ruang Baca yang dibangun sebagai aplikasi SPA (Single Page Application) interaktif berbasis web untuk me-render diagram Mermaid secara dinamis dengan palet warna terstandar dan navigasi dropdown per kategori.

---

## 📦 Spesifikasi Package & Teknologi

| Package / Tool | Versi | Peran & Deskripsi |
|---|---|---|
| **React** | `^19.3.1` | UI Library utama untuk manajemen state reaktif (kategori dropdown aktif, pemilihan diagram, dan lifecycle render diagram). |
| **Mermaid.js** | `^12.3.0` | Diagramming & charting engine berbasis JavaScript yang mengonversi sintaks teks deklaratif (markdown-like) menjadi vektor SVG secara dinamis di browser. |
| **Tailwind CSS** | `^4.3.5` | Framework utility-first CSS modern yang diintegrasikan langsung via plugin Vite `@tailwindcss/vite` untuk styling layout, dropdown interaktif, dan animasi transisi. |
| **Vite** | `^8.3.6` | Next-generation build tool & dev server berkecapatan tinggi dengan fitur HMR (Hot Module Replacement) dan bundling efisien. |
| **TypeScript** | `~7.0.2` | Menjamin type safety untuk model diagram, kategori navigasi, serta konfigurasi tema Mermaid. |
| **Oxlint** | `^1.90.0` | Linter ultra-cepat berbasis Rust untuk menjaga kualitas dan konsistensi kode JavaScript/TypeScript. |

---

## 🎨 Palet Warna & Desain (60-30-10 Rule)

Aplikasi dan diagram Mermaid disesuaikan menggunakan harmoni proporsi warna:

* **60% Dominant (`#542177`)**: Warna dasar latar belakang aplikasi, kanvas render diagram, subgraph cluster, dan kontainer utama.
* **30% Secondary (`#8E1EA2`)**: Header navigasi, dropdown menu, kartu pembungkus diagram, background node/shape Mermaid, serta aktor diagram.
* **10% Accent (`#D552A3`)**: Aksen penanda interaksi (dropdown item aktif, tombol fokus, badge kategori, garis relasi/panah, border, dan sinyal alur).

---

## 🧭 Apa Saja yang Ada di Mermaid?

Mermaid pada project ini digunakan untuk memvisualisasikan seluruh alur sistem, relasi data, hingga spesifikasi API controller.

### 1. Kategori Diagram yang Didukung Dropdown
Sistem pengelompokan otomatis mengklasifikasikan setiap file diagram ke dalam salah satu dari 5 pilihan kategori dropdown:

1. **Flow Chart**: Pemetaan alur logika proses atau workflow fungsional (syntax: `flowchart LR` / `flowchart TD`).
2. **Use Case**: Pemetaan interaksi aktor (`User`, `Admin`) dengan fitur sistem Ruang Baca serta relasi `<<extend>>`.
3. **Activity Diagram**: Pemetaan transisi status atau aktivitas internal (syntax: `stateDiagram-v2`).
4. **Sequence Diagram**: Alur request-response setiap HTTP endpoint mulai dari Client, Controller, Service, Database, hingga Cookie/Token.
5. **ERD (Entity Relationship Diagram)**: Struktur tabel relasional basis data Ruang Baca beserta kardinalitas dan primary/foreign key.

### 2. Fitur Khusus: Ukuran Use Case Seragam (Uniform Size)
Secara default, lingkaran use case Mermaid menyesuaikan ukuran teks di dalamnya sehingga menghasilkan bulatan yang tidak sama besar. Di project ini, diterapkan standarisasi:
- Penambahan class selektor `usecase` otomatis pada node use case `((...))`.
- Kontrol ukuran container `foreignObject` via [src/index.css](src/index.css) (`120px` × `28px`) dengan flex centering dan text nowrap, menghasilkan visual use case yang seragam dan simetris di diagram.

### 3. Daftar Diagram yang Tersedia (`src/diagrams/list-diagrams/`)
Setiap diagram disimpan dalam file `.mmd` terpisah:

* **Use Case**:
  * `use-case.mmd`: Diagram use case lengkap sistem Ruang Baca (Auth, Admin User Management, Admin Denda Management).
* **ERD**:
  * `erd.mmd`: ERD relasi tabel `accounts`, `users`, `admins`, `refresh_token`, `categories`, `books`, `peminjaman`, `detail_peminjaman`, `pengembalian`, `laporan`, dan `daftar_denda`.
* **Sequence Diagram**:
  * `sequence-login.mmd`: Alur autentikasi login akun dan pembuatan JWT access & refresh token.
  * `sequence-register.mmd`: Alur registrasi akun dan verifikasi password hash.
  * `sequence-logout.mmd`: Alur pembersihan session dan token logout.
  * `sequence-refresh-token.mmd`: Alur rotasi refresh token dan reissue access token.
  * `sequence-getuser.mmd`: Alur query admin membaca data pengguna.
  * `sequence-updateuser.mmd`: Alur update profil user oleh admin.
  * `sequence-deleteuser.mmd`: Alur penghapusan akun user oleh admin.
  * `sequence-createdenda.mmd`: Alur pencatatan denda keterlambatan buku.
  * `sequence-updatedenda.mmd`: Alur perubahan nominal atau status denda.
  * `sequence-getdenda.mmd`: Alur query pembacaan riwayat denda.

---

## 🛠️ Cara Menjalankan & Menambah Diagram

### Menjalankan Development Server
Dari direktori root proyek:
```bash
pnpm uml
```
Atau langsung dari direktori `docs/uml/`:
```bash
pnpm dev
```
Buka browser di alamat `http://localhost:5173`.

### Melakukan Build Production
```bash
pnpm uml:build
```

### Menambahkan Diagram Baru
Cukup buat file baru di `docs/uml/src/diagrams/list-diagrams/` dengan format nama berikut (otomatis terdeteksi oleh sistem Vite glob import):
* **Use Case**: Beri awalan `use-case-*.mmd`
* **Sequence**: Beri awalan `sequence-*.mmd`
* **ERD**: Beri awalan `erd-*.mmd` atau `erd.mmd`
* **Activity**: Beri awalan `activity-*.mmd`
* **Flow Chart**: Beri awalan `flow-*.mmd`

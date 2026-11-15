#!/usr/bin/env python3
"""
Populates docs/SRS_and_System_Design_Master_Planning.docx using its existing
OpenXML template styles, cover page, TOC field, and _Toc bookmarks, filling in
all requirements from docs/soal.pdf and the Ruang Baca codebase.
"""

from pathlib import Path
import zipfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
DOCX_PATH = ROOT / "docs" / "SRS_and_System_Design_Master_Planning.docx"

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
XML_NS = "http://www.w3.org/XML/1998/namespace"


def esc(text: str) -> str:
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def p_heading(level: int, text: str, bookmarks: list[tuple[int, str]] | None = None) -> str:
    """level 1 -> style '2' (Heading 1), level 2 -> style '3' (Heading 2), level 3 -> style '4' (Heading 3)."""
    style_map = {1: "2", 2: "3", 3: "4"}
    style_id = style_map.get(level, "3")
    bm_start = "".join(
        f'<w:bookmarkStart w:id="{bid}" w:name="{esc(bname)}"/>'
        for bid, bname in (bookmarks or [])
    )
    bm_end = "".join(
        f'<w:bookmarkEnd w:id="{bid}"/>' for bid, _ in (bookmarks or [])
    )
    return (
        f'<w:p><w:pPr><w:pStyle w:val="{style_id}"/></w:pPr>'
        f"{bm_start}<w:r><w:t>{esc(text)}</w:t></w:r>{bm_end}</w:p>"
    )


def p_text(text: str, bold_prefix: str = "", italic: bool = False) -> str:
    runs = []
    if bold_prefix:
        runs.append(
            f'<w:r><w:rPr><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>'
            f'<w:t xml:space="preserve">{esc(bold_prefix)}</w:t></w:r>'
        )
    rpr = '<w:rPr><w:i/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>' if italic else '<w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>'
    runs.append(f'{rpr and f"<w:r>{rpr}" or "<w:r>"}<w:t xml:space="preserve">{esc(text)}</w:t></w:r>')
    return (
        '<w:p><w:pPr><w:spacing w:after="140" w:line="276" w:lineRule="auto"/>'
        '<w:jc w:val="both"/></w:pPr>' + "".join(runs) + "</w:p>"
    )


def p_bullet(bold_prefix: str, text: str) -> str:
    runs = []
    if bold_prefix:
        runs.append(
            f'<w:r><w:rPr><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>'
            f'<w:t xml:space="preserve">{esc(bold_prefix)}</w:t></w:r>'
        )
    runs.append(
        f'<w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>'
        f'<w:t xml:space="preserve">{esc(text)}</w:t></w:r>'
    )
    return (
        '<w:p><w:pPr><w:pStyle w:val="23"/><w:spacing w:after="80" w:line="260" w:lineRule="auto"/>'
        '<w:jc w:val="both"/></w:pPr>' + "".join(runs) + "</w:p>"
    )


def p_code(code_text: str) -> str:
    lines = code_text.strip().splitlines()
    run_parts = []
    for idx, line in enumerate(lines):
        if idx > 0:
            run_parts.append("<w:r><w:br/></w:r>")
        run_parts.append(
            '<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>'
            '<w:sz w:val="18"/><w:szCs w:val="18"/><w:color w:val="1F1F1F"/></w:rPr>'
            f'<w:t xml:space="preserve">{esc(line)}</w:t></w:r>'
        )
    return (
        '<w:p><w:pPr>'
        '<w:pBdr>'
        '<w:top w:val="single" w:sz="4" w:space="4" w:color="D0D7DE"/>'
        '<w:left w:val="single" w:sz="12" w:space="6" w:color="0B57D0"/>'
        '<w:bottom w:val="single" w:sz="4" w:space="4" w:color="D0D7DE"/>'
        '<w:right w:val="single" w:sz="4" w:space="4" w:color="D0D7DE"/>'
        '</w:pBdr>'
        '<w:shd w:val="clear" w:color="auto" w:fill="F6F8FC"/>'
        '<w:spacing w:before="80" w:after="140" w:line="240" w:lineRule="auto"/>'
        '</w:pPr>' + "".join(run_parts) + "</w:p>"
    )


def table_xml(headers: list[str], rows: list[list[str]], col_widths: list[int] | None = None) -> str:
    total_w = 9000
    n_cols = len(headers)
    if not col_widths or len(col_widths) != n_cols:
        col_widths = [total_w // n_cols] * n_cols

    grid_cols = "".join(f'<w:gridCol w:w="{w}"/>' for w in col_widths)

    header_cells = []
    for idx, h in enumerate(headers):
        w = col_widths[idx]
        header_cells.append(
            f'<w:tc><w:tcPr><w:tcW w:w="{w}" w:type="dxa"/>'
            '<w:shd w:val="clear" w:color="auto" w:fill="0B57D0"/>'
            '<w:vAlign w:val="center"/></w:tcPr>'
            '<w:p><w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr>'
            '<w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>'
            f'<w:t xml:space="preserve">{esc(h)}</w:t></w:r></w:p></w:tc>'
        )
    tr_header = f'<w:tr><w:trPr><w:tblHeader/></w:trPr>{"".join(header_cells)}</w:tr>'

    body_rows = []
    for r_idx, row in enumerate(rows):
        fill = "F6F8FC" if r_idx % 2 == 1 else "FFFFFF"
        cells = []
        for c_idx, val in enumerate(row):
            w = col_widths[c_idx]
            cells.append(
                f'<w:tc><w:tcPr><w:tcW w:w="{w}" w:type="dxa"/>'
                f'<w:shd w:val="clear" w:color="auto" w:fill="{fill}"/>'
                '<w:vAlign w:val="top"/></w:tcPr>'
                '<w:p><w:pPr><w:spacing w:before="50" w:after="50" w:line="240" w:lineRule="auto"/></w:pPr>'
                '<w:r><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr>'
                f'<w:t xml:space="preserve">{esc(val)}</w:t></w:r></w:p></w:tc>'
            )
        body_rows.append(f'<w:tr>{"".join(cells)}</w:tr>')

    return (
        '<w:tbl>'
        '<w:tblPr>'
        '<w:tblStyle w:val="35"/>'
        f'<w:tblW w:w="{sum(col_widths)}" w:type="dxa"/>'
        '<w:tblBorders>'
        '<w:top w:val="single" w:sz="4" w:space="0" w:color="D0D7DE"/>'
        '<w:left w:val="single" w:sz="4" w:space="0" w:color="D0D7DE"/>'
        '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="D0D7DE"/>'
        '<w:right w:val="single" w:sz="4" w:space="0" w:color="D0D7DE"/>'
        '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="E0E3E7"/>'
        '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="E0E3E7"/>'
        '</w:tblBorders>'
        '<w:tblCellMar>'
        '<w:top w:w="60" w:type="dxa"/>'
        '<w:left w:w="108" w:type="dxa"/>'
        '<w:bottom w:w="60" w:type="dxa"/>'
        '<w:right w:w="108" w:type="dxa"/>'
        '</w:tblCellMar>'
        '</w:tblPr>'
        f'<w:tblGrid>{grid_cols}</w:tblGrid>'
        f"{tr_header}{''.join(body_rows)}"
        '</w:tbl>'
        '<w:p><w:pPr><w:spacing w:after="100"/></w:pPr></w:p>'
    )


def collect_sql_queries() -> list[tuple[str, str, str]]:
    """Returns (module_file, query_name, sql_text) from all src/*/sql/*.queries.sql."""
    results = []
    for sql_file in sorted((ROOT / "src").glob("*/*.queries.sql")) + sorted(
        (ROOT / "src").glob("*/sql/*.queries.sql")
    ):
        rel = sql_file.relative_to(ROOT).as_posix()
        raw = sql_file.read_text(encoding="utf-8")
        blocks = raw.split("-- name:")
        for b in blocks[1:]:
            lines = b.strip().splitlines()
            if not lines:
                continue
            qname = lines[0].strip()
            qsql = "\n".join(lines[1:]).strip()
            results.append((rel, qname, qsql))
    return results


def build_body_content() -> list[str]:
    els: list[str] = []

    # =========================================================================
    # 1. PENDAHULUAN (INTRODUCTION)
    # =========================================================================
    els.append(
        '<w:p><w:pPr><w:pStyle w:val="2"/><w:bidi w:val="0"/></w:pPr>'
        '<w:r><w:br w:type="page"/></w:r>'
        '<w:bookmarkStart w:id="2" w:name="_Toc1254584190"/>'
        '<w:bookmarkStart w:id="3" w:name="_Toc1564557035"/>'
        '<w:r><w:t>1. Pendahuluan (Introduction)</w:t></w:r>'
        '<w:bookmarkEnd w:id="2"/><w:bookmarkEnd w:id="3"/></w:p>'
    )

    els.append(
        p_heading(
            2,
            "1.1 Tujuan (Purpose)",
            [(4, "_Toc1608815828"), (5, "_Toc2128048468")],
        )
    )
    els.append(
        p_text(
            "Dokumen Software Requirement Specification (SRS) & System Design ini disusun untuk mendokumentasikan secara menyeluruh hasil analisis kebutuhan, metodologi rekayasa perangkat lunak, pemodelan UML (Use Case, Activity, Sequence, Flowchart, dan ERD), rancangan basis data beserta kumpulan query SQL, penerapan pemrograman berorientasi objek (OOP), serta spesifikasi desain antarmuka pengguna (UI/UX) pada aplikasi perpustakaan digital \"Ruang Baca\"."
        )
    )
    els.append(
        p_text(
            "Berdasarkan narasi permasalahan pada Tugas Project Kelas XII PPLG (2026/2027), tingkat minat baca pada anak generasi Z (milenial/gen Z) mengalami penurunan yang signifikan. Untuk menjawab tantangan tersebut, dibangunlah aplikasi perpustakaan \"Ruang Baca\" dengan tampilan antarmuka bergaya Gmail (Gmail-Style UI) yang bersih, responsif, cepat, dan menarik secara visual sehingga meningkatkan daya tarik serta kemudahan akses membaca bagi siswa dan mahasiswa generasi Z."
        )
    )

    els.append(
        p_heading(
            2,
            "1.2 Lingkup Produk (Product Scope)",
            [(6, "_Toc396024659"), (7, "_Toc1364722614")],
        )
    )
    els.append(
        p_text(
            "Aplikasi \"Ruang Baca\" adalah sistem manajemen perpustakaan berbasis web yang memfasilitasi sirkulasi peminjaman dan pengembalian buku, pengelolaan koleksi buku dan kategori, pengelolaan akun anggota, pengelolaan denda keterlambatan/kerusakan/kehilangan buku, serta pembuatan laporan perpustakaan secara terpadu."
        )
    )
    els.append(
        p_bullet(
            "Dua Peran Pengguna (Dual-Role Access Control): ",
            "Sistem memisahkan hak akses secara tegas antara Anggota (User) dan Petugas Perpustakaan (Admin) menggunakan autentikasi JWT pada cookie HttpOnly serta proteksi AdminGuard.",
        )
    )
    els.append(
        p_bullet(
            "Peminjaman Multi-Buku Terjadwal: ",
            "Anggota dapat meminjam lebih dari satu buku sekaligus dengan tanggal peminjaman dan batas waktu pengembalian yang ditentukan dan diverifikasi oleh Admin melalui tabel antrean (temp_peminjaman -> peminjaman).",
        )
    )
    els.append(
        p_bullet(
            "Pengembalian & Pencatatan Denda Terintegrasi (<<extend>> Create Denda): ",
            "Saat anggota mengajukan pengembalian buku (temp_pengembalian), Admin memeriksa kondisi fisik buku (Baik, Rusak, atau Hilang) serta keterlambatan tanggal pengembalian. Bila status terlambat atau kondisi buku Rusak/Hilang, form input nominal denda dan keterangan wajib diisi langsung pada dialog penerimaan pengembalian sebelum disetujui.",
        )
    )
    els.append(
        p_bullet(
            "Manajemen Pelunasan Denda (<<extend>> Delete Denda): ",
            "Halaman Denda khusus menampilkan total denda belum lunas, daftar tunggakan anggota, serta pencatatan pembayaran cicilan/pelunasan yang otomatis menghapus tagihan ketika sisa denda mencapai Rp0.",
        )
    )
    els.append(
        p_bullet(
            "Pelaporan Sirkulasi & Denda: ",
            "Admin dapat membuat dan memfilter laporan berkala yang merangkum daftar peminjaman, daftar pengembalian, total peminjam, dan total akumulasi denda berdasarkan rentang tanggal.",
        )
    )

    # =========================================================================
    # 2. DESKRIPSI UMUM (OVERALL DESCRIPTION)
    # =========================================================================
    els.append(
        p_heading(
            1,
            "2. Deskripsi Umum (Overall Description)",
            [(8, "_Toc1819187443"), (9, "_Toc1111248991")],
        )
    )
    els.append(
        p_text(
            "Bagian ini menjelaskan konteks operasional sistem, matriks pembagian fitur antara Anggota dan Petugas (Admin), karakteristik pengguna sasaran (siswa & mahasiswa Generasi Z), serta metodologi rekayasa perangkat lunak yang digunakan dalam pembangunan Ruang Baca."
        )
    )

    els.append(p_heading(3, "2.1 Matriks Fitur User Interface (Anggota vs Petugas)"))
    els.append(
        p_text(
            "Sesuai dengan spesifikasi pada dokumen soal proyek, pembagian hak akses fitur antara Anggota (User) dan Petugas (Admin) pada aplikasi Ruang Baca dirangkum pada tabel berikut:"
        )
    )
    els.append(
        table_xml(
            ["No", "Fitur Sistem", "Anggota (User)", "Petugas (Admin)", "Implementasi pada Ruang Baca"],
            [
                [
                    "1",
                    "Login dan Logout",
                    "V",
                    "V",
                    "POST /api/auth/login, POST /api/auth/logout, POST /api/auth/refresh_token, serta halaman GET /login.",
                ],
                [
                    "2",
                    "CRUD Anggota",
                    "-",
                    "V",
                    "POST /api/auth/registration (<<extend>> Create User), GET /api/admins/listuser, GET /api/admins/getuser, PUT /api/admins/updateuser, DELETE /api/admins/deleteuser (Halaman /app/admin/anggota).",
                ],
                [
                    "3",
                    "CRUD Buku",
                    "Read (Katalog)",
                    "V",
                    "GET /api/books/getbook, POST /api/books/createbook, PUT /api/books/updatebook, DELETE /api/books/deletebook (Halaman /app/katalog).",
                ],
                [
                    "4",
                    "CRUD Kategori",
                    "Read (Filter)",
                    "V",
                    "GET /api/books/readlistcategories, POST /api/books/createcategory, PUT /api/books/updatecategory, DELETE /api/books/deletecategory (Halaman /app/kategori).",
                ],
                [
                    "5",
                    "CRUD Denda",
                    "-",
                    "V",
                    "Create Denda menyatu sebagai <<extend>> pada Accept Pengembalian (POST /api/peminjaman/acceptpengembalian & POST /api/admins/createdenda); Read Denda, Total Denda, & Update/Pelunasan Denda (<<extend>> Delete Denda) pada GET /api/admins/getdenda & PUT /api/admins/updatedenda (Halaman /app/admin/denda).",
                ],
                [
                    "6",
                    "Peminjaman dan Pengembalian Buku",
                    "V",
                    "V",
                    "Anggota mengajukan pinjam (POST /api/peminjaman/peminjaman) & kembalikan (POST /api/peminjaman/pengembalian); Admin menyetujui pinjam (POST /api/peminjaman/acceptpeminjaman) & menerima kembalikan (POST /api/peminjaman/acceptpengembalian).",
                ],
                [
                    "7",
                    "History Peminjaman dan Pengembalian Buku",
                    "V",
                    "V",
                    "GET /api/peminjaman/listpeminjaman (tab Menunggu Persetujuan, Sedang Dipinjam, & Riwayat pada /app/peminjaman-saya) serta antrean Admin (listtemppeminjaman & listtemppengembalian).",
                ],
                [
                    "8",
                    "Laporan",
                    "-",
                    "V",
                    "POST /api/admins/createlaporan, GET /api/admins/readlistlaporan, GET /api/admins/readlaporan (<<extend>> dari Read List Laporan pada /app/admin/laporan & /app/admin/laporan/:id).",
                ],
            ],
            [500, 1800, 1100, 1100, 4500],
        )
    )

    els.append(
        p_heading(
            3,
            "2.2 Metodologi Rekayasa Perangkat Lunak (Metode Agile) & Tahapan Detailnya",
        )
    )
    els.append(
        p_text(
            "Pengembangan aplikasi Ruang Baca menerapkan metodologi Agile Software Development (Metode Agile). Metode Agile dipilih karena mengutamakan pengembangan perangkat lunak secara iteratif (berulang dalam siklus Sprint pendek), inkremental (fitur dibangun dan dikirimkan per modul secara bertahap), kolaboratif, serta sangat adaptif terhadap perubahan kebutuhan (seperti penyesuaian alur pencatatan denda yang diintegrasikan langsung sebagai <<extend>> pada penerimaan pengembalian buku)."
        )
    )
    els.append(
        p_text(
            "Setiap siklus iterasi (Sprint) pada metode Agile dalam pembangunan aplikasi Ruang Baca meliputi 6 tahapan utama yang dijelaskan secara detail pada tabel berikut:"
        )
    )
    els.append(
        table_xml(
            ["Tahap Agile", "Nama Tahapan", "Penjelasan Detail Aktivitas & Artefak yang Dihasilkan"],
            [
                [
                    "Tahap 1",
                    "Requirements & Sprint Planning (Perencanaan & Product Backlog)",
                    "Mengidentifikasi permasalahan kurangnya minat baca generasi Z, menentukan dua aktor utama (Anggota & Admin), menyusun daftar prioritas fitur (Product Backlog & tasks.md), merumuskan kebutuhan fungsional (REQ-F-001 s/d REQ-F-025) dan non-fungsional (REQ-NF-001 s/d REQ-NF-008), serta menyusun kontrak spesifikasi di direktori specs/ (api-spec.md, database-contracts.md, dan users-flow-spec/).",
                ],
                [
                    "Tahap 2",
                    "System, Database & UI/UX Design (Perancangan Sistem & Prototipe)",
                    "Merancang skema basis data relasional 12 tabel dalam ERD (erd.mmd & erd.drawio), memetakan hak akses dalam Use Case Diagram (use-case.mmd & use-case.drawio) beserta relasi <<extend>>, menyusun 25 Activity Diagram, 25 Flowchart, dan 25 Sequence Diagram, serta merancang sistem desain Gmail-Style UI (aturan warna 60-30-10) di specs/ui-specs.md dan prototipe visual 10 halaman di Framer.",
                ],
                [
                    "Tahap 3",
                    "Iterative Development / Coding (Pengembangan Inkremental Berbasis OOP)",
                    "Membangun fitur secara bertahap per Sprint modul (Sprint 1: Auth & Users, Sprint 2: Denda & Laporan, Sprint 3: Books & Categories, Sprint 4: Peminjaman & Pengembalian, Sprint 5: SSR Gmail-Style UI) menggunakan NestJS 11 (TypeScript) dengan prinsip Object-Oriented Programming (Controller, Service, Guard, Strategy, DTO, dan Dual-Engine PrismaService untuk SQLite & PostgreSQL 18) serta query SQL eksplisit di src/*/sql/*.queries.sql.",
                ],
                [
                    "Tahap 4",
                    "Testing & Debugging (Pengujian Berkelanjutan & Real-Time Testing)",
                    "Melakukan pengujian otomatis dan pendeteksian bug (debugging) pada setiap akhir Sprint melalui validasi DTO (ValidationPipe), pemetaan kode error database (P2002 Unique Constraint -> 409 Conflict, P2003 Foreign Key -> 409 Conflict), pencatatan log terstruktur (NestJS Logger), serta menjalankan 100 unit test (Jest) di 7 test suite dan 2 e2e test (Supertest).",
                ],
                [
                    "Tahap 5",
                    "Deployment & Release (Rilis & Otomasi Infrastruktur)",
                    "Menyediakan CLI runner untuk otomasi operasional (pnpm env:generate dengan hash acak SHA-256, pnpm admin:create dengan validasi password minimal 8 karakter, pnpm db:reset, dan pnpm uml:drawio), serta menyiapkan rilis produksi menggunakan multi-stage Dockerfile dan docker-compose.yml berbasis PostgreSQL 18.",
                ],
                [
                    "Tahap 6",
                    "Review & Retrospective (Evaluasi & Adaptasi Perubahan Kebutuhan)",
                    "Mengevaluasi hasil inkremen bersama pengguna/penguji pada setiap akhir iterasi dan menindaklanjuti umpan balik perubahan secara cepat (Agile adaptation), seperti penyatuan fitur Create Denda menjadi <<extend>> pada Accept Pengembalian serta pembaruan sinkron pada kode UI, kanvas Framer, diagram UML/Draw.io, dan dokumen spesifikasi.",
                ],
            ],
            [1100, 2200, 5700],
        )
    )

    # =========================================================================
    # 3. KEBUTUHAN SPESIFIK (SPECIFIC REQUIREMENTS)
    # =========================================================================
    els.append(
        p_heading(
            1,
            "3. Kebutuhan Spesifik (Specific Requirements)",
            [(10, "_Toc1476030315"), (11, "_Toc514916521")],
        )
    )
    els.append(
        p_heading(
            2,
            "3.1 Kebutuhan Fungsional",
            [(12, "_Toc274007012"), (13, "_Toc1465737165")],
        )
    )
    els.append(
        p_text(
            "Kebutuhan fungsional mendefinisikan seluruh layanan, validasi input, dan perilaku bisnis yang wajib disediakan oleh sistem Ruang Baca bagi Anggota (User) maupun Petugas (Admin):"
        )
    )
    els.append(
        table_xml(
            ["Kode", "Modul", "Nama Fitur / Gate", "Aktor", "Spesifikasi Detail & Aturan Bisnis"],
            [
                [
                    "REQ-F-001",
                    "Auth",
                    "Registration (<<extend>> Create User)",
                    "Admin",
                    "Admin mendaftarkan akun anggota baru (POST /api/auth/registration) dengan input username, email, password (min. 8 karakter, di-hash dengan bcrypt), nama_lengkap, no_hp, dan alamat. Sistem menyimpan ke tabel accounts (role 'user') dan users secara atomik. Mengembalikan 409 jika username/email sudah terdaftar.",
                ],
                [
                    "REQ-F-002",
                    "Auth",
                    "Login",
                    "User, Admin",
                    "Pengguna masuk (POST /api/auth/login) menggunakan email dan password. Bila valid, sistem menerbitkan access_token (15 menit) dan refresh_token (7 hari) pada cookie HttpOnly serta mencatat sesi di tabel refresh_token.",
                ],
                [
                    "REQ-F-003",
                    "Auth",
                    "Logout",
                    "User, Admin",
                    "Pengguna keluar (POST /api/auth/logout). Sistem menghapus catatan refresh_token milik akun dari database dan membersihkan cookie access_token serta refresh_token.",
                ],
                [
                    "REQ-F-004",
                    "Auth",
                    "Refresh Token",
                    "User, Admin",
                    "Memperbarui sesi secara otomatis (POST /api/auth/refresh_token) menggunakan cookie refresh_token yang masih berlaku dan belum kedaluwarsa di database.",
                ],
                [
                    "REQ-F-005",
                    "Admins (Users)",
                    "List Users",
                    "Admin",
                    "Menampilkan daftar seluruh anggota terdaftar beserta informasi akun dan biodata (GET /api/admins/listuser).",
                ],
                [
                    "REQ-F-006",
                    "Admins (Users)",
                    "Get User Detail",
                    "Admin",
                    "Mengambil detail profil lengkap seorang anggota berdasarkan id_user (GET /api/admins/getuser). Mengembalikan 404 jika anggota tidak ditemukan.",
                ],
                [
                    "REQ-F-007",
                    "Admins (Users)",
                    "Update User",
                    "Admin",
                    "Memperbarui biodata anggota (nama_lengkap, no_hp, alamat, updated_at) berdasarkan id_user (PUT /api/admins/updateuser).",
                ],
                [
                    "REQ-F-008",
                    "Admins (Users)",
                    "Delete User",
                    "Admin",
                    "Menghapus akun anggota beserta biodatanya (DELETE /api/admins/deleteuser). Menolak penghapusan dengan 409 Conflict apabila anggota masih memiliki riwayat peminjaman aktif/tercatat.",
                ],
                [
                    "REQ-F-009",
                    "Books",
                    "Create Category",
                    "Admin",
                    "Menambahkan kategori buku baru dengan atribut nama_kategori dan jenis_buku (POST /api/books/createcategory). Mengembalikan 409 jika kategori sudah ada.",
                ],
                [
                    "REQ-F-010",
                    "Books",
                    "Read List Categories",
                    "Publik, User, Admin",
                    "Menampilkan daftar seluruh kategori buku (GET /api/books/readlistcategories) untuk navigasi tab dan filter katalog.",
                ],
                [
                    "REQ-F-011",
                    "Books",
                    "Update Category",
                    "Admin",
                    "Memperbarui nama_kategori dan/atau jenis_buku berdasarkan id kategori (PUT /api/books/updatecategory).",
                ],
                [
                    "REQ-F-012",
                    "Books",
                    "Delete Category",
                    "Admin",
                    "Menghapus kategori buku (DELETE /api/books/deletecategory). Mengembalikan 409 Conflict (onDelete: Restrict) jika kategori masih direferensikan oleh data buku.",
                ],
                [
                    "REQ-F-013",
                    "Books",
                    "Create Book",
                    "Admin",
                    "Menambahkan koleksi buku baru (POST /api/books/createbook) dengan kategori_id, judul, penulis, penerbit, sinopsis, tanggal_rilis, dan stok awal. Mengembalikan 404 jika kategori tidak ditemukan.",
                ],
                [
                    "REQ-F-014",
                    "Books",
                    "Get Books (Katalog)",
                    "Publik, User, Admin",
                    "Menampilkan daftar seluruh koleksi buku lengkap dengan nama_kategori, jenis_buku, sinopsis, dan status ketersediaan stok (GET /api/books/getbook).",
                ],
                [
                    "REQ-F-015",
                    "Books",
                    "Update Book",
                    "Admin",
                    "Memperbarui informasi buku dan jumlah stok berdasarkan buku_id (PUT /api/books/updatebook).",
                ],
                [
                    "REQ-F-016",
                    "Books",
                    "Delete Book",
                    "Admin",
                    "Menghapus buku dari katalog berdasarkan buku_id (DELETE /api/books/deletebook).",
                ],
                [
                    "REQ-F-017",
                    "Peminjaman",
                    "Request Peminjaman",
                    "User, Admin",
                    "Anggota mengajukan peminjaman buku (POST /api/peminjaman/peminjaman) dengan book_id dan tanggal_peminjaman. Data masuk ke antrean temp_peminjaman menunggu persetujuan Admin.",
                ],
                [
                    "REQ-F-018",
                    "Peminjaman",
                    "List Temp Peminjaman",
                    "Admin",
                    "Menampilkan seluruh antrean permintaan peminjaman yang menunggu persetujuan Admin (GET /api/peminjaman/listtemppeminjaman).",
                ],
                [
                    "REQ-F-019",
                    "Peminjaman",
                    "Accept Peminjaman",
                    "Admin",
                    "Admin menyetujui permintaan peminjaman dengan menetapkan tanggal_batas_peminjaman (POST /api/peminjaman/acceptpeminjaman). Sistem memindahkan data dari temp_peminjaman ke tabel peminjaman.",
                ],
                [
                    "REQ-F-020",
                    "Peminjaman",
                    "List Peminjaman Saya & Riwayat",
                    "User, Admin",
                    "Menampilkan daftar peminjaman milik anggota (GET /api/peminjaman/listpeminjaman) yang mencakup status Menunggu, Dipinjam, Telat, dan Dikembalikan.",
                ],
                [
                    "REQ-F-021",
                    "Peminjaman",
                    "Request Pengembalian",
                    "User, Admin",
                    "Anggota mengajukan pengembalian buku yang sedang dipinjam (POST /api/peminjaman/pengembalian) dengan peminjaman_id dan tanggal_dikembalikan ke tabel temp_pengembalian.",
                ],
                [
                    "REQ-F-022",
                    "Peminjaman",
                    "List Temp Pengembalian",
                    "Admin",
                    "Menampilkan daftar pengajuan pengembalian buku beserta indikator keterlambatan (GET /api/peminjaman/listtemppengembalian).",
                ],
                [
                    "REQ-F-023",
                    "Peminjaman & Denda",
                    "Accept Pengembalian (<<extend>> Create Denda)",
                    "Admin",
                    "Admin menerima pengembalian buku (POST /api/peminjaman/acceptpengembalian) dengan memilih status_buku (Baik/Rusak/Hilang). Bila pengembalian melewati batas waktu (Telat) atau status_buku adalah Rusak/Hilang, Admin wajib mengisi nominal denda (Rp) dan keterangan denda yang langsung disimpan ke tabel daftar_denda. Bila Baik dan belum telat, input denda disembunyikan.",
                ],
                [
                    "REQ-F-024",
                    "Admins (Denda)",
                    "Read Denda, Total Denda & Update Denda (<<extend>> Delete Denda)",
                    "Admin",
                    "Menampilkan daftar denda belum lunas beserta kartu Total Denda Belum Lunas (GET /api/admins/getdenda) dan mencatat pembayaran denda (PUT /api/admins/updatedenda). Bila sisa denda <= 0, baris denda otomatis dihapus dari daftar_denda (lunas).",
                ],
                [
                    "REQ-F-025",
                    "Admins (Laporan)",
                    "Create Laporan & Read List Laporan (<<extend>> Read Laporan)",
                    "Admin",
                    "Membuat laporan berkala yang menghitung otomatis total_peminjam dan total_denda pada rentang tanggal (POST /api/admins/createlaporan), memfilter daftar laporan berdasarkan rentang tanggal pembuatan (GET /api/admins/readlistlaporan), serta melihat rincian tabel peminjaman dan pengembalian pada laporan terpilih (GET /api/admins/readlaporan).",
                ],
            ],
            [1100, 1200, 1900, 900, 3900],
        )
    )

    els.append(
        p_heading(
            2,
            "3.2 Kebutuhan Non-Fungsional",
            [(14, "_Toc1070069275"), (15, "_Toc57820380")],
        )
    )
    els.append(
        p_text(
            "Kebutuhan non-fungsional menetapkan standar kualitas, keamanan, keandalan, portabilitas basis data, dan estetika antarmuka sistem Ruang Baca:"
        )
    )
    els.append(
        table_xml(
            ["Kode", "Kategori", "Spesifikasi Kebutuhan Non-Fungsional"],
            [
                [
                    "REQ-NF-001",
                    "Keamanan (Security)",
                    "Kata sandi pengguna wajib memiliki panjang minimal 8 karakter dan disimpan menggunakan algoritma hashing bcrypt (10 salt rounds). Token autentikasi JWT disimpan di dalam cookie HttpOnly (SameSite=Lax) untuk mencegah serangan XSS, serta seluruh endpoint Admin dilindungi oleh JwtAuthGuard + AdminGuard.",
                ],
                [
                    "REQ-NF-002",
                    "Portabilitas Basis Data (Dual-Database Engine)",
                    "Sistem wajib mendukung pemilihan engine database secara otomatis melalui variabel lingkungan (.env): menggunakan SQLite (PrismaBetterSqlite3) apabila SQLITE_PATH terkonfigurasi untuk pengembangan lokal, atau otomatis beralih ke PostgreSQL 18 (PostgresDriverAdapter) apabila variabel POSTGRESS_* dikonfigurasi untuk produksi.",
                ],
                [
                    "REQ-NF-003",
                    "Integritas Data & SQL Eksplisit",
                    "Seluruh operasi baca/tulis database wajib menggunakan query SQL eksplisit yang terdokumentasi di dalam direktori src/<fitur>/sql/<nama_task>.queries.sql dengan penegakan Foreign Key Constraint (onDelete: Cascade dan onDelete: Restrict).",
                ],
                [
                    "REQ-NF-004",
                    "Usability & Estetika (Gmail-Style 60-30-10)",
                    "Antarmuka dirancang dengan pola Gmail-Style (sidebar kiri, search bar pill di atas, baris list padat setinggi 48px, floating compose window di kanan bawah, serta Avatar Inisial & Book Tile berwarna). Komposisi warna mengikuti aturan 60% Dominant (#F6F8FC & #FFFFFF), 30% Secondary (#E9EEF6 & #D3E3FD), dan 10% Accent (#0B57D0).",
                ],
                [
                    "REQ-NF-005",
                    "Arsitektur Berorientasi Objek (OOP)",
                    "Kode program wajib menerapkan prinsip Object-Oriented Programming (OOP) secara konsisten menggunakan TypeScript dan NestJS: pemisahan kelas Controller, Service, Guard, Strategy, DTO, dan Adapter dengan Dependency Injection.",
                ],
                [
                    "REQ-NF-006",
                    "Observabilitas & Logging",
                    "Setiap aksi penting, keberhasilan transaksi, peringatan validasi (404/409/422), dan kegagalan tak terduga (500) wajib dicatat menggunakan NestJS Logger pada masing-masing Service.",
                ],
                [
                    "REQ-NF-007",
                    "Kualitas & Pengujian Otomatis",
                    "Seluruh controller dan konfigurasi database wajib memiliki unit test otomatis (100 unit test lulus pada 7 test suite) serta e2e test (Supertest) dan lulus pemeriksaan statis ESLint tanpa peringatan.",
                ],
                [
                    "REQ-NF-008",
                    "Kemudahan Deployment (Docker Production)",
                    "Sistem dilengkapi dengan Dockerfile multi-stage dan docker-compose.yml (NestJS + PostgreSQL 18 Alpine) beserta skrip inisialisasi skema otomatis sehingga siap dijalankan di lingkungan produksi.",
                ],
            ],
            [1200, 2200, 5600],
        )
    )

    # =========================================================================
    # 4. PEMODELAN & DESAIN SISTEM (SYSTEM DESIGN)
    # =========================================================================
    els.append(
        p_heading(
            1,
            "4. Pemodelan & Desain Sistem (System Design)",
            [(16, "_Toc2137913827"), (17, "_Toc1583565512")],
        )
    )
    els.append(
        p_text(
            "Bagian ini menyajikan rancangan rekayasa perangkat lunak secara lengkap sesuai instruksi pada soal proyek, meliputi Use Case Diagram beserta skenario detailnya, Activity Diagram (Swimlane), Flowchart, Sequence Diagram, Entity Relationship Diagram (ERD) beserta spesifikasi tabel dan query SQL untuk test lisan, serta arsitektur infrastruktur dan penerapan OOP."
        )
    )

    # -------------------------------------------------------------------------
    # 4.1 USE CASE DIAGRAM & SKENARIO USE CASE DETAIL
    # -------------------------------------------------------------------------
    els.append(
        p_heading(
            2,
            "4.1 Use Case Diagram & Skenario Use Case Detail",
            [(18, "_Toc969927487"), (19, "_Toc203154981")],
        )
    )
    els.append(
        p_text(
            "File Diagram: docs/diagrams/use-case.drawio (docs/diagrams/use-case/use-case.drawio) dan docs/uml/src/diagrams/list-diagrams/use-case.mmd.",
            bold_prefix="Referensi Artefak Diagram: ",
        )
    )
    els.append(
        p_text(
            "Use Case Diagram Ruang Baca menggambarkan interaksi antara 2 aktor utama (User/Anggota dan Admin/Petugas) terhadap 26 use case di dalam batas sistem (System Boundary) \"Ruang Baca\", termasuk 4 relasi <<extend>> untuk perilaku kondisional/lanjutan:"
        )
    )
    els.append(
        p_bullet(
            "Create User <<extend>> Registration: ",
            "Pembuatan profil biodata anggota (tabel users) dilakukan secara otomatis sebagai bagian terintegrasi saat Admin menjalankan use case Registration.",
        )
    )
    els.append(
        p_bullet(
            "Create Denda <<extend>> Accept Pengembalian: ",
            "Pencatatan tagihan denda baru ke tabel daftar_denda merupakan ekstensi kondisional saat Admin menerima pengembalian buku yang berstatus Telat atau kondisi bukunya Rusak/Hilang.",
        )
    )
    els.append(
        p_bullet(
            "Delete Denda <<extend>> Update Denda: ",
            "Penghapusan catatan denda dari daftar tunggakan aktif terjadi secara otomatis sebagai ekstensi dari Update Denda ketika nominal pembayaran melunasi seluruh sisa denda (sisa <= 0).",
        )
    )
    els.append(
        p_bullet(
            "Read Laporan <<extend>> Read List Laporan: ",
            "Pembacaan detail laporan beserta rincian tabel peminjaman dan pengembalian dilakukan setelah Admin memilih salah satu baris pada daftar Read List Laporan.",
        )
    )

    els.append(p_heading(3, "4.1.1 Definisi Aktor"))
    els.append(
        table_xml(
            ["No", "Aktor", "Peran dalam Sistem (Role)", "Hak Akses Use Case"],
            [
                [
                    "1",
                    "User (Anggota)",
                    "Siswa / mahasiswa anggota perpustakaan (role = 'user')",
                    "Login, Logout, Refresh Token, Read List Categories, Get Book, Peminjaman (mengajukan peminjaman), Pengembalian (mengajukan pengembalian), serta melihat riwayat peminjaman sendiri.",
                ],
                [
                    "2",
                    "Admin (Petugas)",
                    "Petugas pengelola perpustakaan (role = 'admin')",
                    "Seluruh use case User ditambah: Registration (<<extend>> Create User), Update User, Delete User, Get User, Accept Peminjaman, Accept Pengembalian (<<extend>> Create Denda), Read Denda, Update Denda (<<extend>> Delete Denda), Create Category, Update Category, Delete Category, Create Book, Update Book, Delete Book, Create Laporan, dan Read List Laporan (<<extend>> Read Laporan).",
                ],
            ],
            [600, 1600, 2300, 4500],
        )
    )

    els.append(p_heading(3, "4.1.2 Skenario Use Case Secara Detail"))
    els.append(
        p_text(
            "Berikut adalah rincian skenario use case (Kondisi Awal, Alur Utama Aktor & Sistem, Alur Alternatif/Ekstensi, dan Kondisi Akhir) untuk seluruh kelompok fitur utama Ruang Baca:"
        )
    )

    uc_scenarios = [
        (
            "UC-01: Login, Refresh Token & Logout",
            "User (Anggota) & Admin (Petugas)",
            "Pengguna telah memiliki akun terdaftar di tabel accounts dan membuka halaman Login (/login).",
            "1. Pengguna memasukkan email dan kata sandi pada form Login lalu menekan tombol 'Masuk'.\n"
            "2. Sistem memvalidasi format input dan mencari akun berdasarkan email di tabel accounts.\n"
            "3. Sistem memverifikasi kecocokan kata sandi menggunakan bcrypt.compare.\n"
            "4. Sistem menerbitkan access_token dan refresh_token ke dalam cookie HttpOnly, menyimpan sesi ke tabel refresh_token, lalu mengarahkan pengguna ke halaman Katalog Buku (/app/katalog).\n"
            "5. Saat access_token kedaluwarsa, sistem otomatis memperbarui sesi melalui endpoint Refresh Token.\n"
            "6. Saat pengguna menekan tombol 'Keluar' (Logout), sistem menghapus token dari tabel refresh_token dan menghapus cookie sesi.",
            "- A1 (Email tidak ditemukan / kata sandi salah): Sistem mengembalikan status 404/401 dan menampilkan pesan kesalahan di atas tombol Masuk.\n"
            "- A2 (Refresh token kedaluwarsa/tidak valid): Sistem menampilkan snackbar 'Sesi berakhir, silakan masuk kembali' dan mengarahkan ke halaman Login.",
            "Pengguna berhasil masuk ke sesi terautentikasi (atau sesi berhasil diakhiri saat Logout).",
        ),
        (
            "UC-02: Registration <<extend>> Create User (Pendaftaran Anggota Baru)",
            "Admin (Petugas)",
            "Admin telah masuk ke dalam sistem dan membuka halaman Anggota (/app/admin/anggota).",
            "1. Admin menekan tombol '+ Tambah Anggota' sehingga jendela compose 'Anggota Baru' terbuka.\n"
            "2. Admin mengisi bagian Akun (username, email, password minimal 8 karakter) dan bagian Biodata (nama lengkap, nomor HP, alamat) lalu menekan 'Simpan'.\n"
            "3. Sistem memeriksa keunikan username dan email serta mengenkripsi password menggunakan bcrypt.\n"
            "4. Sistem menyimpan data akun ke tabel accounts dengan role 'user'.\n"
            "5. <<extend>> Create User: Sistem secara otomatis menyimpan biodata anggota ke tabel users yang berelasi 1:1 dengan accounts.id.",
            "- A1 (Username atau email sudah terdaftar): Database menolak duplikasi (P2002), sistem mengembalikan 409 Conflict dengan pesan 'Username atau email sudah terdaftar'.\n"
            "- A2 (Data belum lengkap / password < 8 karakter): Sistem mengembalikan 400 Bad Request.",
            "Akun dan profil biodata anggota baru tersimpan di database dan muncul pada daftar Anggota.",
        ),
        (
            "UC-03: Manajemen Anggota (Get User, Update User, Delete User)",
            "Admin (Petugas)",
            "Admin berada pada halaman Anggota (/app/admin/anggota) dan data anggota telah terdaftar.",
            "1. Sistem menampilkan daftar seluruh anggota beserta nama lengkap, username, email, dan nomor HP.\n"
            "2. Admin memilih salah satu baris anggota untuk melihat panel detail profil (Get User).\n"
            "3. Untuk mengubah biodata, Admin menekan ikon Edit, memperbarui nama lengkap/nomor HP/alamat pada compose window 'Edit Anggota', lalu menekan 'Simpan' (Update User).\n"
            "4. Untuk menghapus anggota, Admin menekan ikon Hapus dan mengonfirmasi pada dialog hapus (Delete User).",
            "- A1 (Anggota tidak ditemukan): Sistem mengembalikan 404 Not Found.\n"
            "- A2 (Anggota masih memiliki catatan peminjaman/denda saat dihapus): Foreign key constraint mencegah penghapusan, sistem mengembalikan 409 Conflict 'user still has peminjaman or denda records'.",
            "Biodata anggota berhasil diperbarui atau akun anggota beserta profilnya terhapus dari sistem.",
        ),
        (
            "UC-04: Manajemen Kategori Buku (Create, Read List, Update, Delete Category)",
            "Admin (CRUD penuh) & User (Read List Categories)",
            "Pengguna membuka halaman Kategori (/app/kategori) atau Katalog Buku (/app/katalog).",
            "1. Sistem menampilkan daftar seluruh kategori beserta jenis buku dan jumlah koleksi buku di dalamnya (Read List Categories).\n"
            "2. Admin menekan '+ Tambah Kategori', mengisi nama kategori dan jenis buku, lalu menekan 'Simpan' (Create Category).\n"
            "3. Admin dapat menekan ikon Edit pada baris kategori untuk mengubah nama/jenis buku (Update Category).\n"
            "4. Admin dapat menekan ikon Hapus pada baris kategori yang kosong untuk menghapus kategori (Delete Category).",
            "- A1 (Kategori masih memiliki buku saat dihapus): Constraint onDelete: Restrict menolak penghapusan dan mengembalikan 409 Conflict 'Category still referenced by books'.",
            "Data kategori buku tersimpan, diperbarui, atau dihapus sesuai aksi Admin.",
        ),
        (
            "UC-05: Manajemen Katalog Buku (Create, Get, Update, Delete Book)",
            "Admin (CRUD penuh) & User (Get Book)",
            "Minimal satu kategori buku telah tersedia di sistem.",
            "1. Sistem menampilkan daftar koleksi buku beserta Book Tile, judul, penulis, penerbit, sinopsis singkat, dan chip stok (Get Book).\n"
            "2. Pengguna dapat memfilter buku berdasarkan tab kategori atau mencari judul/penulis pada bilah pencarian.\n"
            "3. Admin menekan '+ Buku Baru', memilih kategori, mengisi judul, penulis, penerbit, tanggal rilis, stok, dan sinopsis, lalu menekan 'Simpan' (Create Book).\n"
            "4. Admin dapat memperbarui data/stok buku (Update Book) atau menghapus buku (Delete Book) melalui tombol aksi.",
            "- A1 (Kategori tidak ditemukan saat membuat/mengubah buku): Sistem mengembalikan 404 'Category not found'.\n"
            "- A2 (Buku masih direferensikan oleh data peminjaman saat dihapus): Sistem menolak penghapusan untuk menjaga integritas riwayat sirkulasi.",
            "Koleksi buku pada katalog berhasil ditambahkan, diperbarui, atau dihapus.",
        ),
        (
            "UC-06: Pengajuan & Persetujuan Peminjaman Buku (Peminjaman & Accept Peminjaman)",
            "User (Anggota) & Admin (Petugas)",
            "Anggota telah login dan buku yang dipilih memiliki stok > 0.",
            "1. Anggota membuka detail buku pada Katalog, menekan 'Ajukan Peminjaman', memilih tanggal peminjaman, dan mengirim pengajuan (Peminjaman).\n"
            "2. Sistem menyimpan pengajuan ke tabel antrean temp_peminjaman dengan status 'Menunggu'.\n"
            "3. Admin membuka halaman Permintaan Peminjaman (/app/admin/permintaan-peminjaman), menekan tombol 'Setujui' pada pengajuan anggota.\n"
            "4. Admin memasukkan tanggal batas peminjaman pada dialog persetujuan lalu menekan 'Setujui' (Accept Peminjaman).\n"
            "5. Sistem memindahkan data dari temp_peminjaman ke tabel peminjaman resmi dan menghapus baris antrean.",
            "- A1 (Stok buku 0): Tombol 'Ajukan Peminjaman' dinonaktifkan dengan keterangan 'Stok habis'.\n"
            "- A2 (Data antrean temp_peminjaman tidak ditemukan): Sistem mengembalikan 404 'Peminjaman request not found'.",
            "Peminjaman buku resmi tercatat di tabel peminjaman dengan batas waktu pengembalian yang jelas.",
        ),
        (
            "UC-07: Pengajuan & Penerimaan Pengembalian Buku (Pengembalian & Accept Pengembalian <<extend>> Create Denda)",
            "User (Anggota) & Admin (Petugas)",
            "Anggota memiliki buku yang sedang dipinjam pada halaman Peminjaman Saya (/app/peminjaman-saya).",
            "1. Anggota menekan tombol 'Ajukan Pengembalian' pada baris buku yang dipinjam, mengisi tanggal dikembalikan, lalu mengirim pengajuan (Pengembalian).\n"
            "2. Sistem mencatat pengajuan ke tabel temp_pengembalian.\n"
            "3. Admin membuka halaman Permintaan Pengembalian (/app/admin/permintaan-pengembalian); sistem menampilkan chip 'Telat' bila tanggal_dikembalikan melewati tanggal_batas_peminjaman.\n"
            "4. Admin menekan tombol 'Terima' sehingga dialog 'Terima Pengembalian Buku' terbuka.\n"
            "5. Admin memeriksa fisik buku dan memilih radio kondisi buku: Baik, Rusak, atau Hilang.\n"
            "6. Sistem menyimpan data pengembalian ke tabel pengembalian dan menghapus antrean dari temp_pengembalian.",
            "- E1 (<<extend>> Create Denda — Status pengembalian Telat ATAU kondisi buku dipilih Rusak / Hilang): Sistem secara otomatis menampilkan dan mewajibkan pengisian field 'Nominal Denda (Rp)' dan 'Keterangan Denda' pada dialog Terima Pengembalian Buku. Saat Admin menekan 'Terima', sistem menyimpan catatan pengembalian ke tabel pengembalian sekaligus mencatat tagihan denda baru ke tabel daftar_denda.\n"
            "- E2 (Kondisi buku dipilih Baik DAN belum melewati batas waktu): Sistem menyembunyikan field input denda sehingga pengembalian langsung diterima tanpa denda.",
            "Buku resmi tercatat dikembalikan di tabel pengembalian, antrean bersih, dan tagihan denda tercatat di daftar_denda apabila terlambat/rusak/hilang.",
        ),
        (
            "UC-08: Read Denda, Total Denda & Update Denda (<<extend>> Delete Denda)",
            "Admin (Petugas)",
            "Admin membuka halaman Denda (/app/admin/denda).",
            "1. Sistem menampilkan Summary Card 'Total Denda Belum Lunas' (akumulasi seluruh tunggakan aktif) beserta daftar anggota yang memiliki denda belum lunas (Read Denda).\n"
            "2. Saat anggota membayar denda, Admin menekan tombol 'Catat Pembayaran' pada baris denda anggota tersebut.\n"
            "3. Admin memasukkan nominal 'Uang Masuk (Rp)' pada dialog pembayaran lalu menekan 'Simpan Pembayaran' (Update Denda).\n"
            "4. Sistem menghitung sisa = denda - uang_masuk.",
            "- E1 (<<extend>> Delete Denda — Pembayaran melunasi seluruh tagihan / sisa <= 0): Sistem otomatis menghapus baris tagihan dari tabel daftar_denda dan menampilkan snackbar 'Denda lunas'.\n"
            "- A1 (Pembayaran sebagian / sisa > 0): Sistem memperbarui kolom denda pada tabel daftar_denda menjadi nilai sisa terbaru.",
            "Sisa tagihan denda anggota diperbarui atau terhapus otomatis dari daftar tunggakan karena telah lunas.",
        ),
        (
            "UC-09: Create Laporan & Read List Laporan (<<extend>> Read Laporan)",
            "Admin (Petugas)",
            "Admin membuka halaman Laporan (/app/admin/laporan).",
            "1. Sistem menampilkan daftar laporan perpustakaan yang pernah dibuat beserta total peminjam dan total denda pada masing-masing laporan (Read List Laporan).\n"
            "2. Admin dapat memfilter daftar laporan menggunakan rentang tanggal awal dan akhir pembuatan laporan.\n"
            "3. Untuk membuat laporan baru, Admin menekan 'Buat Laporan', mengisi keterangan, rentang tanggal peminjaman, rentang tanggal pengembalian, dan tanggal pembuatan laporan (Create Laporan).\n"
            "4. Sistem otomatis menghitung total_peminjam dan total_denda pada periode tersebut lalu menyimpan laporan.\n"
            "5. <<extend>> Read Laporan: Saat Admin mengeklik salah satu baris laporan, sistem membuka halaman Detail Laporan (/app/admin/laporan/:id) yang menampilkan kartu ringkasan serta tabel lengkap Peminjaman dan Pengembalian.",
            "- A1 (Salah satu field filter tanggal awal/akhir dikosongkan): Sistem mengembalikan 422 Unprocessable Entity 'Tanggal awal dan akhir wajib diisi keduanya'.",
            "Laporan sirkulasi perpustakaan tersimpan dan rincian datanya dapat ditinjau oleh Admin.",
        ),
    ]

    for title, actor, pre, main_flow, alt_flow, post in uc_scenarios:
        els.append(p_heading(3, title))
        els.append(
            table_xml(
                ["Komponen Skenario", "Uraian Detail"],
                [
                    ["Aktor Terlibat", actor],
                    ["Kondisi Awal (Pre-condition)", pre],
                    ["Alur Utama (Main Flow)", main_flow],
                    ["Alur Alternatif / Ekstensi (<<extend>>)", alt_flow],
                    ["Kondisi Akhir (Post-condition)", post],
                ],
                [2300, 6700],
            )
        )

    # -------------------------------------------------------------------------
    # 4.2 ACTIVITY DIAGRAM & FLOWCHART
    # -------------------------------------------------------------------------
    els.append(
        p_heading(
            2,
            "4.2 Activity Diagram (Alur Kerja Swimlane) & Flowchart",
            [(20, "_Toc1572810154"), (21, "_Toc1408146563")],
        )
    )
    els.append(
        p_text(
            "File Diagram Activity: docs/diagrams/activity.drawio (25 tab) dan docs/diagrams/activity/activity-*.drawio.\n"
            "File Diagram Flowchart: docs/diagrams/flowchart.drawio (25 tab) dan docs/diagrams/flowchart/flowchart-*.drawio.",
            bold_prefix="Referensi Artefak Diagram: ",
        )
    )
    els.append(
        p_text(
            "Seluruh 25 alur proses pada Ruang Baca telah dimodelkan ke dalam dua bentuk diagram alur: (1) Activity Diagram dengan 3 lajur Swimlane (User, Admin, dan Sistem) untuk memperlihatkan pembagian tanggung jawab antar-aktor dan sistem, serta (2) Flowchart dengan simbol keputusan (rhombus) berlabel biner '1 (Ya)' dan '0 (Tidak)' untuk memperlihatkan logika percabangan algoritmik."
        )
    )
    els.append(
        table_xml(
            ["No", "Nama Gate / Proses", "File Activity & Flowchart (.drawio)", "Ringkasan Alur Swimlane (User / Admin / Sistem) & Logika Keputusan Flowchart"],
            [
                ["1", "Login", "activity-login.drawio / flowchart-login.drawio", "User mengecek kepemilikan akun -> input email & sandi -> Sistem memvalidasi kecocokan kredensial (1 Ya: arahkan ke dashboard; 0 Tidak: tampilkan pesan salah & ulangi)."],
                ["2", "Logout", "activity-logout.drawio / flowchart-logout.drawio", "User/Admin klik tombol Keluar -> Sistem memeriksa sesi aktif (1 Ya: hapus refresh_token & bersihkan cookie; 0 Tidak: tolak akses) -> kembali ke halaman Login."],
                ["3", "Refresh Token", "activity-refresh-token.drawio / flowchart-refresh-token.drawio", "User/Admin mengakses halaman saat access_token habis -> Sistem memeriksa validitas refresh_token di DB (1 Ya: terbitkan token baru; 0 Tidak: arahkan ke Login)."],
                ["4", "Registration (<<extend>> Create User)", "activity-register.drawio / flowchart-register.drawio", "Admin membuka form Anggota Baru & mengisi akun + biodata -> Sistem memeriksa duplikasi username/email (0 Belum terdaftar: simpan accounts & users; 1 Sudah terdaftar: tampilkan pesan duplikat)."],
                ["5", "List Users (Get User)", "activity-getuser.drawio / flowchart-getuser.drawio", "Admin memilih anggota pada daftar -> Sistem mencari data akun & biodata berdasarkan ID (1 Ditemukan: tampilkan detail anggota; 0 Tidak: tampilkan pesan tidak ditemukan)."],
                ["6", "Update User", "activity-updateuser.drawio / flowchart-updateuser.drawio", "Admin mengubah nama lengkap/no HP/alamat anggota -> Sistem memeriksa keberadaan ID anggota (1 Ditemukan: perbarui tabel users; 0 Tidak: pesan error 404)."],
                ["7", "Delete User", "activity-deleteuser.drawio / flowchart-deleteuser.drawio", "Admin mengonfirmasi hapus anggota -> Sistem memeriksa keberadaan anggota & tanggungan peminjaman/denda (Bebas tanggungan: hapus akun & profil secara cascade; Masih ada tanggungan: tolak dengan 409)."],
                ["8", "Create Category", "activity-createcategory.drawio / flowchart-createcategory.drawio", "Admin mengisi nama kategori & jenis buku -> Sistem memeriksa duplikasi kategori (0 Belum ada: simpan kategori baru; 1 Sudah ada: pesan kategori sudah terdaftar)."],
                ["9", "Read List Categories", "activity-readlistcategories.drawio / flowchart-readlistcategories.drawio", "User/Admin membuka halaman Kategori -> Sistem mengambil daftar kategori dari DB (1 Ada data: tampilkan baris kategori; 0 Kosong: tampilkan empty-state)."],
                ["10", "Update Category", "activity-updatecategory.drawio / flowchart-updatecategory.drawio", "Admin mengedit nama/jenis kategori -> Sistem memeriksa keberadaan ID kategori & menyimpan perubahan."],
                ["11", "Delete Category", "activity-deletecategory.drawio / flowchart-deletecategory.drawio", "Admin menghapus kategori -> Sistem memeriksa apakah kategori masih memiliki buku (0 Kosong: hapus kategori; 1 Masih ada buku: tolak penghapusan dengan 409)."],
                ["12", "Create Book", "activity-createbook.drawio / flowchart-createbook.drawio", "Admin mengisi form Buku Baru -> Sistem memeriksa keberadaan kategori_id (1 Valid: simpan buku baru ke tabel books; 0 Tidak valid: tampilkan pesan kategori tidak ditemukan)."],
                ["13", "Get Book (Katalog)", "activity-getbook.drawio / flowchart-getbook.drawio", "User/Admin membuka Katalog Buku -> Sistem mengambil seluruh buku beserta kategori & stok (1 Ada data: tampilkan katalog; 0 Kosong: tampilkan empty-state)."],
                ["14", "Update Book", "activity-updatebook.drawio / flowchart-updatebook.drawio", "Admin memperbarui detail/stok buku -> Sistem memeriksa keberadaan buku & kategori lalu menyimpan perubahan."],
                ["15", "Delete Book", "activity-deletebook.drawio / flowchart-deletebook.drawio", "Admin mengonfirmasi hapus buku -> Sistem memeriksa keberadaan buku & menghapusnya dari katalog."],
                ["16", "Peminjaman (Pengajuan)", "activity-peminjaman.drawio / flowchart-peminjaman.drawio", "User memilih buku & tanggal pinjam -> Sistem mencatat pengajuan ke tabel antrean temp_peminjaman untuk diverifikasi Admin."],
                ["17", "Accept Peminjaman", "activity-acceptpeminjaman.drawio / flowchart-acceptpeminjaman.drawio", "Admin memilih pengajuan di Permintaan Peminjaman & mengisi tanggal batas kembali -> Sistem memindahkan data dari temp_peminjaman ke peminjaman."],
                ["18", "Pengembalian (Pengajuan)", "activity-pengembalian.drawio / flowchart-pengembalian.drawio", "User memilih buku yang sedang dipinjam & mengajukan pengembalian -> Sistem memeriksa validitas peminjaman_id & menyimpan ke temp_pengembalian."],
                ["19", "Accept Pengembalian (<<extend>> Create Denda)", "activity-acceptpengembalian.drawio / flowchart-acceptpengembalian.drawio", "Admin membuka dialog Terima Pengembalian & memilih kondisi buku (Baik/Rusak/Hilang) -> Keputusan: Apakah status Telat atau kondisi buku Rusak/Hilang? (1 Ya: wajib isi Nominal Denda & Keterangan [<<extend>> Create Denda]; 0 Tidak: sembunyikan input denda) -> Sistem menyimpan ke pengembalian (dan daftar_denda bila ada) serta menghapus temp_pengembalian."],
                ["20", "Create Denda (<<extend>>)", "activity-createdenda.drawio / flowchart-createdenda.drawio", "Ekstensi dari Accept Pengembalian saat pengembalian terlambat atau buku rusak/hilang -> Sistem menyimpan tagihan denda baru ke tabel daftar_denda."],
                ["21", "Get Denda (Read & Total Denda)", "activity-getdenda.drawio / flowchart-getdenda.drawio", "Admin membuka halaman Denda -> Sistem mengambil seluruh daftar denda belum lunas & menghitung Total Denda Belum Lunas."],
                ["22", "Update Denda (<<extend>> Delete Denda)", "activity-updatedenda.drawio / flowchart-updatedenda.drawio", "User membayar denda ke Admin -> Admin menginput uang_masuk pada halaman Denda -> Sistem menghitung sisa denda: Apakah sisa <= 0? (1 Ya [<<extend>> Delete Denda]: hapus dari daftar_denda & tampilkan 'Denda lunas'; 0 Tidak: kurangi nominal sisa denda)."],
                ["23", "Create Laporan", "activity-createlaporan.drawio / flowchart-createlaporan.drawio", "Admin mengisi keterangan & rentang tanggal peminjaman/pengembalian -> Sistem mengakumulasi otomatis total_peminjam & total_denda lalu menyimpan ke tabel laporan."],
                ["24", "Read List Laporan", "activity-readlistlaporan.drawio / flowchart-readlistlaporan.drawio", "Admin membuka halaman Laporan & menerapkan filter rentang tanggal -> Sistem memvalidasi kelengkapan kedua tanggal filter (422 jika hanya salah satu) & menampilkan daftar laporan."],
                ["25", "Read Laporan (<<extend>>)", "activity-readlaporan.drawio / flowchart-readlaporan.drawio", "Admin mengeklik salah satu baris pada daftar laporan -> Sistem mengambil header laporan beserta tabel rincian peminjaman dan pengembalian pada periode tersebut."],
            ],
            [450, 1750, 2300, 4500],
        )
    )

    # -------------------------------------------------------------------------
    # 4.3 SEQUENCE DIAGRAM
    # -------------------------------------------------------------------------
    els.append(
        p_heading(
            2,
            "4.3 Sequence Diagram",
            [(22, "_Toc601453833"), (23, "_Toc160720263")],
        )
    )
    els.append(
        p_text(
            "File Diagram Sequence: docs/diagrams/sequence.drawio (25 tab) dan docs/diagrams/sequence/sequence-*.drawio.",
            bold_prefix="Referensi Artefak Diagram: ",
        )
    )
    els.append(
        p_text(
            "Setiap Sequence Diagram menggambarkan urutan pesan berdasarkan waktu antara komponen arsitektur berlapis NestJS: Actor Client (User/Admin) -> Guard Layer (JwtStrategy & AdminGuard) -> Controller Layer (ValidationPipe DTO) -> Service Layer (Business Logic & Logger) -> Database Layer (PrismaService Raw SQL)."
        )
    )
    els.append(
        table_xml(
            ["No", "Sequence Diagram", "Endpoint HTTP", "Partisipan (Lifelines)", "Urutan Pesan Utama & Kode Respons"],
            [
                ["1", "sequence-login", "POST /api/auth/login", "Client, AuthController, AuthService, Database", "1. Kirim {email, password} -> 2. Validasi LoginDto -> 3. SELECT accounts WHERE email = ? -> 4. bcrypt.compare -> 5. INSERT refresh_token -> 6. 200 OK + Set-Cookie access_token & refresh_token (404 jika akun tidak ada, 401 jika sandi salah)."],
                ["2", "sequence-logout", "POST /api/auth/logout", "Client, JwtStrategy, AuthController, AuthService, Database", "1. Verifikasi cookie access_token -> 2. DELETE FROM refresh_token WHERE account_id = ? -> 3. ClearCookie -> 4. 200 {message: 'logout success'}."],
                ["3", "sequence-refresh-token", "POST /api/auth/refresh_token", "Client, AuthController, AuthService, Database", "1. Baca cookie refresh_token -> 2. jwt.verifyAsync -> 3. SELECT refresh_token WHERE account_id = ? -> 4. Sign access_token & refresh_token baru -> 5. 200 OK."],
                ["4", "sequence-register", "POST /api/auth/registration", "Client (Admin), JwtStrategy+AdminGuard, AuthController, AuthService, Database", "1. Verifikasi token & role admin -> 2. Validasi RegisterDto -> 3. bcrypt.hash -> 4. INSERT INTO accounts -> 5. <<extend>> INSERT INTO users -> 6. 201 {message: 'account created'} (409 jika P2002)."],
                ["5", "sequence-getuser", "GET /api/admins/getuser", "Client (Admin), JwtStrategy+AdminGuard, AdminsController, AdminsService, Database", "1. Verifikasi Admin -> 2. SELECT users JOIN accounts WHERE u.id = ? -> 3. 200 {message: 'User found', data} (404 jika tidak ditemukan)."],
                ["6", "sequence-updateuser", "PUT /api/admins/updateuser", "Client (Admin), JwtStrategy+AdminGuard, AdminsController, AdminsService, Database", "1. Verifikasi Admin -> 2. Validasi UpdateUserDto -> 3. UPDATE users SET COALESCE(...) WHERE id = ? -> 4. 200 {message: 'User updated'} (404 jika count = 0)."],
                ["7", "sequence-deleteuser", "DELETE /api/admins/deleteuser", "Client (Admin), JwtStrategy+AdminGuard, AdminsController, AdminsService, Database", "1. Verifikasi Admin -> 2. SELECT id, account_id FROM users WHERE id = ? -> 3. DELETE FROM accounts WHERE id = ? (Cascade ke users) -> 4. 200 {message: 'User deleted'} (409 jika P2003 FK error)."],
                ["8", "sequence-createcategory", "POST /api/books/createcategory", "Client (Admin), JwtStrategy+AdminGuard, BooksController, BooksService, Database", "1. Verifikasi Admin -> 2. Validasi CreateCategoryDto -> 3. SELECT categories duplikat -> 4. INSERT INTO categories -> 5. 201 {message: 'Category created'}."],
                ["9", "sequence-readlistcategories", "GET /api/books/readlistcategories", "Client, BooksController, BooksService, Database", "1. GET request -> 2. SELECT id, nama_kategori, jenis_buku FROM categories -> 3. 200 {message: 'Categories found', data} (404 jika kosong)."],
                ["10", "sequence-updatecategory", "PUT /api/books/updatecategory", "Client (Admin), JwtStrategy+AdminGuard, BooksController, BooksService, Database", "1. Verifikasi Admin -> 2. Validasi UpdateCategoryDto -> 3. UPDATE categories WHERE id = ? -> 4. 200 {message: 'Category updated'}."],
                ["11", "sequence-deletecategory", "DELETE /api/books/deletecategory", "Client (Admin), JwtStrategy+AdminGuard, BooksController, BooksService, Database", "1. Verifikasi Admin -> 2. DELETE FROM categories WHERE id = ? -> 3. 200 {message: 'Category deleted'} (409 Conflict jika masih direferensikan oleh tabel books)."],
                ["12", "sequence-createbook", "POST /api/books/createbook", "Client (Admin), JwtStrategy+AdminGuard, BooksController, BooksService, Database", "1. Verifikasi Admin -> 2. Validasi CreateBookDto -> 3. Pastikan kategori ada -> 4. INSERT INTO books -> 5. 201 {message: 'Book created'}."],
                ["13", "sequence-getbook", "GET /api/books/getbook", "Client, BooksController, BooksService, Database", "1. GET request -> 2. SELECT books JOIN categories ORDER BY id DESC -> 3. 200 {message: 'Books found', data}."],
                ["14", "sequence-updatebook", "PUT /api/books/updatebook", "Client (Admin), JwtStrategy+AdminGuard, BooksController, BooksService, Database", "1. Verifikasi Admin -> 2. Validasi UpdateBookDto -> 3. UPDATE books WHERE id = ? -> 4. 200 {message: 'Book updated'}."],
                ["15", "sequence-deletebook", "DELETE /api/books/deletebook", "Client (Admin), JwtStrategy+AdminGuard, BooksController, BooksService, Database", "1. Verifikasi Admin -> 2. DELETE FROM books WHERE id = ? -> 3. 200 {message: 'Book deleted'}."],
                ["16", "sequence-peminjaman", "POST /api/peminjaman/peminjaman", "Client, JwtStrategy, PeminjamanController, PeminjamanService, Database", "1. Verifikasi JWT -> 2. Resolve user_id dari account_id -> 3. INSERT INTO temp_peminjaman (user_id, book_id, tanggal_peminjaman) -> 4. 201 {message: 'Peminjaman success, wait for admin admission'}."],
                ["17", "sequence-acceptpeminjaman", "POST /api/peminjaman/acceptpeminjaman", "Client (Admin), JwtStrategy+AdminGuard, PeminjamanController, PeminjamanService, Database", "1. Verifikasi Admin -> 2. SELECT temp_peminjaman WHERE id = ? -> 3. INSERT INTO peminjaman -> 4. DELETE FROM temp_peminjaman WHERE id = ? -> 5. 200 {message: 'Peminjaman admission success'}."],
                ["18", "sequence-pengembalian", "POST /api/peminjaman/pengembalian", "Client, JwtStrategy, PeminjamanController, PeminjamanService, Database", "1. Verifikasi JWT -> 2. SELECT peminjaman WHERE id = ? -> 3. INSERT INTO temp_pengembalian -> 4. 201 {message: 'Pengembalian success, wait for admin admission'}."],
                ["19", "sequence-acceptpengembalian", "POST /api/peminjaman/acceptpengembalian", "Client (Admin), JwtStrategy+AdminGuard, PeminjamanController, PeminjamanService, Database", "1. Verifikasi Admin -> 2. SELECT temp_pengembalian WHERE id = ? -> 3. INSERT INTO pengembalian (...) RETURNING id -> 4. [opt <<extend>> Create Denda jika Telat/Rusak/Hilang & denda > 0]: INSERT INTO daftar_denda (pengembalian_id, denda, keterangan) -> 5. DELETE FROM temp_pengembalian -> 6. 200 {message: 'Pengembalian admission success'}."],
                ["20", "sequence-createdenda", "POST /api/peminjaman/acceptpengembalian (<<extend>>) & POST /api/admins/createdenda", "Client (Admin), JwtStrategy+AdminGuard, Controller, Service, Database", "1. Dieksekusi sebagai <<extend>> saat penerimaan pengembalian yang Telat/Rusak/Hilang -> 2. INSERT INTO daftar_denda (pengembalian_id, denda, keterangan) -> 3. Tagihan denda aktif tercatat."],
                ["21", "sequence-getdenda", "GET /api/admins/getdenda", "Client (Admin), JwtStrategy+AdminGuard, AdminsController, AdminsService, Database", "1. Verifikasi Admin -> 2. SELECT daftar_denda JOIN pengembalian JOIN peminjaman JOIN users -> 3. 200 {message: 'Denda found', data}."],
                ["22", "sequence-updatedenda", "PUT /api/admins/updatedenda", "Client (Admin), JwtStrategy+AdminGuard, AdminsController, AdminsService, Database", "1. Verifikasi Admin -> 2. SELECT daftar_denda WHERE id = ? -> 3. Hitung sisa = denda - uang_masuk -> 4. [alt sisa <= 0 (<<extend>> Delete Denda)]: DELETE FROM daftar_denda WHERE id = ?; [else sisa > 0]: UPDATE daftar_denda SET denda = sisa -> 5. 200 {message: 'Denda updated'}."],
                ["23", "sequence-createlaporan", "POST /api/admins/createlaporan", "Client (Admin), JwtStrategy+AdminGuard, AdminsController, AdminsService, Database", "1. Verifikasi Admin -> 2. INSERT INTO laporan dengan subquery SUM(daftar_denda.denda) sebagai total_denda & COUNT(peminjaman) sebagai total_peminjam RETURNING id -> 3. 201 {message: 'Laporan created'}."],
                ["24", "sequence-readlistlaporan", "GET /api/admins/readlistlaporan", "Client (Admin), JwtStrategy+AdminGuard, AdminsController, AdminsService, Database", "1. Verifikasi Admin -> 2. Validasi pasangan tanggal filter (422 jika timpang) -> 3. SELECT laporan WHERE admin_id = ? [AND tanggal_pembuatan_laporan BETWEEN ? AND ?] -> 4. 200 {message: 'Laporan list found', data}."],
                ["25", "sequence-readlaporan", "GET /api/admins/readlaporan", "Client (Admin), JwtStrategy+AdminGuard, AdminsController, AdminsService, Database", "1. Verifikasi Admin -> 2. SELECT laporan JOIN admins JOIN accounts -> 3. SELECT peminjaman pada periode laporan -> 4. SELECT pengembalian LEFT JOIN daftar_denda pada periode laporan -> 5. 200 {message: 'Laporan found', data}."],
            ],
            [450, 1650, 1800, 1800, 3300],
        )
    )

    # -------------------------------------------------------------------------
    # 4.4 ERD, DATABASE SPECIFICATION, & SQL QUERIES FOR ORAL TEST
    # -------------------------------------------------------------------------
    els.append(
        p_heading(
            2,
            "4.4 Entity Relationship Diagram (ERD), Spesifikasi Basis Data, & Query SQL",
            [(24, "_Toc1103452102"), (25, "_Toc124193897")],
        )
    )
    els.append(
        p_text(
            "File Diagram ERD: docs/diagrams/erd.drawio (docs/diagrams/erd/erd.drawio) dan docs/uml/src/diagrams/list-diagrams/erd.mmd.",
            bold_prefix="Referensi Artefak Diagram: ",
        )
    )
    els.append(
        p_text(
            "Bagian ini menjawab seluruh instruksi pada bagian BASIS DATA di soal proyek: (1) Rancangan ERD lengkap dengan entitas, atribut, relasi, mapping cardinality, dan key; (2) Spesifikasi tabel database beserta tipe data, max length, dan aturan relasi; serta (3) Kumpulan query SQL eksplisit untuk pengujian/test lisan."
        )
    )

    els.append(p_heading(3, "4.4.1 Rancangan Relasi & Mapping Cardinality Antar-Entitas (ERD)"))
    els.append(
        table_xml(
            ["No", "Entitas Induk (Parent)", "Entitas Anak (Child)", "Mapping Cardinality", "Notasi Crow's Foot", "Foreign Key & Aturan onDelete"],
            [
                ["1", "accounts", "users", "One-to-One (1 : 0..1)", "||--o|", "users.account_id -> accounts.id (onDelete: Cascade)"],
                ["2", "accounts", "admins", "One-to-One (1 : 0..1)", "||--o|", "admins.account_id -> accounts.id (onDelete: Cascade)"],
                ["3", "accounts", "refresh_token", "One-to-Many (1 : 0..N)", "||--o{", "refresh_token.account_id -> accounts.id (onDelete: Cascade)"],
                ["4", "categories", "books", "One-to-Many (1 : 0..N)", "||--o{", "books.categories_id -> categories.id (onDelete: Restrict)"],
                ["5", "users", "temp_peminjaman", "One-to-Many (1 : 0..N)", "||--o{", "temp_peminjaman.user_id -> users.id (onDelete: Cascade)"],
                ["6", "books", "temp_peminjaman", "One-to-Many (1 : 0..N)", "||--o{", "temp_peminjaman.book_id -> books.id (onDelete: Cascade)"],
                ["7", "users", "peminjaman", "One-to-Many (1 : 0..N)", "||--o{", "peminjaman.user_id -> users.id (onDelete: Restrict)"],
                ["8", "admins", "peminjaman", "One-to-Many (1 : 0..N)", "||--o{", "peminjaman.admin_id -> admins.id (onDelete: Restrict)"],
                ["9", "books", "peminjaman", "One-to-Many (1 : 0..N)", "||--o{", "peminjaman.book_id -> books.id (onDelete: Restrict)"],
                ["10", "peminjaman", "temp_pengembalian", "One-to-Many (1 : 0..N)", "||--o{", "temp_pengembalian.peminjaman_id -> peminjaman.id (onDelete: Cascade)"],
                ["11", "peminjaman", "pengembalian", "One-to-Many (1 : 0..N)", "||--o{", "pengembalian.peminjaman_id -> peminjaman.id (onDelete: Cascade)"],
                ["12", "pengembalian", "daftar_denda", "One-to-Many (1 : 0..N)", "||--o{", "daftar_denda.pengembalian_id -> pengembalian.id (onDelete: Restrict)"],
                ["13", "admins", "laporan", "One-to-Many (1 : 0..N)", "||--o{", "laporan.admin_id -> admins.id (onDelete: Cascade)"],
            ],
            [500, 1500, 1600, 1500, 1100, 2800],
        )
    )

    els.append(p_heading(3, "4.4.2 Spesifikasi Tabel Database (Tipe Data, Max Length, Key & Relasi)"))
    els.append(
        p_text(
            "Konvensi penamaan tabel dan kolom menggunakan snake_case. Berikut adalah spesifikasi lengkap ke-12 tabel pada database Ruang Baca (kompatibel penuh dengan PostgreSQL 18 dan SQLite):"
        )
    )

    db_tables_spec = [
        ("1. Tabel accounts (Data Akun Autentikasi)", [
            ["id", "VARCHAR / UUID", "36 karakter", "PK", "UUID otomatis (@default(uuid()))"],
            ["email", "VARCHAR", "255 karakter", "UK (Unique)", "Alamat email unik untuk login"],
            ["username", "VARCHAR", "100 karakter", "-", "Username akun pengguna"],
            ["password", "VARCHAR", "255 karakter", "-", "Hash bcrypt kata sandi (min. 8 karakter)"],
            ["role", "VARCHAR", "20 karakter", "-", "Peran pengguna: 'admin' atau 'user'"],
            ["created_at", "TIMESTAMP / DATETIME", "-", "-", "Waktu pembuatan akun (@default(now()))"],
        ]),
        ("2. Tabel users (Profil Biodata Anggota)", [
            ["id", "VARCHAR / UUID", "36 karakter", "PK", "UUID otomatis (@default(uuid()))"],
            ["account_id", "VARCHAR / UUID", "36 karakter", "FK, UK", "Relasi 1:1 ke accounts.id (onDelete: Cascade)"],
            ["nama_lengkap", "VARCHAR", "150 karakter", "-", "Nama lengkap anggota perpustakaan"],
            ["no_hp", "VARCHAR", "30 karakter", "-", "Nomor telepon/WhatsApp aktif"],
            ["alamat", "TEXT / VARCHAR", "500 karakter", "-", "Alamat tempat tinggal anggota"],
            ["created_at", "TIMESTAMP / DATETIME", "-", "-", "Waktu pembuatan profil (@default(now()))"],
            ["updated_at", "TIMESTAMP / DATETIME", "-", "-", "Waktu pembaruan profil terakhir"],
        ]),
        ("3. Tabel admins (Profil Biodata Petugas/Admin)", [
            ["id", "VARCHAR / UUID", "36 karakter", "PK", "UUID otomatis (@default(uuid()))"],
            ["account_id", "VARCHAR / UUID", "36 karakter", "FK, UK", "Relasi 1:1 ke accounts.id (onDelete: Cascade)"],
            ["nama_lengkap", "VARCHAR", "150 karakter", "-", "Nama lengkap petugas/admin"],
            ["no_hp", "VARCHAR", "30 karakter", "-", "Nomor telepon petugas"],
            ["alamat", "TEXT / VARCHAR", "500 karakter", "-", "Alamat petugas"],
            ["created_at", "TIMESTAMP / DATETIME", "-", "-", "Waktu pembuatan profil admin"],
            ["updated_at", "TIMESTAMP / DATETIME", "-", "-", "Waktu pembaruan profil admin"],
        ]),
        ("4. Tabel categories (Kategori Koleksi Buku)", [
            ["id", "INTEGER / SERIAL", "32-bit Int", "PK", "ID kategori auto-increment"],
            ["nama_kategori", "VARCHAR", "100 karakter", "-", "Nama kategori buku (misal: Pemrograman, Sastra)"],
            ["jenis_buku", "VARCHAR", "100 karakter", "-", "Jenis buku (misal: Fiksi, Non-Fiksi, Referensi)"],
        ]),
        ("5. Tabel books (Katalog Koleksi Buku)", [
            ["id", "INTEGER / SERIAL", "32-bit Int", "PK", "ID buku auto-increment"],
            ["categories_id", "INTEGER", "32-bit Int", "FK", "Relasi ke categories.id (onDelete: Restrict)"],
            ["judul", "VARCHAR", "255 karakter", "-", "Judul lengkap buku"],
            ["penulis", "VARCHAR", "150 karakter", "-", "Nama penulis/pengarang buku"],
            ["penerbit", "VARCHAR", "150 karakter", "-", "Nama penerbit buku"],
            ["sinopsis", "TEXT", "Unlimited / 2000", "-", "Ringkasan isi / sinopsis buku"],
            ["tanggal_rilis", "TIMESTAMP / DATE", "-", "-", "Tanggal terbit/rilis buku"],
            ["stok", "INTEGER", "32-bit Int", "-", "Jumlah eksemplar tersedia (@default(0))"],
        ]),
        ("6. Tabel temp_peminjaman (Antrean Pengajuan Peminjaman)", [
            ["id", "INTEGER / SERIAL", "32-bit Int", "PK", "ID antrean peminjaman auto-increment"],
            ["user_id", "VARCHAR / UUID", "36 karakter", "FK", "Relasi ke users.id (onDelete: Cascade)"],
            ["book_id", "INTEGER", "32-bit Int", "FK", "Relasi ke books.id (onDelete: Cascade)"],
            ["tanggal_peminjaman", "TIMESTAMP / DATE", "-", "-", "Tanggal pengajuan peminjaman (@default(now()))"],
        ]),
        ("7. Tabel peminjaman (Data Peminjaman Buku Resmi)", [
            ["id", "INTEGER / SERIAL", "32-bit Int", "PK", "ID transaksi peminjaman auto-increment"],
            ["user_id", "VARCHAR / UUID", "36 karakter", "FK", "Relasi ke users.id (onDelete: Restrict)"],
            ["admin_id", "VARCHAR / UUID", "36 karakter", "FK", "Relasi ke admins.id yang menyetujui (onDelete: Restrict)"],
            ["book_id", "INTEGER", "32-bit Int", "FK", "Relasi ke books.id (onDelete: Restrict)"],
            ["tanggal_peminjaman", "TIMESTAMP / DATE", "-", "-", "Tanggal mulai peminjaman"],
            ["tanggal_batas_peminjaman", "TIMESTAMP / DATE", "-", "-", "Batas tanggal pengembalian buku"],
        ]),
        ("8. Tabel temp_pengembalian (Antrean Pengajuan Pengembalian)", [
            ["id", "INTEGER / SERIAL", "32-bit Int", "PK", "ID antrean pengembalian auto-increment"],
            ["peminjaman_id", "INTEGER", "32-bit Int", "FK", "Relasi ke peminjaman.id (onDelete: Cascade)"],
            ["tanggal_dikembalikan", "TIMESTAMP / DATE", "-", "-", "Tanggal pengajuan pengembalian oleh anggota"],
        ]),
        ("9. Tabel pengembalian (Data Pengembalian Buku Resmi)", [
            ["id", "INTEGER / SERIAL", "32-bit Int", "PK", "ID transaksi pengembalian auto-increment"],
            ["peminjaman_id", "INTEGER", "32-bit Int", "FK", "Relasi ke peminjaman.id (onDelete: Cascade)"],
            ["tanggal_dikembalikan", "TIMESTAMP / DATE", "-", "-", "Tanggal realisasi pengembalian buku"],
            ["status_buku", "VARCHAR", "20 karakter", "-", "Kondisi buku saat kembali: 'Baik', 'Rusak', atau 'Hilang'"],
        ]),
        ("10. Tabel daftar_denda (Data Tagihan Denda Belum Lunas)", [
            ["id", "INTEGER / SERIAL", "32-bit Int", "PK", "ID tagihan denda auto-increment"],
            ["pengembalian_id", "INTEGER", "32-bit Int", "FK", "Relasi ke pengembalian.id (onDelete: Restrict)"],
            ["denda", "DOUBLE PRECISION / FLOAT", "64-bit Float", "-", "Nominal sisa tagihan denda (Rp)"],
            ["keterangan", "VARCHAR / TEXT", "500 karakter", "-", "Alasan denda (terlambat / rusak / hilang)"],
        ]),
        ("11. Tabel laporan (Data Laporan Sirkulasi & Denda)", [
            ["id", "INTEGER / SERIAL", "32-bit Int", "PK", "ID laporan auto-increment"],
            ["admin_id", "VARCHAR / UUID", "36 karakter", "FK", "Relasi ke admins.id pembuat laporan (onDelete: Cascade)"],
            ["keterangan", "VARCHAR / TEXT", "255 karakter", "-", "Judul/keterangan periode laporan"],
            ["total_denda", "DOUBLE PRECISION / FLOAT", "64-bit Float", "-", "Total nominal denda pada rentang pengembalian"],
            ["total_peminjam", "INTEGER", "32-bit Int", "-", "Total transaksi peminjaman pada rentang peminjaman"],
            ["tanggal_awal_peminjaman", "TIMESTAMP / DATE", "-", "-", "Batas awal filter peminjaman"],
            ["tanggal_akhir_peminjaman", "TIMESTAMP / DATE", "-", "-", "Batas akhir filter peminjaman"],
            ["tanggal_awal_pengembalian", "TIMESTAMP / DATE", "-", "-", "Batas awal filter pengembalian"],
            ["tanggal_akhir_pengembalian", "TIMESTAMP / DATE", "-", "-", "Batas akhir filter pengembalian"],
            ["tanggal_pembuatan_laporan", "TIMESTAMP / DATE", "-", "-", "Tanggal laporan dibuat"],
        ]),
        ("12. Tabel refresh_token (Penyimpanan Sesi Token Aktif)", [
            ["id", "INTEGER / SERIAL", "32-bit Int", "PK", "ID sesi token auto-increment"],
            ["account_id", "VARCHAR / UUID", "36 karakter", "FK", "Relasi ke accounts.id (onDelete: Cascade)"],
            ["token", "TEXT", "512 karakter", "-", "String JWT refresh token aktif"],
            ["created_at", "TIMESTAMP / DATETIME", "-", "-", "Waktu token diterbitkan"],
            ["expired_at", "TIMESTAMP / DATETIME", "-", "-", "Waktu kedaluwarsa token"],
        ]),
    ]

    for tbl_title, tbl_rows in db_tables_spec:
        els.append(p_text(tbl_title, bold_prefix=""))
        els.append(
            table_xml(
                ["Nama Kolom", "Tipe Data", "Max Length / Ukuran", "Key", "Keterangan & Relasi"],
                tbl_rows,
                [1800, 1800, 1400, 900, 3100],
            )
        )

    els.append(p_heading(3, "4.4.3 Kumpulan Query SQL Eksplisit (Persiapan Test Lisan)"))
    els.append(
        p_text(
            "Sesuai instruksi Basis Data poin ke-3 ('Buatkan query (test lisan)'), seluruh operasi database pada Ruang Baca ditulis menggunakan Raw SQL eksplisit di dalam direktori src/*/sql/*.queries.sql. Berikut adalah daftar lengkap query SQL yang digunakan oleh sistem:"
        )
    )

    for rel_path, qname, qsql in collect_sql_queries():
        els.append(
            p_text(
                f" ({rel_path})",
                bold_prefix=f"Query: {qname}",
            )
        )
        els.append(p_code(qsql))

    # -------------------------------------------------------------------------
    # 4.5 ARSITEKTUR INFRASTRUKTUR, TECH STACK, OOP, DEBUGGING & DOKUMENTASI
    # -------------------------------------------------------------------------
    els.append(
        p_heading(
            2,
            "4.5 Arsitektur Infrastruktur, Tech Stack & Pemrograman Berorientasi Objek (OOP)",
            [(26, "_Toc409075677"), (27, "_Toc1433496813")],
        )
    )
    els.append(
        p_text(
            "Bagian ini mendokumentasikan arsitektur infrastruktur, pemilihan teknologi (tech stack), serta pemenuhan seluruh instruksi pada bagian PEMROGRAMAN PERANGKAT BERGERAK / WEB (Penerapan OOP, Debugging & Uji Coba Real-Time, serta Dokumentasi Program)."
        )
    )

    els.append(p_heading(3, "4.5.1 Arsitektur Infrastruktur & Tech Stack"))
    els.append(
        table_xml(
            ["Lapisan (Layer)", "Teknologi / Pustaka", "Versi", "Fungsi dalam Arsitektur Ruang Baca"],
            [
                ["Runtime & Bahasa", "Node.js + TypeScript", "v22 / TS 5.7", "Eksekusi server-side dengan static typing dan dukungan penuh dekorator OOP."],
                ["Backend Framework", "NestJS (@nestjs/common, core, platform-express)", "v11.0", "Arsitektur modular berbasis Controller, Service, Guard, dan Dependency Injection."],
                ["Autentikasi & Keamanan", "Passport JWT (@nestjs/jwt, passport-jwt) & Bcrypt", "v11 / v6.0", "Manajemen sesi JWT pada cookie HttpOnly serta hashing kata sandi."],
                ["Validasi Data", "class-validator & class-transformer", "v0.15", "Validasi otomatis payload request melalui objek Data Transfer Object (DTO)."],
                ["Database Layer & Adapter", "@ruangbaca/database (Prisma Client + Dual Adapter)", "v7.10", "Mendukung SQLite (better-sqlite3) untuk development dan PostgreSQL 18 (pg) untuk production secara otomatis."],
                ["Frontend / View Engine", "EJS (Embedded JavaScript) + Tailwind CSS CLI", "v7.0 / v4.3", "Server-Side Rendering (SSR) antarmuka Gmail-Style yang cepat dan ringan."],
                ["Testing & QA", "Jest & Supertest + ESLint", "v30 / v7.0", "Pengujian otomatis 100 unit test dan 2 end-to-end (e2e) test."],
                ["Kontainerisasi Produksi", "Docker & Docker Compose + PostgreSQL 18 Alpine", "Postgres 18", " Orkestrasi container aplikasi produksi dan database PostgreSQL 18."],
            ],
            [1800, 2500, 1100, 3600],
        )
    )

    els.append(p_heading(3, "4.5.2 Penerapan Pemrograman Berbasis Objek (Object-Oriented Programming / OOP)"))
    els.append(
        p_text(
            "Seluruh kode sumber aplikasi Ruang Baca dirancang menggunakan paradigma Object-Oriented Programming (OOP) pada TypeScript. Tabel berikut memetakan setiap pilar OOP ke implementasi nyata di dalam kode program:"
        )
    )
    els.append(
        table_xml(
            ["Prinsip OOP", "Implementasi pada Kode Sumber Ruang Baca", "Lokasi File"],
            [
                [
                    "1. Class & Object (Kelas & Instansiasi Objek)",
                    "Setiap entitas layanan, pengendali HTTP, DTO, dan koneksi database direpresentasikan sebagai class (contoh: AuthController, AuthService, AdminsService, BooksService, PeminjamanService, ViewsService, PrismaService).",
                    "src/*/*.controller.ts, src/*/*.service.ts",
                ],
                [
                    "2. Encapsulation (Enkapsulasi & Hak Akses Anggota Kelas)",
                    "State internal dan metode pembantu disembunyikan menggunakan modifier private readonly (misal: private readonly prisma: PrismaService, private readonly logger = new Logger(...), private resolveUserId(), private unexpected()).",
                    "src/peminjaman/peminjaman.service.ts, src/admins/admins.service.ts",
                ],
                [
                    "3. Inheritance & Interface Implementation (Pewarisan & Kontrak Antarmuka)",
                    "JwtStrategy mewarisi PassportStrategy(Strategy), PrismaService mewarisi PrismaClient dan mengimplementasikan OnModuleInit & OnModuleDestroy, AdminGuard mengimplementasikan CanActivate, serta PostgresDriverAdapter mengimplementasikan SqlDriverAdapter.",
                    "src/auth/strategies/jwt.strategy.ts, src/auth/guards/admin.guard.ts, database/src/postgres-adapter.ts",
                ],
                [
                    "4. Polymorphism & Adapter Pattern (Polimorfisme)",
                    "PrismaService dapat bekerja secara polimorfik di atas dua engine database berbeda (SQLite via PrismaBetterSqlite3 maupun PostgreSQL 18 via PrismaPostgresAdapterFactory) tanpa mengubah satu baris pun kode pada Service pemanggil. Adapter PostgreSQL otomatis menerjemahkan placeholder '?' menjadi '$1, $2, ...'.",
                    "database/src/database-config.ts, database/src/postgres-adapter.ts, database/src/prisma.service.ts",
                ],
                [
                    "5. Dependency Injection (Injeksi Ketergantungan / IoC)",
                    "Dekorator @Injectable() dan @Module() menyerahkan siklus hidup instansiasi objek kepada IoC Container NestJS, memudahkan penggantian objek nyata dengan mock object saat pengujian unit.",
                    "src/app.module.ts, src/*/*.module.ts",
                ],
            ],
            [1900, 4700, 2400],
        )
    )

    els.append(p_heading(3, "4.5.3 Debugging, Pendeteksian Kesalahan & Uji Coba Real-Time"))
    els.append(
        p_text(
            "Untuk memastikan seluruh fitur berjalan dengan benar tanpa bug, dilakukan mekanisme pendeteksian kesalahan berlapis serta pengujian otomatis dan real-time:"
        )
    )
    els.append(
        p_bullet(
            "1. Validasi Input Otomatis (DTO & ValidationPipe): ",
            "Setiap request body dan query parameter diperiksa terhadap dekorator class-validator (@IsEmail, @IsNotEmpty, @MinLength(8), @IsInt, @Min(1), @IsDateString). Input yang tidak valid langsung ditolak dengan kode 400 Bad Request atau 422 Unprocessable Entity sebelum menyentuh database.",
        )
    )
    els.append(
        p_bullet(
            "2. Pemetaan Error Database (Database Error Translation): ",
            "Kesalahan constraint dari SQLite maupun PostgreSQL (kode 23505 -> P2002 untuk duplikasi data unik; kode 23503 -> P2003 untuk pelanggaran Foreign Key) ditangkap dan diterjemahkan menjadi ConflictException (409) yang komunikatif bagi pengguna.",
        )
    )
    els.append(
        p_bullet(
            "3. Pencatatan Log Terstruktur (Structured Logging): ",
            "Setiap Service menggunakan NestJS Logger (logger.log, logger.warn, logger.error) untuk mencatat jejak audit setiap operasi beserta stack trace apabila terjadi kesalahan.",
        )
    )
    els.append(
        p_bullet(
            "4. Pengujian Unit & End-to-End (100 Unit Tests & 2 E2E Tests): ",
            "Seluruh 7 suite unit test (auth.controller.spec.ts, admin.guard.spec.ts, admins.controller.spec.ts, books.controller.spec.ts, peminjaman.controller.spec.ts, views.controller.spec.ts, dan database-config.spec.ts) sebanyak 100 test case serta 2 e2e test (app.e2e-spec.ts) lulus 100%.",
        )
    )

    els.append(p_heading(3, "4.5.4 Dokumentasi Program & Perintah Operasional (CLI Runners)"))
    els.append(
        table_xml(
            ["Perintah CLI", "File Skrip", "Keterangan & Fungsi Dokumentasi Program"],
            [
                ["pnpm env:generate", "scripts/generate-env.mjs", "Men-generate file .env dari .env.example dengan meminta input username dan menghasilkan nilai acak crypto.randomBytes(32) yang di-hash SHA-256 (64 karakter hex) untuk seluruh secret key dan password."],
                ["pnpm admin:create", "scripts/create-admin.mjs", "Membuat akun Admin baru secara langsung ke database aktif (SQLite atau PostgreSQL) dengan validasi panjang password minimal 8 karakter."],
                ["pnpm db:reset", "scripts/reset-db.mjs", "Mengosongkan seluruh tabel database dan me-reset sequence auto-increment ke awal pada SQLite maupun PostgreSQL."],
                ["pnpm uml:drawio", "scripts/generate-drawio.mjs", "Mengonversi seluruh 77 file diagram Mermaid (.mmd) menjadi file native Draw.io (.drawio) di docs/diagrams/ yang dikelompokkan per jenis diagram."],
                ["docker compose up -d --build", "Dockerfile & docker-compose.yml", "Menjalankan aplikasi NestJS production bersama database PostgreSQL 18 Alpine dengan inisialisasi skema otomatis."],
            ],
            [2100, 2200, 4700],
        )
    )

    # =========================================================================
    # 5. FASE DESIGN SYSTEM & UI/UX
    # =========================================================================
    els.append(
        p_heading(
            1,
            "5. Fase Design System & UI/UX",
            [(28, "_Toc858002323"), (29, "_Toc158030053")],
        )
    )
    els.append(
        p_text(
            "Panduan desain sistem dan komponen visual Ruang Baca dirancang khusus untuk pengguna siswa dan mahasiswa Generasi Z dengan mengadopsi gaya tampilan Gmail (Gmail-Style UI) yang mengutamakan keterbacaan, kepadatan informasi yang rapi, dan responsivitas komunikasi visual."
        )
    )

    els.append(
        p_heading(
            2,
            "5.1 Tipografi & Warna (Aturan 60-30-10)",
            [(30, "_Toc896418598"), (31, "_Toc1821827088")],
        )
    )
    els.append(
        p_text(
            "Komposisi warna aplikasi menerapkan aturan 60-30-10 untuk menjaga kenyamanan mata saat membaca katalog maupun mengelola sirkulasi buku:"
        )
    )
    els.append(
        table_xml(
            ["Proporsi / Kategori", "Kode Warna (Hex)", "Penggunaan pada Antarmuka Ruang Baca"],
            [
                ["60% Dominant Surface", "#F6F8FC & #FFFFFF", "Background utama aplikasi (#F6F8FC) serta permukaan kartu konten, daftar baris (list-row), dan dialog (#FFFFFF)."],
                ["30% Secondary Container", "#E9EEF6 & #D3E3FD", "Background search bar, header tabel, dan efek hover sidebar (#E9EEF6), serta indikator menu sidebar aktif dan baris terpilih (#D3E3FD)."],
                ["10% Accent Color", "#0B57D0 & #C2E7FF", "Tombol aksi utama (button-primary), tautan aktif, cincin fokus, badge penghitung (#0B57D0), serta tombol Compose utama di sidebar (#C2E7FF)."],
                ["Text & Border", "#1F1F1F, #5E5E5E, #E0E3E7", "Teks utama (#1F1F1F), teks sekunder/meta/tanggal (#5E5E5E), dan garis pembatas antar-baris (#E0E3E7)."],
                ["Status Chip — Sukses/Baik", "Bg #E6F4EA / Text #137333", "Digunakan pada chip status 'Baik', 'Dikembalikan', dan stok 'Tersedia'."],
                ["Status Chip — Menunggu", "Bg #FEF7E0 / Text #B06000", "Digunakan pada chip status 'Menunggu' (antrean peminjaman/pengembalian)."],
                ["Status Chip — Error/Denda", "Bg #FCE8E6 / Text #C5221F", "Digunakan pada chip status 'Telat', 'Rusak', kartu Total Denda, dan blok wajib input denda."],
                ["Status Chip — Hilang", "Bg #F1F3F4 / Text #3C4043", "Digunakan pada chip status buku 'Hilang'."],
                ["Palet Avatar & Book Tile", "#1A73E8, #188038, #E37400, #D93025, #9334E6, #007B83, #C5221F, #5F6368", "Dipilih secara deterministik dari nilai hash nama pengguna (Avatar Inisial) atau nama kategori buku (Book Tile) dengan teks huruf putih (#FFFFFF)."],
            ],
            [2200, 2200, 4600],
        )
    )
    els.append(
        p_bullet(
            "Tipografi (Font Family & Ukuran): ",
            "Menggunakan font Roboto / Google Sans (fallback system-ui, sans-serif) dan Roboto Mono untuk angka/kode. Ukuran judul halaman 22px, judul baris 14px bold, dan teks meta/tanggal 12px.",
        )
    )
    els.append(
        p_bullet(
            "Bentuk & Spasi (Shape & Spacing): ",
            "Radius tombol utama dan search bar berbentuk pill (24px), kartu utama dan dialog 16px, chip status 8px, tinggi standar baris daftar (list-row) 48px dengan spasi dasar 8px.",
        )
    )

    els.append(
        p_heading(
            2,
            "5.2 Pustaka Komponen (Component Library) & Halaman UI",
            [(32, "_Toc248185693"), (33, "_Toc1017209084")],
        )
    )
    els.append(
        p_text(
            "Karena sistem tidak menyimpan file gambar profil maupun sampul buku, identitas visual digantikan oleh komponen Avatar Inisial dan Book Tile yang di-render secara dinamis. Seluruh komponen telah diimplementasikan pada views/partials/*.ejs serta didokumentasikan 1-to-1 di kanvas Framer (https://framer.com/projects/SB3xpkK3lxFmxG3OZDKv):"
        )
    )
    els.append(
        table_xml(
            ["Komponen UI", "Status", "Spesifikasi Visual & Perilaku Komunikatif"],
            [
                ["avatar-inisial", "Selesai (Aktif)", "Lingkaran 32px (atau 56px pada popover akun) berisi 1–2 huruf awal nama lengkap dengan warna latar dari Palet Avatar."],
                ["book-tile", "Selesai (Aktif)", "Kotak 40x40px (atau 72x72px pada panel detail) dengan radius 8px berisi huruf awal judul buku dan warna berdasarkan kategori."],
                ["button-primary & secondary", "Selesai (Aktif)", "Tombol utama berbentuk pill (#0B57D0 teks putih) dan tombol sekunder berlatar transparan/hover #E9EEF6."],
                ["chip-status", "Selesai (Aktif)", "Label status kompak (Menunggu, Dipinjam, Dikembalikan, Baik, Rusak, Hilang, Telat, Admin, Anggota) dengan warna semantik."],
                ["list-row", "Selesai (Aktif)", "Baris daftar padat setinggi 48px bergaya inbox Gmail berisi avatar/book-tile, judul bold, snippet abu-abu, meta tanggal/chip di kanan, serta tombol aksi."],
                ["compose-window", "Selesai (Aktif)", "Jendela form melayang di kanan bawah selebar 480px dengan header #F2F6FC, tombol minimize & close, body input, dan tombol Simpan."],
                ["dialog-terima (Kondisional Denda)", "Selesai (Aktif)", "Modal penerimaan pengembalian buku dengan pilihan radio Baik/Rusak/Hilang dan blok Input Denda Kondisional (<<extend>> Create Denda) yang otomatis muncul & wajib diisi saat buku Telat/Rusak/Hilang, serta tersembunyi saat Baik & tepat waktu."],
                ["dialog-pembayaran & confirm-dialog", "Selesai (Aktif)", "Modal tengah untuk pencatatan pembayaran denda (otomatis menghapus denda bila lunas) dan konfirmasi penghapusan data."],
                ["snackbar & empty-state", "Selesai (Aktif)", "Toast notifikasi di kiri bawah (#323232 teks putih, misal: 'Denda lunas', 'Buku berhasil ditambahkan') serta tampilan ilustrasi saat daftar kosong."],
            ],
            [2100, 1400, 5500],
        )
    )

    els.append(p_heading(3, "5.2.1 Daftar Halaman Antarmuka (SSR EJS & Kanvas Framer)"))
    els.append(
        table_xml(
            ["No", "Halaman UI", "Rute URL SSR", "File Template EJS", "Node ID Framer (SB3xpkK3lxFmxG3OZDKv)"],
            [
                ["1", "Login Page", "GET /login", "views/login.ejs", "KpdfF8GEY (/login)"],
                ["2", "Katalog Buku & Detail Panel", "GET /app/katalog", "views/katalog.ejs", "augiA20Il (/)"],
                ["3", "Kategori Buku", "GET /app/kategori", "views/kategori.ejs", "yVMQ6KPye (/kategori)"],
                ["4", "Peminjaman Saya (User)", "GET /app/peminjaman-saya", "views/peminjaman-saya.ejs", "ZUQYTPpj5 (/peminjaman-saya)"],
                ["5", "Permintaan Peminjaman (Admin)", "GET /app/admin/permintaan-peminjaman", "views/permintaan-peminjaman.ejs", "cuvoKWOsZ (/permintaan-peminjaman)"],
                ["6", "Permintaan Pengembalian (Admin)", "GET /app/admin/permintaan-pengembalian", "views/permintaan-pengembalian.ejs", "tIV1LvTrS (/permintaan-pengembalian)"],
                ["7", "Manajemen Anggota (Admin)", "GET /app/admin/anggota", "views/anggota.ejs", "wkYMk7YcH (/anggota)"],
                ["8", "Daftar & Pembayaran Denda (Admin)", "GET /app/admin/denda", "views/denda.ejs", "HfTH3zufJ (/denda)"],
                ["9", "Daftar Laporan (Admin)", "GET /app/admin/laporan", "views/laporan.ejs", "i7dGfMq1O (/laporan)"],
                ["10", "Detail Laporan (Admin)", "GET /app/admin/laporan/:id", "views/laporan-detail.ejs", "HrHojvUvg (/laporan-detail)"],
            ],
            [500, 2300, 2200, 2000, 2000],
        )
    )

    return els


def update_docx() -> None:
    with zipfile.ZipFile(DOCX_PATH, "r") as zin:
        entries = {name: zin.read(name) for name in zin.namelist()}

    doc_xml = entries["word/document.xml"].decode("utf-8")

    # Locate the first Heading 1 ("1. Pendahuluan (Introduction)") after the TOC
    marker = '<w:bookmarkStart w:id="2" w:name="_Toc1254584190"/>'
    idx_marker = doc_xml.find(marker)
    if idx_marker == -1:
        raise RuntimeError("Could not find _Toc1254584190 marker in word/document.xml")

    # Find the <w:p> that starts the "1. Pendahuluan" paragraph
    idx_p_start = doc_xml.rfind("<w:p>", 0, idx_marker)
    idx_sect = doc_xml.rfind("<w:sectPr")
    if idx_p_start == -1 or idx_sect == -1:
        raise RuntimeError("Could not locate paragraph start or <w:sectPr> in word/document.xml")

    prefix_xml = doc_xml[:idx_p_start]
    suffix_xml = doc_xml[idx_sect:]

    # Also update the date & version on the cover page if present
    prefix_xml = prefix_xml.replace("Versi: 1.1", "Versi: 2.0 (Final)")
    prefix_xml = prefix_xml.replace("3 November 2026", "15 November 2026")

    new_body_xml = "".join(build_body_content())
    updated_doc_xml = prefix_xml + new_body_xml + suffix_xml

    # Validate well-formed XML before writing
    ET.fromstring(updated_doc_xml.encode("utf-8"))

    entries["word/document.xml"] = updated_doc_xml.encode("utf-8")

    with zipfile.ZipFile(DOCX_PATH, "w", compression=zipfile.ZIP_DEFLATED) as zout:
        for name, data in entries.items():
            zout.writestr(name, data)

    print(f"Successfully updated {DOCX_PATH}")


if __name__ == "__main__":
    update_docx()

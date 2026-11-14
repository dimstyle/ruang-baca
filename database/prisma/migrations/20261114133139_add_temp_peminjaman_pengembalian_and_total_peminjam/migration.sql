-- CreateTable
CREATE TABLE "temp_peminjaman" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" TEXT NOT NULL,
    "book_id" INTEGER NOT NULL,
    "tanggal_peminjaman" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "temp_peminjaman_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "temp_peminjaman_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "temp_pengembalian" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "peminjaman_id" INTEGER NOT NULL,
    "tanggal_dikembalikan" DATETIME NOT NULL,
    CONSTRAINT "temp_pengembalian_peminjaman_id_fkey" FOREIGN KEY ("peminjaman_id") REFERENCES "peminjaman" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_laporan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "admin_id" TEXT NOT NULL,
    "keterangan" TEXT NOT NULL,
    "total_denda" REAL NOT NULL,
    "total_peminjam" INTEGER NOT NULL DEFAULT 0,
    "tanggal_awal_peminjaman" DATETIME NOT NULL,
    "tanggal_akhir_peminjaman" DATETIME NOT NULL,
    "tanggal_awal_pengembalian" DATETIME NOT NULL,
    "tanggal_akhir_pengembalian" DATETIME NOT NULL,
    "tanggal_pembuatan_laporan" DATETIME NOT NULL,
    CONSTRAINT "laporan_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_laporan" ("admin_id", "id", "keterangan", "tanggal_akhir_peminjaman", "tanggal_akhir_pengembalian", "tanggal_awal_peminjaman", "tanggal_awal_pengembalian", "tanggal_pembuatan_laporan", "total_denda") SELECT "admin_id", "id", "keterangan", "tanggal_akhir_peminjaman", "tanggal_akhir_pengembalian", "tanggal_awal_peminjaman", "tanggal_awal_pengembalian", "tanggal_pembuatan_laporan", "total_denda" FROM "laporan";
DROP TABLE "laporan";
ALTER TABLE "new_laporan" RENAME TO "laporan";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

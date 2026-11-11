/*
  Warnings:

  - You are about to drop the `detail_peminjaman` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `laporan_id` on the `daftar_denda` table. All the data in the column will be lost.
  - You are about to alter the column `denda` on the `daftar_denda` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.
  - You are about to drop the column `denda` on the `pengembalian` table. All the data in the column will be lost.
  - Added the required column `pengembalian_id` to the `daftar_denda` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tanggal_akhir_peminjaman` to the `laporan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tanggal_akhir_pengembalian` to the `laporan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tanggal_awal_peminjaman` to the `laporan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tanggal_awal_pengembalian` to the `laporan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `book_id` to the `peminjaman` table without a default value. This is not possible if the table is not empty.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "detail_peminjaman";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_daftar_denda" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" TEXT NOT NULL,
    "pengembalian_id" INTEGER NOT NULL,
    "denda" REAL NOT NULL,
    "keterangan" TEXT NOT NULL,
    CONSTRAINT "daftar_denda_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "daftar_denda_pengembalian_id_fkey" FOREIGN KEY ("pengembalian_id") REFERENCES "pengembalian" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_daftar_denda" ("denda", "id", "keterangan", "user_id") SELECT "denda", "id", "keterangan", "user_id" FROM "daftar_denda";
DROP TABLE "daftar_denda";
ALTER TABLE "new_daftar_denda" RENAME TO "daftar_denda";
CREATE TABLE "new_laporan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "admin_id" TEXT NOT NULL,
    "keterangan" TEXT NOT NULL,
    "total_denda" INTEGER NOT NULL,
    "tanggal_awal_peminjaman" DATETIME NOT NULL,
    "tanggal_akhir_peminjaman" DATETIME NOT NULL,
    "tanggal_awal_pengembalian" DATETIME NOT NULL,
    "tanggal_akhir_pengembalian" DATETIME NOT NULL,
    "tanggal_pembuatan_laporan" DATETIME NOT NULL,
    CONSTRAINT "laporan_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_laporan" ("admin_id", "id", "keterangan", "tanggal_pembuatan_laporan", "total_denda") SELECT "admin_id", "id", "keterangan", "tanggal_pembuatan_laporan", "total_denda" FROM "laporan";
DROP TABLE "laporan";
ALTER TABLE "new_laporan" RENAME TO "laporan";
CREATE TABLE "new_peminjaman" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "book_id" INTEGER NOT NULL,
    "tanggal_peminjaman" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tanggal_batas_peminjaman" DATETIME NOT NULL,
    CONSTRAINT "peminjaman_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "peminjaman_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "peminjaman_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_peminjaman" ("admin_id", "id", "tanggal_batas_peminjaman", "tanggal_peminjaman", "user_id") SELECT "admin_id", "id", "tanggal_batas_peminjaman", "tanggal_peminjaman", "user_id" FROM "peminjaman";
DROP TABLE "peminjaman";
ALTER TABLE "new_peminjaman" RENAME TO "peminjaman";
CREATE TABLE "new_pengembalian" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "peminjaman_id" INTEGER NOT NULL,
    "tanggal_dikembalikan" DATETIME NOT NULL,
    "status_buku" TEXT NOT NULL,
    CONSTRAINT "pengembalian_peminjaman_id_fkey" FOREIGN KEY ("peminjaman_id") REFERENCES "peminjaman" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_pengembalian" ("id", "peminjaman_id", "status_buku", "tanggal_dikembalikan") SELECT "id", "peminjaman_id", "status_buku", "tanggal_dikembalikan" FROM "pengembalian";
DROP TABLE "pengembalian";
ALTER TABLE "new_pengembalian" RENAME TO "pengembalian";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

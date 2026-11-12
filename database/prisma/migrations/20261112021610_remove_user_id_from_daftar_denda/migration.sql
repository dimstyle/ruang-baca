/*
  Warnings:

  - You are about to drop the column `user_id` on the `daftar_denda` table. All the data in the column will be lost.
  - You are about to alter the column `total_denda` on the `laporan` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_daftar_denda" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pengembalian_id" INTEGER NOT NULL,
    "denda" REAL NOT NULL,
    "keterangan" TEXT NOT NULL,
    CONSTRAINT "daftar_denda_pengembalian_id_fkey" FOREIGN KEY ("pengembalian_id") REFERENCES "pengembalian" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_daftar_denda" ("denda", "id", "keterangan", "pengembalian_id") SELECT "denda", "id", "keterangan", "pengembalian_id" FROM "daftar_denda";
DROP TABLE "daftar_denda";
ALTER TABLE "new_daftar_denda" RENAME TO "daftar_denda";
CREATE TABLE "new_laporan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "admin_id" TEXT NOT NULL,
    "keterangan" TEXT NOT NULL,
    "total_denda" REAL NOT NULL,
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

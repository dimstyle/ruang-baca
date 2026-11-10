-- CreateTable
CREATE TABLE "laporan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "admin_id" TEXT NOT NULL,
    "keterangan" TEXT NOT NULL,
    "total_denda" INTEGER NOT NULL,
    "tanggal_pembuatan_laporan" DATETIME NOT NULL,
    CONSTRAINT "laporan_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "daftar_denda" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" TEXT NOT NULL,
    "laporan_id" INTEGER NOT NULL,
    "denda" INTEGER NOT NULL,
    "keterangan" TEXT NOT NULL,
    CONSTRAINT "daftar_denda_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "daftar_denda_laporan_id_fkey" FOREIGN KEY ("laporan_id") REFERENCES "laporan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

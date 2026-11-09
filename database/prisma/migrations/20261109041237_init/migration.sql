-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "account_id" TEXT NOT NULL,
    "nama_lengkap" TEXT NOT NULL,
    "no_hp" TEXT NOT NULL,
    "alamat" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "account_id" TEXT NOT NULL,
    "nama_lengkap" TEXT NOT NULL,
    "no_hp" TEXT NOT NULL,
    "alamat" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admins_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "categories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nama_kategori" TEXT NOT NULL,
    "jenis_buku" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "books" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categories_id" INTEGER NOT NULL,
    "judul" TEXT NOT NULL,
    "penulis" TEXT NOT NULL,
    "penerbit" TEXT NOT NULL,
    "tanggal_rilis" DATETIME NOT NULL,
    "stok" INTEGER NOT NULL,
    CONSTRAINT "books_categories_id_fkey" FOREIGN KEY ("categories_id") REFERENCES "categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "peminjaman" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "tanggal_peminjaman" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tanggal_batas_peminjaman" DATETIME NOT NULL,
    CONSTRAINT "peminjaman_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "peminjaman_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pengembalian" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "peminjaman_id" INTEGER NOT NULL,
    "tanggal_dikembalikan" DATETIME NOT NULL,
    "denda" REAL NOT NULL,
    "status_buku" TEXT NOT NULL,
    CONSTRAINT "pengembalian_peminjaman_id_fkey" FOREIGN KEY ("peminjaman_id") REFERENCES "peminjaman" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "detail_peminjaman" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "peminjaman_id" INTEGER NOT NULL,
    "books_id" INTEGER NOT NULL,
    CONSTRAINT "detail_peminjaman_peminjaman_id_fkey" FOREIGN KEY ("peminjaman_id") REFERENCES "peminjaman" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "detail_peminjaman_books_id_fkey" FOREIGN KEY ("books_id") REFERENCES "books" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "refresh_token" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "account_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expired_at" DATETIME NOT NULL,
    CONSTRAINT "refresh_token_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_username_key" ON "accounts"("username");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_account_id_key" ON "users"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "admins_account_id_key" ON "admins"("account_id");

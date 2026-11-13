/*
  Warnings:

  - Added the required column `sinopsis` to the `books` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_books" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categories_id" INTEGER NOT NULL,
    "judul" TEXT NOT NULL,
    "penulis" TEXT NOT NULL,
    "penerbit" TEXT NOT NULL,
    "sinopsis" TEXT NOT NULL,
    "tanggal_rilis" DATETIME NOT NULL,
    "stok" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "books_categories_id_fkey" FOREIGN KEY ("categories_id") REFERENCES "categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_books" ("categories_id", "id", "judul", "penerbit", "penulis", "stok", "tanggal_rilis") SELECT "categories_id", "id", "judul", "penerbit", "penulis", "stok", "tanggal_rilis" FROM "books";
DROP TABLE "books";
ALTER TABLE "new_books" RENAME TO "books";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

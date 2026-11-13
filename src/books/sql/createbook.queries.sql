-- name: findCategoryById
SELECT id
FROM categories
WHERE id = ?
LIMIT 1;

-- name: insertBook
INSERT INTO books (categories_id, judul, penulis, penerbit, sinopsis, tanggal_rilis, stok)
VALUES (?, ?, ?, ?, ?, ?, ?);

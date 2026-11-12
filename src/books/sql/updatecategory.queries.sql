-- name: updateCategoryById
UPDATE categories
SET nama_kategori = COALESCE(?, nama_kategori),
    jenis_buku    = COALESCE(?, jenis_buku)
WHERE id = ?;

-- name: updateBookById
UPDATE books
SET categories_id = COALESCE(?, categories_id),
    judul         = COALESCE(?, judul),
    penulis       = COALESCE(?, penulis),
    penerbit      = COALESCE(?, penerbit),
    sinopsis      = COALESCE(?, sinopsis),
    tanggal_rilis = COALESCE(?, tanggal_rilis),
    stok          = COALESCE(?, stok)
WHERE id = ?;

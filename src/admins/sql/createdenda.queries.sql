-- name: findPengembalianById
SELECT id
FROM pengembalian
WHERE id = ?
LIMIT 1;

-- name: insertDenda
INSERT INTO daftar_denda (pengembalian_id, denda, keterangan)
VALUES (?, ?, ?)
RETURNING id;

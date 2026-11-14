-- name: findTempPengembalianById
SELECT id, peminjaman_id, tanggal_dikembalikan
FROM temp_pengembalian
WHERE id = ?
LIMIT 1;

-- name: insertPengembalian
INSERT INTO pengembalian (peminjaman_id, tanggal_dikembalikan, status_buku)
VALUES (?, ?, ?);

-- name: deleteTempPengembalianById
DELETE FROM temp_pengembalian
WHERE id = ?;

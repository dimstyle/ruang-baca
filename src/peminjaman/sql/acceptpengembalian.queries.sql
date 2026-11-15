-- name: findTempPengembalianById
SELECT id, peminjaman_id, tanggal_dikembalikan
FROM temp_pengembalian
WHERE id = ?
LIMIT 1;

-- name: insertPengembalian
INSERT INTO pengembalian (peminjaman_id, tanggal_dikembalikan, status_buku)
VALUES (?, ?, ?)
RETURNING id;

-- name: insertDendaOnAccept
INSERT INTO daftar_denda (pengembalian_id, denda, keterangan)
VALUES (?, ?, ?);

-- name: deleteTempPengembalianById
DELETE FROM temp_pengembalian
WHERE id = ?;

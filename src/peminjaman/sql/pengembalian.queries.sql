-- name: findPeminjamanById
SELECT id
FROM peminjaman
WHERE id = ?
LIMIT 1;

-- name: insertTempPengembalian
INSERT INTO temp_pengembalian (peminjaman_id, tanggal_dikembalikan)
VALUES (?, ?);

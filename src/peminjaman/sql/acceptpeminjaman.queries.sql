-- name: findAdminByAccountId
SELECT id
FROM admins
WHERE account_id = ? OR id = ?
LIMIT 1;

-- name: findTempPeminjamanById
SELECT id, user_id, book_id, tanggal_peminjaman
FROM temp_peminjaman
WHERE id = ?
LIMIT 1;

-- name: insertPeminjaman
INSERT INTO peminjaman (user_id, admin_id, book_id, tanggal_peminjaman, tanggal_batas_peminjaman)
VALUES (?, ?, ?, ?, ?);

-- name: deleteTempPeminjamanById
DELETE FROM temp_peminjaman
WHERE id = ?;

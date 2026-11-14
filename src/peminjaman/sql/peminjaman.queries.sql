-- name: findUserByAccountId
SELECT id
FROM users
WHERE account_id = ? OR id = ?
LIMIT 1;

-- name: insertTempPeminjaman
INSERT INTO temp_peminjaman (user_id, book_id, tanggal_peminjaman)
VALUES (?, ?, ?);

-- name: updateUser
UPDATE users
SET nama_lengkap = COALESCE(?, nama_lengkap),
    no_hp = COALESCE(?, no_hp),
    alamat = COALESCE(?, alamat),
    updated_at = ?
WHERE id = ?;

-- name: findUserAccountById
SELECT id, account_id
FROM users
WHERE id = ?
LIMIT 1;

-- name: deleteAccountById
DELETE FROM accounts
WHERE id = ?;

-- name: findUserWithAccountById
SELECT u.id,
       u.account_id,
       u.nama_lengkap,
       u.no_hp,
       u.alamat,
       u.created_at,
       u.updated_at,
       a.username,
       a.email,
       a.role,
       a.created_at AS account_created_at
FROM users u
JOIN accounts a ON a.id = u.account_id
WHERE u.id = ?
LIMIT 1;

-- name: findPengembalianById
SELECT id
FROM pengembalian
WHERE id = ?
LIMIT 1;

-- name: insertDenda
INSERT INTO daftar_denda (pengembalian_id, denda, keterangan)
VALUES (?, ?, ?)
RETURNING id;

-- name: findDendaById
SELECT id, denda
FROM daftar_denda
WHERE id = ?
LIMIT 1;

-- name: updateDendaAmount
UPDATE daftar_denda
SET denda = ?
WHERE id = ?;

-- name: deleteDendaById
DELETE FROM daftar_denda
WHERE id = ?;

-- name: findAllDenda
SELECT dd.id AS id_denda,
       a.username,
       u.nama_lengkap,
       pg.status_buku,
       dd.denda,
       dd.keterangan AS keterangan_buku,
       pg.tanggal_dikembalikan
FROM daftar_denda dd
JOIN pengembalian pg ON pg.id = dd.pengembalian_id
JOIN peminjaman pm ON pm.id = pg.peminjaman_id
JOIN users u ON u.id = pm.user_id
JOIN accounts a ON a.id = u.account_id;

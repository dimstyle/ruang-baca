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

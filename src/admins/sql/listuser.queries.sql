-- name: findAllUsers
SELECT u.id AS id_user,
       a.username,
       a.email,
       u.nama_lengkap,
       u.no_hp,
       u.alamat,
       u.created_at
FROM users u
JOIN accounts a ON a.id = u.account_id
ORDER BY u.created_at DESC;

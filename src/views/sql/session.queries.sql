-- name: findProfileByAccountId
SELECT a.id,
       a.username,
       a.email,
       a.role,
       COALESCE(u.nama_lengkap, ad.nama_lengkap, a.username) AS nama_lengkap
FROM accounts a
LEFT JOIN users u ON u.account_id = a.id
LEFT JOIN admins ad ON ad.account_id = a.id
WHERE a.id = ?
LIMIT 1;

-- name: countPendingRequests
SELECT (SELECT COUNT(*) FROM temp_peminjaman) AS peminjaman,
       (SELECT COUNT(*) FROM temp_pengembalian) AS pengembalian;

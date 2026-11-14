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

-- name: findAllPengembalianOptions
SELECT pg.id,
       u.nama_lengkap,
       b.judul AS judul_buku,
       pg.status_buku,
       pg.tanggal_dikembalikan
FROM pengembalian pg
JOIN peminjaman pm ON pm.id = pg.peminjaman_id
JOIN users u ON u.id = pm.user_id
JOIN books b ON b.id = pm.book_id
ORDER BY pg.id DESC;

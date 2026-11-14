-- name: findAllTempPeminjaman
SELECT tp.id AS temp_peminjaman_id,
       a.username,
       u.nama_lengkap,
       b.judul AS judul_buku,
       tp.tanggal_peminjaman
FROM temp_peminjaman tp
JOIN users u ON u.id = tp.user_id
JOIN accounts a ON a.id = u.account_id
JOIN books b ON b.id = tp.book_id
ORDER BY tp.tanggal_peminjaman ASC;

-- name: findAllTempPengembalian
SELECT tk.id AS temp_pengembalian_id,
       tk.peminjaman_id,
       a.username,
       u.nama_lengkap,
       b.judul AS judul_buku,
       pm.tanggal_batas_peminjaman,
       tk.tanggal_dikembalikan
FROM temp_pengembalian tk
JOIN peminjaman pm ON pm.id = tk.peminjaman_id
JOIN users u ON u.id = pm.user_id
JOIN accounts a ON a.id = u.account_id
JOIN books b ON b.id = pm.book_id
ORDER BY tk.tanggal_dikembalikan ASC;

-- name: findTempPeminjamanByUser
SELECT NULL AS peminjaman_id,
       b.judul AS judul_buku,
       tp.tanggal_peminjaman,
       NULL AS tanggal_batas_peminjaman,
       'Menunggu' AS status
FROM temp_peminjaman tp
JOIN books b ON b.id = tp.book_id
WHERE tp.user_id = ?
ORDER BY tp.tanggal_peminjaman DESC;

-- name: findPeminjamanByUser
SELECT pm.id AS peminjaman_id,
       b.judul AS judul_buku,
       pm.tanggal_peminjaman,
       pm.tanggal_batas_peminjaman,
       CASE
         WHEN EXISTS (SELECT 1 FROM pengembalian pg WHERE pg.peminjaman_id = pm.id) THEN 'Dikembalikan'
         WHEN EXISTS (SELECT 1 FROM temp_pengembalian tk WHERE tk.peminjaman_id = pm.id) THEN 'Menunggu Pengembalian'
         ELSE 'Dipinjam'
       END AS status
FROM peminjaman pm
JOIN books b ON b.id = pm.book_id
WHERE pm.user_id = ?
ORDER BY pm.tanggal_peminjaman DESC;

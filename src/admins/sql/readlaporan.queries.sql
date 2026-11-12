-- name: findLaporanByIdAndAdmin
SELECT l.id,
       l.admin_id,
       a.email AS email_admin,
       a.username AS username_admin,
       ad.nama_lengkap AS nama_lengkap_admin,
       l.keterangan,
       l.total_denda,
       l.tanggal_awal_peminjaman,
       l.tanggal_akhir_peminjaman,
       l.tanggal_awal_pengembalian,
       l.tanggal_akhir_pengembalian
FROM laporan l
JOIN admins ad ON ad.id = l.admin_id
JOIN accounts a ON a.id = ad.account_id
WHERE l.id = ? AND l.admin_id = ?
LIMIT 1;

-- name: findPeminjamanForLaporan
SELECT a.email AS email_user,
       a.username AS username_user,
       u.nama_lengkap AS nama_lengkap_user,
       b.judul AS judul_buku,
       b.penerbit,
       b.tanggal_rilis,
       pm.tanggal_peminjaman
FROM peminjaman pm
JOIN users u ON u.id = pm.user_id
JOIN accounts a ON a.id = u.account_id
JOIN books b ON b.id = pm.book_id
WHERE pm.admin_id = ?
  AND pm.tanggal_peminjaman BETWEEN ? AND ?;

-- name: findPengembalianForLaporan
SELECT a.email AS email_user,
       a.username AS username_user,
       u.nama_lengkap AS nama_lengkap_user,
       b.judul AS judul_buku,
       b.penerbit,
       b.tanggal_rilis,
       pg.status_buku,
       COALESCE(dd.denda, 0) AS denda,
       pg.tanggal_dikembalikan AS tanggal_pengembalian
FROM pengembalian pg
JOIN peminjaman pm ON pm.id = pg.peminjaman_id
JOIN users u ON u.id = pm.user_id
JOIN accounts a ON a.id = u.account_id
JOIN books b ON b.id = pm.book_id
LEFT JOIN daftar_denda dd ON dd.pengembalian_id = pg.id
WHERE pm.admin_id = ?
  AND pg.tanggal_dikembalikan BETWEEN ? AND ?;

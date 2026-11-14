-- name: findAllDenda
SELECT dd.id AS id_denda,
       a.username,
       u.nama_lengkap,
       b.judul AS judul_buku,
       pg.status_buku,
       dd.denda,
       dd.keterangan AS keterangan_buku,
       pg.tanggal_dikembalikan
FROM daftar_denda dd
JOIN pengembalian pg ON pg.id = dd.pengembalian_id
JOIN peminjaman pm ON pm.id = pg.peminjaman_id
JOIN books b ON b.id = pm.book_id
JOIN users u ON u.id = pm.user_id
JOIN accounts a ON a.id = u.account_id;

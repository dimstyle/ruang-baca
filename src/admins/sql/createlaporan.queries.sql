-- name: findAdminByAccountId
SELECT id
FROM admins
WHERE account_id = ? OR id = ?
LIMIT 1;

-- name: insertLaporan
INSERT INTO laporan (
  admin_id,
  keterangan,
  total_denda,
  total_peminjam,
  tanggal_awal_peminjaman,
  tanggal_akhir_peminjaman,
  tanggal_awal_pengembalian,
  tanggal_akhir_pengembalian,
  tanggal_pembuatan_laporan
)
VALUES (
  ?,
  ?,
  COALESCE((
    SELECT SUM(dd.denda)
    FROM daftar_denda dd
    JOIN pengembalian pg ON pg.id = dd.pengembalian_id
    JOIN peminjaman pm ON pm.id = pg.peminjaman_id
    WHERE pm.admin_id = ?
      AND pg.tanggal_dikembalikan BETWEEN ? AND ?
  ), 0),
  (
    SELECT COUNT(*)
    FROM peminjaman pm
    WHERE pm.admin_id = ?
      AND pm.tanggal_peminjaman BETWEEN ? AND ?
  ),
  ?,
  ?,
  ?,
  ?,
  ?
)
RETURNING id;

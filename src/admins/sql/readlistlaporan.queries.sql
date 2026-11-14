-- name: findAllLaporanByAdmin
SELECT id AS laporan_id,
       keterangan,
       total_denda,
       total_peminjam,
       tanggal_pembuatan_laporan
FROM laporan
WHERE admin_id = ?
ORDER BY tanggal_pembuatan_laporan DESC;

-- name: findLaporanByAdminAndDateRange
SELECT id AS laporan_id,
       keterangan,
       total_denda,
       total_peminjam,
       tanggal_pembuatan_laporan
FROM laporan
WHERE admin_id = ?
  AND tanggal_pembuatan_laporan BETWEEN ? AND ?
ORDER BY tanggal_pembuatan_laporan DESC;

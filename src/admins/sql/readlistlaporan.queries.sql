-- name: findAllLaporanByAdmin
SELECT id AS laporan_id,
       tanggal_pembuatan_laporan
FROM laporan
WHERE admin_id = ?;

-- name: findLaporanByAdminAndDateRange
SELECT id AS laporan_id,
       tanggal_pembuatan_laporan
FROM laporan
WHERE admin_id = ?
  AND tanggal_pembuatan_laporan BETWEEN ? AND ?;

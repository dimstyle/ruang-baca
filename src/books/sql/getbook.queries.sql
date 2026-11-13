-- name: findAllBooks
SELECT c.nama_kategori,
       c.jenis_buku,
       b.judul   AS judul_buku,
       b.penulis AS penulis_buku,
       b.sinopsis,
       b.tanggal_rilis,
       b.stok
FROM books b
JOIN categories c ON c.id = b.categories_id
ORDER BY b.id ASC;

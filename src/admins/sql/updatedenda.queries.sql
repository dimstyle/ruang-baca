-- name: findDendaById
SELECT id, denda
FROM daftar_denda
WHERE id = ?
LIMIT 1;

-- name: updateDendaAmount
UPDATE daftar_denda
SET denda = ?
WHERE id = ?;

-- name: deleteDendaById
DELETE FROM daftar_denda
WHERE id = ?;

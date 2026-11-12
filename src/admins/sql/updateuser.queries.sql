-- name: updateUser
UPDATE users
SET nama_lengkap = COALESCE(?, nama_lengkap),
    no_hp = COALESCE(?, no_hp),
    alamat = COALESCE(?, alamat),
    updated_at = ?
WHERE id = ?;

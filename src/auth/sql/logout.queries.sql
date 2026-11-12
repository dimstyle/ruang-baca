-- name: deleteRefreshToken
DELETE FROM refresh_token
WHERE account_id = ? AND token = ?;

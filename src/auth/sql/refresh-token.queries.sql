-- name: findValidRefreshToken
SELECT rt.id, a.email
FROM refresh_token rt
JOIN accounts a ON a.id = rt.account_id
WHERE rt.token = ? AND rt.account_id = ? AND rt.expired_at > ?
LIMIT 1;

-- name: updateRefreshToken
UPDATE refresh_token
SET token = ?, expired_at = ?
WHERE id = ?;

-- name: findAccountByEmail
SELECT id, email, password
FROM accounts
WHERE email = ?
LIMIT 1;

-- name: insertRefreshToken
INSERT INTO refresh_token (account_id, token, created_at, expired_at)
VALUES (?, ?, CURRENT_TIMESTAMP, ?);

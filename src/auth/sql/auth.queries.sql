-- name: findAccountRoleById
SELECT id, role
FROM accounts
WHERE id = ?
LIMIT 1;

-- name: insertAccount
INSERT INTO accounts (id, username, email, password, role, created_at)
VALUES (?, ?, ?, ?, 'user', CURRENT_TIMESTAMP);

-- name: insertUser
INSERT INTO users (id, account_id, nama_lengkap, no_hp, alamat, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- name: findAccountByEmail
SELECT id, email, password
FROM accounts
WHERE email = ?
LIMIT 1;

-- name: insertRefreshToken
INSERT INTO refresh_token (account_id, token, created_at, expired_at)
VALUES (?, ?, CURRENT_TIMESTAMP, ?);

-- name: deleteRefreshToken
DELETE FROM refresh_token
WHERE account_id = ? AND token = ?;

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

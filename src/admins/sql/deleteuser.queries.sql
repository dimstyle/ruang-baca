-- name: findUserAccountById
SELECT id, account_id
FROM users
WHERE id = ?
LIMIT 1;

-- name: deleteAccountById
DELETE FROM accounts
WHERE id = ?;

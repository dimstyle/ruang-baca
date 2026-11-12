-- name: findAccountRoleById
SELECT id, role
FROM accounts
WHERE id = ?
LIMIT 1;

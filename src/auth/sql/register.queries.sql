-- name: insertAccount
INSERT INTO accounts (id, username, email, password, role, created_at)
VALUES (?, ?, ?, ?, 'user', CURRENT_TIMESTAMP);

-- name: insertUser
INSERT INTO users (id, account_id, nama_lengkap, no_hp, alamat, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

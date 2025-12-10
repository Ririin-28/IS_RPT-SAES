ALTER TABLE english_activity_schedule
ADD COLUMN subject VARCHAR(100) NOT NULL DEFAULT 'English';

CREATE TABLE IF NOT EXISTS parent_sessions (
	session_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	user_id INT NOT NULL,
	token_hash CHAR(64) NOT NULL UNIQUE,
	user_agent VARCHAR(255) DEFAULT NULL,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	last_active_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	expires_at DATETIME NOT NULL,
	revoked_at DATETIME DEFAULT NULL,
	INDEX idx_parent_sessions_user_id (user_id),
	INDEX idx_parent_sessions_token_hash (token_hash),
	INDEX idx_parent_sessions_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_sessions (
	session_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	user_id INT NOT NULL,
	token_hash CHAR(64) NOT NULL UNIQUE,
	user_agent VARCHAR(255) DEFAULT NULL,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	last_active_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	expires_at DATETIME NOT NULL,
	revoked_at DATETIME DEFAULT NULL,
	INDEX idx_admin_sessions_user_id (user_id),
	INDEX idx_admin_sessions_token_hash (token_hash),
	INDEX idx_admin_sessions_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Create user_servers table for mapping users to their pi server connections
CREATE TABLE IF NOT EXISTS user_servers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, device_id)
);
-- Add an index for quick lookup
CREATE INDEX IF NOT EXISTS idx_user_servers_user_id ON user_servers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_servers_device_id ON user_servers(device_id);

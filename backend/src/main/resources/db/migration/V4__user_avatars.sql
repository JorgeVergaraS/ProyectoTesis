ALTER TABLE nexo.users ADD COLUMN avatar_version UUID;

CREATE TABLE nexo.user_avatars (
    user_id UUID PRIMARY KEY REFERENCES nexo.users(id) ON DELETE CASCADE,
    image BYTEA NOT NULL CHECK (octet_length(image) <= 2097152)
);

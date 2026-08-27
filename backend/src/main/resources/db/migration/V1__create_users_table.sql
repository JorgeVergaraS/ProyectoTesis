CREATE TABLE nexo.users (
    id UUID PRIMARY KEY,
    identity_provider VARCHAR(16) NOT NULL CHECK (identity_provider IN ('DEMO', 'ENTRA')),
    entra_object_id VARCHAR(255) UNIQUE,
    email VARCHAR(254),
    username VARCHAR(64) UNIQUE NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    avatar_url VARCHAR(500),
    color VARCHAR(16) NOT NULL DEFAULT '#8B5CF6',
    bio VARCHAR(250) NOT NULL DEFAULT '',
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((identity_provider = 'DEMO' AND entra_object_id IS NULL)
        OR (identity_provider = 'ENTRA' AND entra_object_id IS NOT NULL))
);

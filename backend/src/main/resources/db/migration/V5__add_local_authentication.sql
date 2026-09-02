ALTER TABLE nexo.users DROP CONSTRAINT IF EXISTS users_identity_provider_check;

ALTER TABLE nexo.users
    ADD CONSTRAINT users_identity_provider_check
        CHECK (identity_provider IN ('DEMO', 'ENTRA', 'LOCAL'));

ALTER TABLE nexo.users ALTER COLUMN entra_object_id DROP NOT NULL;
ALTER TABLE nexo.users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
    ON nexo.users (lower(email))
    WHERE email IS NOT NULL;

ALTER TABLE nexo.users ADD CONSTRAINT users_local_auth_check CHECK (
    (identity_provider = 'LOCAL' AND password_hash IS NOT NULL AND email IS NOT NULL)
    OR (identity_provider IN ('DEMO', 'ENTRA'))
);

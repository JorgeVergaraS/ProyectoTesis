ALTER TABLE nexo.users
    ADD COLUMN availability VARCHAR(16) NOT NULL DEFAULT 'AVAILABLE',
    ADD COLUMN profile_customized_at TIMESTAMPTZ;

ALTER TABLE nexo.users
    ADD CONSTRAINT users_availability_check
        CHECK (availability IN ('AVAILABLE', 'BUSY', 'AWAY'));

CREATE UNIQUE INDEX users_username_lower_unique
    ON nexo.users (lower(username));

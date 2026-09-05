CREATE TABLE nexo.broadcasts (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES nexo.conversations(id),
    host_id UUID NOT NULL REFERENCES nexo.users(id),
    room_name VARCHAR(100) NOT NULL UNIQUE,
    title VARCHAR(120) NOT NULL,
    source_type VARCHAR(10) NOT NULL CHECK (source_type IN ('SCREEN','CAMERA')),
    status VARCHAR(10) NOT NULL CHECK (status IN ('DRAFT','STARTING','LIVE','ENDED','FAILED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '90 seconds',
    end_reason VARCHAR(100)
);
CREATE UNIQUE INDEX broadcasts_one_host ON nexo.broadcasts(host_id)
    WHERE status IN ('DRAFT','STARTING','LIVE');
CREATE INDEX broadcasts_conversation ON nexo.broadcasts(conversation_id, status);

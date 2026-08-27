CREATE TABLE nexo.demo_sessions (
    token_hash VARCHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES nexo.users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX demo_sessions_user_idx ON nexo.demo_sessions(user_id, expires_at);

CREATE TABLE nexo.conversations (
    id UUID PRIMARY KEY,
    kind VARCHAR(16) NOT NULL CHECK (kind IN ('CHANNEL', 'DIRECT')),
    slug VARCHAR(64) UNIQUE,
    title VARCHAR(120) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    person_a UUID REFERENCES nexo.users(id),
    person_b UUID REFERENCES nexo.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(person_a, person_b),
    CHECK ((kind = 'CHANNEL' AND slug IS NOT NULL AND person_a IS NULL AND person_b IS NULL)
        OR (kind = 'DIRECT' AND slug IS NULL AND person_a IS NOT NULL AND person_b IS NOT NULL AND person_a < person_b))
);
CREATE TABLE nexo.conversation_members (
    conversation_id UUID NOT NULL REFERENCES nexo.conversations(id),
    user_id UUID NOT NULL REFERENCES nexo.users(id),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY(conversation_id, user_id)
);
CREATE INDEX conversation_members_user_idx ON nexo.conversation_members(user_id);
CREATE TABLE nexo.messages (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES nexo.conversations(id),
    sender_id UUID NOT NULL REFERENCES nexo.users(id),
    client_id UUID NOT NULL,
    body VARCHAR(2000) NOT NULL CHECK (length(trim(body)) > 0),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(conversation_id, sender_id, client_id)
);
CREATE INDEX messages_conversation_time_idx ON nexo.messages(conversation_id, sent_at DESC, id DESC);

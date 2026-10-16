CREATE TABLE nexo.message_event_audit (
    message_id UUID PRIMARY KEY REFERENCES nexo.messages(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES nexo.conversations(id) ON DELETE CASCADE,
    occurred_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE nexo.conversation_activity_events (
    message_id UUID PRIMARY KEY REFERENCES nexo.messages(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES nexo.conversations(id) ON DELETE CASCADE,
    occurred_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX conversation_activity_window_idx
    ON nexo.conversation_activity_events(conversation_id, occurred_at);

-- Only new messages sent with events enabled enter this durable outbox.
CREATE TABLE nexo.message_outbox (
    message_id UUID PRIMARY KEY REFERENCES nexo.messages(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX message_outbox_pending_idx ON nexo.message_outbox(created_at, message_id);

CREATE TABLE nexo.message_notifications (
    message_id UUID NOT NULL REFERENCES nexo.messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES nexo.users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ,
    PRIMARY KEY(message_id, user_id)
);
CREATE INDEX message_notifications_unread_idx
    ON nexo.message_notifications(user_id) WHERE read_at IS NULL;

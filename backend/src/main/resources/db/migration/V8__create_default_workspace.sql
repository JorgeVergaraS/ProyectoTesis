INSERT INTO nexo.conversations(id, kind, slug, title, description)
VALUES (
    '20000000-0000-0000-0000-000000000001',
    'CHANNEL',
    'general',
    'general',
    'El punto de encuentro de la comunidad. Preséntate y comparte lo que tienes en mente.'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO nexo.conversation_members(conversation_id, user_id)
SELECT conversation.id, users.id
FROM nexo.conversations conversation
CROSS JOIN nexo.users users
WHERE conversation.slug = 'general' AND users.status = 'ACTIVE'
ON CONFLICT DO NOTHING;

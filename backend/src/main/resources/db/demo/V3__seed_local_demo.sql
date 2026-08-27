INSERT INTO nexo.users(id, identity_provider, username, display_name, color, bio) VALUES
('10000000-0000-0000-0000-000000000001', 'DEMO', 'jorge', 'Jorge', '#8B5CF6', 'Siempre hay algo nuevo que construir.'),
('10000000-0000-0000-0000-000000000002', 'DEMO', 'jean', 'Jean', '#38BDF8', 'Ideas, código y un buen café.'),
('10000000-0000-0000-0000-000000000003', 'DEMO', 'fernando', 'Fernando', '#F59E0B', 'Conectar y aprender en comunidad.');

INSERT INTO nexo.conversations(id, kind, slug, title, description) VALUES
('20000000-0000-0000-0000-000000000001', 'CHANNEL', 'general', 'general', 'El punto de encuentro de la comunidad. Preséntate y comparte lo que tienes en mente.'),
('20000000-0000-0000-0000-000000000002', 'CHANNEL', 'desarrollo', 'desarrollo', 'Código, proyectos y preguntas. Construyamos algo juntos.'),
('20000000-0000-0000-0000-000000000003', 'CHANNEL', 'vida-universitaria', 'vida-universitaria', 'Lo que pasa fuera de clases también nos conecta.'),
('20000000-0000-0000-0000-000000000004', 'CHANNEL', 'ideas-y-proyectos', 'ideas-y-proyectos', 'Ese proyecto que tienes en mente puede empezar aquí.');

INSERT INTO nexo.conversation_members(conversation_id, user_id)
SELECT '20000000-0000-0000-0000-000000000001'::uuid, id FROM nexo.users WHERE identity_provider = 'DEMO';

INSERT INTO nexo.messages(id, conversation_id, sender_id, client_id, body, sent_at) VALUES
('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '¡Bienvenidos a Nexo! 👋 Este es nuestro punto de encuentro. ¿Qué construimos primero?', now() - interval '6 minutes'),
('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '¡Vamos! Podemos usar #desarrollo para compartir los avances del proyecto.', now() - interval '4 minutes'),
('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', 'Me sumo 🙌 También dejemos un espacio para las ideas de la comunidad.', now() - interval '2 minutes');

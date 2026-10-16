-- Entra object IDs are scoped to a tenant; keep identities distinct across directories.
UPDATE nexo.users
SET entra_object_id = '21a4bbb2-fc48-4053-a98e-b805aa2306cc:' || lower(entra_object_id)
WHERE identity_provider = 'ENTRA'
  AND entra_object_id IS NOT NULL
  AND entra_object_id NOT LIKE '%:%';

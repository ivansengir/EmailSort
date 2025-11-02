-- Verificar la relación entre auth.users y users
SELECT 
  au.id as auth_id,
  u.id as user_id,
  u.email as user_email,
  au.email as auth_email
FROM auth.users au
LEFT JOIN public.users u ON u.auth_id = au.id
ORDER BY au.created_at DESC
LIMIT 5;

-- Ver gmail_accounts con el user_id completo
SELECT 
  ga.id,
  ga.user_id,
  ga.email as gmail_email,
  u.email as user_email,
  u.auth_id
FROM gmail_accounts ga
LEFT JOIN users u ON u.id = ga.user_id
ORDER BY ga.created_at DESC;

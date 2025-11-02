-- Script para diagnosticar problemas con bulk actions

-- 1. Ver si hay emails no borrados
SELECT 
  id,
  subject,
  from_email,
  is_deleted,
  is_archived,
  gmail_message_id,
  gmail_account_id,
  category_id
FROM emails
WHERE is_deleted = false
LIMIT 5;

-- 2. Ver emails borrados recientemente
SELECT 
  id,
  subject,
  from_email,
  is_deleted,
  updated_at,
  gmail_message_id
FROM emails
WHERE is_deleted = true
ORDER BY updated_at DESC
LIMIT 5;

-- 3. Ver intentos de unsubscribe (logs)
SELECT 
  ul.id,
  ul.created_at,
  ul.status,
  ul.unsubscribe_method,
  ul.error_message,
  e.subject,
  e.from_email
FROM unsubscribe_logs ul
JOIN emails e ON ul.email_id = e.id
ORDER BY ul.created_at DESC
LIMIT 10;

-- 4. Ver cuentas de Gmail y sus tokens
SELECT 
  id,
  email,
  oauth_token IS NOT NULL as has_access_token,
  oauth_refresh_token IS NOT NULL as has_refresh_token,
  token_expires_at,
  token_expires_at > NOW() as token_valid
FROM gmail_accounts;

-- 5. Ver categorías del usuario
SELECT id, name, email_count
FROM categories
ORDER BY created_at DESC;

-- 6. Estadísticas generales
SELECT 
  COUNT(*) FILTER (WHERE is_deleted = false) as active_emails,
  COUNT(*) FILTER (WHERE is_deleted = true) as deleted_emails,
  COUNT(*) FILTER (WHERE is_archived = true) as archived_emails,
  COUNT(DISTINCT category_id) as categories_used
FROM emails;

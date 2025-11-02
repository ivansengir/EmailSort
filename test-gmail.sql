-- Verificar el estado de la cuenta de Gmail
SELECT 
  id,
  email,
  oauth_token IS NOT NULL as has_token,
  oauth_refresh_token IS NOT NULL as has_refresh_token,
  token_expires_at,
  last_sync_at,
  created_at
FROM gmail_accounts
ORDER BY created_at DESC;

-- Ver cuántos emails ya están importados
SELECT 
  COUNT(*) as total_emails,
  COUNT(DISTINCT gmail_account_id) as accounts_with_emails,
  MIN(date) as oldest_email,
  MAX(date) as newest_email
FROM emails;

-- Ver emails por cuenta
SELECT 
  ga.email as gmail_account,
  COUNT(e.id) as email_count
FROM gmail_accounts ga
LEFT JOIN emails e ON e.gmail_account_id = ga.id
GROUP BY ga.id, ga.email;

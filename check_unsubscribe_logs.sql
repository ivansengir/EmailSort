-- Verificar los datos reales en unsubscribe_logs
SELECT 
  id,
  created_at,
  status,
  unsubscribe_method,
  unsubscribe_target,
  error_message,
  email_id
FROM unsubscribe_logs
ORDER BY created_at DESC
LIMIT 10;

-- Verificar si la columna existe
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'unsubscribe_logs' 
AND column_name = 'unsubscribe_target';

-- Ver un registro específico con todos los detalles
SELECT *
FROM unsubscribe_logs
WHERE status = 'pending' 
AND unsubscribe_method = 'manual'
ORDER BY created_at DESC
LIMIT 1;

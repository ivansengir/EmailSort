-- =====================================================
-- MIGRACIONES PENDIENTES - EmailSort
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- 1. ÍNDICE CRÍTICO para rendimiento de auth
-- Esto resolverá los timeouts de 11+ segundos
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);
ANALYZE public.users;

-- 2. COLUMNA unsubscribe_target para guardar links
-- Esto permitirá ver los links de unsubscribe en los logs
ALTER TABLE unsubscribe_logs 
ADD COLUMN IF NOT EXISTS unsubscribe_target text;

-- 3. ÍNDICE para búsquedas de unsubscribe_target
CREATE INDEX IF NOT EXISTS unsubscribe_logs_target_idx 
ON unsubscribe_logs(unsubscribe_target);

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Verificar índice de users
SELECT 
    indexname, 
    tablename, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'users' 
AND indexname = 'idx_users_auth_id';

-- Verificar columna unsubscribe_target
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'unsubscribe_logs' 
AND column_name IN ('unsubscribe_target', 'error_message');

-- Verificar índice de unsubscribe_logs
SELECT 
    indexname, 
    tablename, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'unsubscribe_logs' 
AND indexname = 'unsubscribe_logs_target_idx';

-- =====================================================
-- RESULTADO ESPERADO
-- =====================================================
-- 1. idx_users_auth_id debe aparecer en pg_indexes
-- 2. unsubscribe_target debe aparecer como columna tipo 'text'
-- 3. error_message debe aparecer como columna existente
-- 4. unsubscribe_logs_target_idx debe aparecer en pg_indexes
-- =====================================================

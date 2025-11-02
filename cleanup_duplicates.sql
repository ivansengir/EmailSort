-- Script para limpiar cuentas de Gmail duplicadas
-- Ejecutar en Supabase SQL Editor

-- 1. Ver cuántas duplicadas hay
SELECT user_id, email, COUNT(*) as count
FROM gmail_accounts
GROUP BY user_id, email
HAVING COUNT(*) > 1;

-- 2. Eliminar duplicados, manteniendo solo el más reciente
DELETE FROM gmail_accounts
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, email
             ORDER BY created_at DESC
           ) AS rn
    FROM gmail_accounts
  ) t
  WHERE t.rn > 1
);

-- 3. Verificar que no queden duplicados
SELECT user_id, email, COUNT(*) as count
FROM gmail_accounts
GROUP BY user_id, email
HAVING COUNT(*) > 1;

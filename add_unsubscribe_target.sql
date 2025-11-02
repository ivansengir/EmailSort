-- Añadir columna unsubscribe_target a unsubscribe_logs
-- Esta columna guardará el link o método específico usado para darse de baja

ALTER TABLE unsubscribe_logs 
ADD COLUMN IF NOT EXISTS unsubscribe_target text;

-- Crear índice para búsquedas por target
CREATE INDEX IF NOT EXISTS unsubscribe_logs_target_idx ON unsubscribe_logs(unsubscribe_target);

-- Verificar que la columna se haya creado
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'unsubscribe_logs' 
AND column_name = 'unsubscribe_target';

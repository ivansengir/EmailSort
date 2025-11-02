-- Optimización de índices para mejorar performance de queries

-- Índice en users.auth_id para acelerar búsquedas por usuario autenticado
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);

-- Índice en gmail_accounts.user_id para joins rápidos
CREATE INDEX IF NOT EXISTS idx_gmail_accounts_user_id ON gmail_accounts(user_id);

-- Índice en categories.user_id para joins rápidos
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);

-- Índice en emails.gmail_account_id para búsquedas por cuenta
CREATE INDEX IF NOT EXISTS idx_emails_gmail_account_id ON emails(gmail_account_id);

-- Índice en emails.category_id para filtros por categoría
CREATE INDEX IF NOT EXISTS idx_emails_category_id ON emails(category_id);

-- Índice compuesto para búsqueda rápida de emails duplicados
CREATE INDEX IF NOT EXISTS idx_emails_account_message ON emails(gmail_account_id, gmail_message_id);

-- Índice en email_selections.user_id
CREATE INDEX IF NOT EXISTS idx_email_selections_user_id ON email_selections(user_id);

-- Índice en unsubscribe_logs.user_id
CREATE INDEX IF NOT EXISTS idx_unsubscribe_logs_user_id ON unsubscribe_logs(user_id);

-- Analizar tablas para actualizar estadísticas del query planner
ANALYZE users;
ANALYZE gmail_accounts;
ANALYZE categories;
ANALYZE emails;
ANALYZE email_selections;
ANALYZE unsubscribe_logs;

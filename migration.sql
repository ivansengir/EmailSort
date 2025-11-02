/*
  # EmailSort AI - Schema Completo para Tu Supabase de Vercel

  ## Descripción
  Este script crea todas las tablas, índices, políticas RLS y triggers necesarios
  para la aplicación EmailSort AI.

  ## Tablas Creadas
  1. users - Perfiles de usuario
  2. gmail_accounts - Cuentas de Gmail conectadas
  3. categories - Categorías personalizadas de emails
  4. emails - Emails importados y categorizados
  5. email_selections - Selecciones de emails para acciones masivas
  6. unsubscribe_logs - Registro de intentos de desuscripción

  ## Seguridad
  - Row Level Security (RLS) habilitado en todas las tablas
  - Políticas restrictivas: usuarios solo acceden a sus propios datos
  - Validación de auth_id con auth.uid()

  ## Cómo Ejecutar
  1. Ve a tu Supabase Dashboard (Vercel)
  2. SQL Editor
  3. Pega este script completo
  4. Click "Run"
*/

-- ============================================================================
-- 1. TABLA: users
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  display_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para users
CREATE INDEX IF NOT EXISTS users_auth_id_idx ON users(auth_id);
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);

-- RLS para users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_id);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_id)
  WITH CHECK (auth.uid() = auth_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = auth_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 2. TABLA: gmail_accounts
-- ============================================================================

CREATE TABLE IF NOT EXISTS gmail_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL,
  oauth_token text NOT NULL,
  oauth_refresh_token text NOT NULL,
  token_expires_at timestamptz,
  is_primary boolean DEFAULT false,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE gmail_accounts
  ADD CONSTRAINT gmail_accounts_user_email_unique UNIQUE (user_id, email);

-- Índices para gmail_accounts
CREATE INDEX IF NOT EXISTS gmail_accounts_user_id_idx ON gmail_accounts(user_id);
CREATE INDEX IF NOT EXISTS gmail_accounts_email_idx ON gmail_accounts(email);

-- RLS para gmail_accounts
ALTER TABLE gmail_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own gmail accounts" ON gmail_accounts;
CREATE POLICY "Users can view own gmail accounts"
  ON gmail_accounts FOR SELECT
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own gmail accounts" ON gmail_accounts;
CREATE POLICY "Users can insert own gmail accounts"
  ON gmail_accounts FOR INSERT
  TO authenticated
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own gmail accounts" ON gmail_accounts;
CREATE POLICY "Users can update own gmail accounts"
  ON gmail_accounts FOR UPDATE
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own gmail accounts" ON gmail_accounts;
CREATE POLICY "Users can delete own gmail accounts"
  ON gmail_accounts FOR DELETE
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Trigger para updated_at
DROP TRIGGER IF EXISTS gmail_accounts_updated_at ON gmail_accounts;
CREATE TRIGGER gmail_accounts_updated_at
  BEFORE UPDATE ON gmail_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 3. TABLA: categories
-- ============================================================================

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL,
  color text DEFAULT '#3b82f6',
  email_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para categories
CREATE INDEX IF NOT EXISTS categories_user_id_idx ON categories(user_id);

-- RLS para categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own categories" ON categories;
CREATE POLICY "Users can view own categories"
  ON categories FOR SELECT
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own categories" ON categories;
CREATE POLICY "Users can insert own categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own categories" ON categories;
CREATE POLICY "Users can update own categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own categories" ON categories;
CREATE POLICY "Users can delete own categories"
  ON categories FOR DELETE
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Trigger para updated_at
DROP TRIGGER IF EXISTS categories_updated_at ON categories;
CREATE TRIGGER categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 4. TABLA: emails
-- ============================================================================

CREATE TABLE IF NOT EXISTS emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gmail_account_id uuid NOT NULL REFERENCES gmail_accounts(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  gmail_message_id text NOT NULL,
  gmail_thread_id text NOT NULL,
  subject text NOT NULL,
  from_email text NOT NULL,
  from_name text,
  to_email text NOT NULL,
  date timestamptz NOT NULL,
  content_text text,
  content_html text,
  ai_summary text NOT NULL,
  categorization_confidence numeric DEFAULT 0.95,
  is_archived boolean DEFAULT true,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(gmail_account_id, gmail_message_id)
);

-- Índices para emails
CREATE INDEX IF NOT EXISTS emails_user_id_idx ON emails(user_id);
CREATE INDEX IF NOT EXISTS emails_gmail_account_id_idx ON emails(gmail_account_id);
CREATE INDEX IF NOT EXISTS emails_category_id_idx ON emails(category_id);
CREATE INDEX IF NOT EXISTS emails_date_idx ON emails(date DESC);
CREATE INDEX IF NOT EXISTS emails_from_email_idx ON emails(from_email);

-- RLS para emails
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own emails" ON emails;
CREATE POLICY "Users can view own emails"
  ON emails FOR SELECT
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own emails" ON emails;
CREATE POLICY "Users can insert own emails"
  ON emails FOR INSERT
  TO authenticated
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own emails" ON emails;
CREATE POLICY "Users can update own emails"
  ON emails FOR UPDATE
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own emails" ON emails;
CREATE POLICY "Users can delete own emails"
  ON emails FOR DELETE
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Trigger para updated_at
DROP TRIGGER IF EXISTS emails_updated_at ON emails;
CREATE TRIGGER emails_updated_at
  BEFORE UPDATE ON emails
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 5. TABLA: email_selections
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_id uuid NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  selected_at timestamptz DEFAULT now(),
  UNIQUE(user_id, email_id)
);

-- Índices para email_selections
CREATE INDEX IF NOT EXISTS email_selections_user_id_idx ON email_selections(user_id);
CREATE INDEX IF NOT EXISTS email_selections_email_id_idx ON email_selections(email_id);

-- RLS para email_selections
ALTER TABLE email_selections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own selections" ON email_selections;
CREATE POLICY "Users can view own selections"
  ON email_selections FOR SELECT
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own selections" ON email_selections;
CREATE POLICY "Users can insert own selections"
  ON email_selections FOR INSERT
  TO authenticated
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own selections" ON email_selections;
CREATE POLICY "Users can delete own selections"
  ON email_selections FOR DELETE
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- ============================================================================
-- 6. TABLA: unsubscribe_logs
-- ============================================================================

CREATE TABLE IF NOT EXISTS unsubscribe_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_id uuid NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  status text NOT NULL,
  unsubscribe_method text,
  error_message text,
  attempt_count integer DEFAULT 1,
  last_attempted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Índices para unsubscribe_logs
CREATE INDEX IF NOT EXISTS unsubscribe_logs_user_id_idx ON unsubscribe_logs(user_id);
CREATE INDEX IF NOT EXISTS unsubscribe_logs_email_id_idx ON unsubscribe_logs(email_id);

-- RLS para unsubscribe_logs
ALTER TABLE unsubscribe_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own unsubscribe logs" ON unsubscribe_logs;
CREATE POLICY "Users can view own unsubscribe logs"
  ON unsubscribe_logs FOR SELECT
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own unsubscribe logs" ON unsubscribe_logs;
CREATE POLICY "Users can insert own unsubscribe logs"
  ON unsubscribe_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- ============================================================================
-- 7. FUNCIONES RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION toggle_email_selection(email_ids uuid[], should_select boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_uuid uuid;
BEGIN
  SELECT id INTO user_uuid FROM users WHERE auth_id = auth.uid();
  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF should_select THEN
    INSERT INTO email_selections (user_id, email_id)
    SELECT user_uuid, e_id
    FROM unnest(email_ids) AS e_id
    ON CONFLICT (user_id, email_id) DO NOTHING;
  ELSE
    DELETE FROM email_selections
    WHERE user_id = user_uuid AND email_id = ANY(email_ids);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION clear_email_selections_for_category(category_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_uuid uuid;
BEGIN
  SELECT id INTO user_uuid FROM users WHERE auth_id = auth.uid();
  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  DELETE FROM email_selections
  USING emails
  WHERE email_selections.email_id = emails.id
    AND email_selections.user_id = user_uuid
    AND emails.category_id = category_uuid;
END;
$$;

-- ============================================================================
-- 8. FUNCIONES AUXILIARES
-- ============================================================================

-- Función utilitaria para actualizar contador de emails en categorías
CREATE OR REPLACE FUNCTION increment_category_email_count(category_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE categories
  SET email_count = COALESCE(email_count, 0) + 1,
      updated_at = now()
  WHERE id = category_uuid;
END;
$$;

DO $$
BEGIN
  RAISE NOTICE '=== VERIFICACIÓN DE TABLAS ===';
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
    RAISE NOTICE '✓ Tabla users creada';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gmail_accounts') THEN
    RAISE NOTICE '✓ Tabla gmail_accounts creada';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'categories') THEN
    RAISE NOTICE '✓ Tabla categories creada';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'emails') THEN
    RAISE NOTICE '✓ Tabla emails creada';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'email_selections') THEN
    RAISE NOTICE '✓ Tabla email_selections creada';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'unsubscribe_logs') THEN
    RAISE NOTICE '✓ Tabla unsubscribe_logs creada';
  END IF;

  RAISE NOTICE '=== MIGRACIÓN COMPLETADA ===';
END $$;

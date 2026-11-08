-- 002 identity: accounts, credentials, sessions, API keys. Global tables (not tenant-scoped).
-- Only packages/db/identity.ts touches these tables; the runtime role must have no BYPASSRLS.
CREATE OR REPLACE FUNCTION app_tenant() RETURNS text LANGUAGE sql STABLE
 AS $$ SELECT nullif(current_setting('app.tenant', true), '') $$;
CREATE OR REPLACE FUNCTION app_user() RETURNS uuid LANGUAGE sql STABLE
 AS $$ SELECT nullif(current_setting('app.user', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email text NOT NULL CHECK (email = lower(email) AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' AND length(email) <= 254),
 display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
 email_verified_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (email)
);
DROP TRIGGER IF EXISTS users_touch ON users;
CREATE TRIGGER users_touch BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Password material lives apart from users so ordinary reads never load hashes.
CREATE TABLE IF NOT EXISTS user_credentials (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 algorithm text NOT NULL CHECK (algorithm IN ('scrypt')),
 phc text NOT NULL CHECK (phc LIKE '$scrypt$%' AND length(phc) <= 512),
 updated_at timestamptz NOT NULL DEFAULT now()
);

-- Opaque session tokens: only the SHA-256 of the token is stored.
CREATE TABLE IF NOT EXISTS sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
 tenant_id text CHECK (tenant_id ~ '^[a-z0-9-]{1,64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 last_seen_at timestamptz NOT NULL DEFAULT now(),
 idle_expires_at timestamptz NOT NULL,
 absolute_expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 CHECK (idle_expires_at <= absolute_expires_at)
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS password_resets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 used_at timestamptz
);

-- Server-to-server keys scoped to one tenant; replaces a single shared SERVICE_TOKEN over time.
CREATE TABLE IF NOT EXISTS api_keys (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id text NOT NULL CHECK (tenant_id ~ '^[a-z0-9-]{1,64}$'),
 name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
 prefix text NOT NULL CHECK (prefix ~ '^[A-Za-z0-9]{8}$'),
 key_hash text NOT NULL UNIQUE CHECK (key_hash ~ '^[0-9a-f]{64}$'),
 permissions text[] NOT NULL DEFAULT '{}',
 created_by uuid REFERENCES users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz,
 last_used_at timestamptz,
 revoked_at timestamptz
);
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_boundary ON api_keys;
CREATE POLICY tenant_boundary ON api_keys USING (tenant_id = app_tenant()) WITH CHECK (tenant_id = app_tenant());

-- Throttling evidence for credential stuffing; pruned by a job, never by a request.
CREATE TABLE IF NOT EXISTS login_attempts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 email text NOT NULL,
 succeeded boolean NOT NULL,
 attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_attempts_email_idx ON login_attempts (email, attempted_at DESC);

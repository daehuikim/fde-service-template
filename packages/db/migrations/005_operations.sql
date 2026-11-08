-- 005 operations: audit trail, transactional outbox, jobs, idempotency, throttling, tenant settings.
CREATE OR REPLACE FUNCTION deny_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN RAISE EXCEPTION 'append_only_table' USING ERRCODE = '42501'; END $$;

-- Who did what, when, to which record. tenant_id NULL = platform-level event (login, signup).
CREATE TABLE IF NOT EXISTS audit_log (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id text,
 actor_id uuid,
 actor_kind text NOT NULL CHECK (actor_kind IN ('user','api_key','service','system')),
 action text NOT NULL CHECK (action ~ '^[a-z_]+\.[a-z_]+$'),
 target_kind text CHECK (target_kind ~ '^[a-z_]{2,40}$'),
 target_id text CHECK (length(target_id) <= 128),
 request_id text CHECK (length(request_id) <= 64),
 metadata jsonb NOT NULL DEFAULT '{}' CHECK (pg_column_size(metadata) <= 8192),
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_tenant_idx ON audit_log (tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON audit_log (actor_id, occurred_at DESC);
DROP TRIGGER IF EXISTS audit_log_immutable ON audit_log;
CREATE TRIGGER audit_log_immutable BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION deny_mutation();
-- History rows are never edited; they leave only when their work item or tenant is hard-deleted (FK cascade).
DROP TRIGGER IF EXISTS work_item_events_immutable ON work_item_events;
CREATE TRIGGER work_item_events_immutable BEFORE UPDATE ON work_item_events FOR EACH ROW EXECUTE FUNCTION deny_mutation();
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_read ON audit_log;
DROP POLICY IF EXISTS tenant_write ON audit_log;
CREATE POLICY tenant_read ON audit_log FOR SELECT USING (tenant_id = app_tenant());
CREATE POLICY tenant_write ON audit_log FOR INSERT WITH CHECK (tenant_id IS NULL OR tenant_id = app_tenant());

-- Transactional outbox: written in the same transaction as the business change, relayed by a worker.
CREATE TABLE IF NOT EXISTS outbox_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id text NOT NULL,
 topic text NOT NULL CHECK (topic ~ '^[a-z_]+\.[a-z_]+$'),
 payload jsonb NOT NULL CHECK (pg_column_size(payload) <= 65536),
 created_at timestamptz NOT NULL DEFAULT now(),
 published_at timestamptz,
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);
CREATE INDEX IF NOT EXISTS outbox_pending_idx ON outbox_events (id) WHERE published_at IS NULL;

-- Background jobs leased with SKIP LOCKED; unique (tenant_id, dedupe_key) prevents duplicate scheduling.
CREATE TABLE IF NOT EXISTS jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id text NOT NULL,
 kind text NOT NULL CHECK (kind ~ '^[a-z_]+\.[a-z_]+$'),
 payload jsonb NOT NULL DEFAULT '{}' CHECK (pg_column_size(payload) <= 65536),
 dedupe_key text CHECK (length(dedupe_key) <= 128),
 status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed','cancelled')),
 run_after timestamptz NOT NULL DEFAULT now(),
 locked_by text,
 locked_until timestamptz,
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
 max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 50),
 last_error text CHECK (length(last_error) <= 2000),
 created_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 UNIQUE NULLS NOT DISTINCT (tenant_id, kind, dedupe_key)
);
CREATE INDEX IF NOT EXISTS jobs_ready_idx ON jobs (run_after) WHERE status = 'queued';

-- Generic idempotency for any mutating endpoint: same key + same request hash replays the stored response.
CREATE TABLE IF NOT EXISTS idempotency_keys (
 tenant_id text NOT NULL,
 scope text NOT NULL CHECK (scope ~ '^[a-z_./-]{1,80}$'),
 key text NOT NULL CHECK (key ~ '^[a-zA-Z0-9-]{8,80}$'),
 request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
 response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
 PRIMARY KEY (tenant_id, scope, key)
);

-- Fixed-window counters for login and API throttling; the application decides the limits.
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
 bucket text PRIMARY KEY CHECK (length(bucket) <= 160),
 window_started_at timestamptz NOT NULL DEFAULT now(),
 hits integer NOT NULL DEFAULT 0 CHECK (hits >= 0)
);

CREATE TABLE IF NOT EXISTS tenant_settings (
 tenant_id text PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
 settings jsonb NOT NULL DEFAULT '{}' CHECK (pg_column_size(settings) <= 16384),
 updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS tenant_settings_touch ON tenant_settings;
CREATE TRIGGER tenant_settings_touch BEFORE UPDATE ON tenant_settings FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- tenant_id NULL = global default, tenant row overrides it.
CREATE TABLE IF NOT EXISTS feature_flags (
 key text NOT NULL CHECK (key ~ '^[a-z0-9_]{2,60}$'),
 tenant_id text REFERENCES tenants(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (key, tenant_id)
);
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_boundary ON feature_flags;
CREATE POLICY tenant_boundary ON feature_flags USING (tenant_id IS NULL OR tenant_id = app_tenant()) WITH CHECK (tenant_id = app_tenant() OR (tenant_id IS NULL AND app_tenant() IS NULL));

DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['outbox_events','jobs','idempotency_keys','tenant_settings'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  EXECUTE format('DROP POLICY IF EXISTS tenant_boundary ON %I', t);
  EXECUTE format('CREATE POLICY tenant_boundary ON %I USING (tenant_id = app_tenant()) WITH CHECK (tenant_id = app_tenant())', t);
 END LOOP;
END $$;

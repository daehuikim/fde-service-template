CREATE TABLE IF NOT EXISTS runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id text NOT NULL CHECK (tenant_id ~ '^[a-z0-9-]{1,64}$'),
 idempotency_key text NOT NULL,
 payload_hash text NOT NULL CHECK (length(payload_hash)=64),
 result jsonb NOT NULL CHECK (result->>'version'='1'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,idempotency_key)
);
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_boundary ON runs;
CREATE POLICY tenant_boundary ON runs USING (tenant_id=current_setting('app.tenant',true)) WITH CHECK (tenant_id=current_setting('app.tenant',true));

-- 004 workspace: per-tenant work records and per-user working memory.
-- Every tenant table carries tenant_id; child rows reference parents with composite (tenant_id, id) keys
-- so a row can never point across a tenant boundary even if RLS were misconfigured.
CREATE TABLE IF NOT EXISTS workspaces (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 key text NOT NULL CHECK (key ~ '^[a-z0-9-]{1,40}$'),
 name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
 created_by uuid REFERENCES users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 archived_at timestamptz,
 UNIQUE (tenant_id, key),
 UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS work_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id text NOT NULL,
 workspace_id uuid NOT NULL,
 title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
 body text NOT NULL DEFAULT '' CHECK (length(body) <= 20000),
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','blocked','done','cancelled')),
 priority smallint NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
 assignee_id uuid REFERENCES users(id) ON DELETE SET NULL,
 created_by uuid REFERENCES users(id) ON DELETE SET NULL,
 version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz,
 UNIQUE (tenant_id, id),
 FOREIGN KEY (tenant_id, workspace_id) REFERENCES workspaces(tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS work_items_list_idx ON work_items (tenant_id, workspace_id, status, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS work_items_assignee_idx ON work_items (tenant_id, assignee_id) WHERE deleted_at IS NULL;
CREATE OR REPLACE FUNCTION bump_version() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN NEW.version := OLD.version + 1; NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS work_items_version ON work_items;
CREATE TRIGGER work_items_version BEFORE UPDATE ON work_items FOR EACH ROW EXECUTE FUNCTION bump_version();

-- Append-only history. Updates and deletes are rejected by trigger (see 005 deny_mutation).
CREATE TABLE IF NOT EXISTS work_item_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id text NOT NULL,
 work_item_id uuid NOT NULL,
 actor_id uuid, -- no FK on purpose: history keeps the actor id after the account is deleted
 kind text NOT NULL CHECK (kind ~ '^[a-z_]{2,40}$'),
 payload jsonb NOT NULL DEFAULT '{}' CHECK (pg_column_size(payload) <= 16384),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (tenant_id, work_item_id) REFERENCES work_items(tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS work_item_events_item_idx ON work_item_events (tenant_id, work_item_id, id);

CREATE TABLE IF NOT EXISTS tags (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 name text NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
 color text NOT NULL DEFAULT '#64748b' CHECK (color ~ '^#[0-9a-f]{6}$'),
 UNIQUE (tenant_id, name),
 UNIQUE (tenant_id, id)
);
CREATE TABLE IF NOT EXISTS work_item_tags (
 tenant_id text NOT NULL,
 work_item_id uuid NOT NULL,
 tag_id uuid NOT NULL,
 PRIMARY KEY (tenant_id, work_item_id, tag_id),
 FOREIGN KEY (tenant_id, work_item_id) REFERENCES work_items(tenant_id, id) ON DELETE CASCADE,
 FOREIGN KEY (tenant_id, tag_id) REFERENCES tags(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id text NOT NULL,
 work_item_id uuid NOT NULL,
 author_id uuid REFERENCES users(id) ON DELETE SET NULL,
 body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
 created_at timestamptz NOT NULL DEFAULT now(),
 edited_at timestamptz,
 FOREIGN KEY (tenant_id, work_item_id) REFERENCES work_items(tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS comments_item_idx ON comments (tenant_id, work_item_id, created_at);

-- Attachment metadata only; bytes live in object storage keyed by storage_key.
CREATE TABLE IF NOT EXISTS attachments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id text NOT NULL,
 work_item_id uuid NOT NULL,
 file_name text NOT NULL CHECK (length(file_name) BETWEEN 1 AND 255 AND file_name !~ '[/\\]'),
 media_type text NOT NULL CHECK (media_type ~ '^[a-z0-9.+-]+/[a-z0-9.+-]+$'),
 byte_size bigint NOT NULL CHECK (byte_size BETWEEN 0 AND 104857600),
 sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
 storage_key text NOT NULL UNIQUE,
 uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (tenant_id, work_item_id) REFERENCES work_items(tenant_id, id) ON DELETE CASCADE
);

-- Per-user working memory. visibility decides who else in the tenant may read a key.
CREATE TABLE IF NOT EXISTS memory_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id text NOT NULL,
 user_id uuid NOT NULL,
 workspace_id uuid,
 key text NOT NULL CHECK (key ~ '^[a-z0-9_.-]{1,80}$'),
 value jsonb NOT NULL CHECK (pg_column_size(value) <= 32768),
 visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','workspace','tenant')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE NULLS NOT DISTINCT (tenant_id, user_id, workspace_id, key),
 FOREIGN KEY (tenant_id, user_id) REFERENCES memberships(tenant_id, user_id) ON DELETE CASCADE,
 FOREIGN KEY (tenant_id, workspace_id) REFERENCES workspaces(tenant_id, id) ON DELETE CASCADE,
 CHECK (visibility <> 'workspace' OR workspace_id IS NOT NULL)
);
DROP TRIGGER IF EXISTS memory_entries_touch ON memory_entries;
CREATE TRIGGER memory_entries_touch BEFORE UPDATE ON memory_entries FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE IF NOT EXISTS saved_views (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id text NOT NULL,
 user_id uuid NOT NULL,
 name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
 query jsonb NOT NULL CHECK (pg_column_size(query) <= 8192),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (tenant_id, user_id, name),
 FOREIGN KEY (tenant_id, user_id) REFERENCES memberships(tenant_id, user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_preferences (
 tenant_id text NOT NULL,
 user_id uuid NOT NULL,
 preferences jsonb NOT NULL DEFAULT '{}' CHECK (pg_column_size(preferences) <= 8192),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id, user_id),
 FOREIGN KEY (tenant_id, user_id) REFERENCES memberships(tenant_id, user_id) ON DELETE CASCADE
);

-- Tenant boundary on every table above; owner-only rows additionally require app.user.
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['workspaces','work_items','work_item_events','tags','work_item_tags','comments','attachments'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  EXECUTE format('DROP POLICY IF EXISTS tenant_boundary ON %I', t);
  EXECUTE format('CREATE POLICY tenant_boundary ON %I USING (tenant_id = app_tenant()) WITH CHECK (tenant_id = app_tenant())', t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['saved_views','user_preferences'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  EXECUTE format('DROP POLICY IF EXISTS owner_boundary ON %I', t);
  EXECUTE format('CREATE POLICY owner_boundary ON %I USING (tenant_id = app_tenant() AND user_id = app_user()) WITH CHECK (tenant_id = app_tenant() AND user_id = app_user())', t);
 END LOOP;
END $$;
ALTER TABLE memory_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_entries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS memory_read ON memory_entries;
DROP POLICY IF EXISTS memory_write ON memory_entries;
CREATE POLICY memory_read ON memory_entries FOR SELECT
 USING (tenant_id = app_tenant() AND (user_id = app_user() OR visibility <> 'private'));
CREATE POLICY memory_write ON memory_entries FOR ALL
 USING (tenant_id = app_tenant() AND user_id = app_user())
 WITH CHECK (tenant_id = app_tenant() AND user_id = app_user());

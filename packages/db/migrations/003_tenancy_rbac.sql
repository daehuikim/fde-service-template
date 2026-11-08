-- 003 tenancy and RBAC: tenants, memberships, permissions, roles. Tenant tables use RLS on app.tenant.
CREATE TABLE IF NOT EXISTS tenants (
 id text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{1,64}$'),
 name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
 tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id, user_id)
);
CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships (user_id);
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_boundary ON memberships;
-- A user may always read their own memberships (needed to pick a tenant before app.tenant is set).
CREATE POLICY tenant_boundary ON memberships USING (tenant_id = app_tenant() OR user_id = app_user()) WITH CHECK (tenant_id = app_tenant());

CREATE TABLE IF NOT EXISTS permissions (
 key text PRIMARY KEY CHECK (key ~ '^[a-z_]+:[a-z_]+$'),
 description text NOT NULL
);

-- tenant_id NULL = system role shared by every tenant; tenant roles are custom and tenant-owned.
CREATE TABLE IF NOT EXISTS roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id text REFERENCES tenants(id) ON DELETE CASCADE,
 key text NOT NULL CHECK (key ~ '^[a-z_]{2,40}$'),
 name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
 UNIQUE NULLS NOT DISTINCT (tenant_id, key)
);
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_boundary ON roles;
CREATE POLICY tenant_boundary ON roles
 USING (tenant_id IS NULL OR tenant_id = app_tenant())
 WITH CHECK (tenant_id = app_tenant() OR (tenant_id IS NULL AND app_tenant() IS NULL));

CREATE TABLE IF NOT EXISTS role_permissions (
 role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
 permission_key text NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
 PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE IF NOT EXISTS membership_roles (
 tenant_id text NOT NULL,
 user_id uuid NOT NULL,
 role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
 granted_by uuid REFERENCES users(id) ON DELETE SET NULL,
 granted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id, user_id, role_id),
 FOREIGN KEY (tenant_id, user_id) REFERENCES memberships(tenant_id, user_id) ON DELETE CASCADE
);
ALTER TABLE membership_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_roles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_boundary ON membership_roles;
CREATE POLICY tenant_boundary ON membership_roles USING (tenant_id = app_tenant() OR user_id = app_user()) WITH CHECK (tenant_id = app_tenant());

-- A tenant may only grant its own roles or system roles.
CREATE OR REPLACE FUNCTION assert_role_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
 DECLARE owner text;
 BEGIN
  SELECT tenant_id INTO owner FROM roles WHERE id = NEW.role_id;
  -- Under RLS another tenant's role is simply invisible: treat "not found" as a mismatch too.
  IF NOT FOUND OR (owner IS NOT NULL AND owner <> NEW.tenant_id) THEN RAISE EXCEPTION 'role_tenant_mismatch' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
 END $$;
DROP TRIGGER IF EXISTS membership_roles_tenant ON membership_roles;
CREATE TRIGGER membership_roles_tenant BEFORE INSERT OR UPDATE ON membership_roles FOR EACH ROW EXECUTE FUNCTION assert_role_tenant();

CREATE TABLE IF NOT EXISTS invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 email text NOT NULL CHECK (email = lower(email)),
 role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
 invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 accepted_at timestamptz
);
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_boundary ON invitations;
CREATE POLICY tenant_boundary ON invitations USING (tenant_id = app_tenant()) WITH CHECK (tenant_id = app_tenant());

-- Effective permissions for the current (tenant, user) context; used by the app once per request.
CREATE OR REPLACE FUNCTION effective_permissions(p_tenant text, p_user uuid) RETURNS SETOF text LANGUAGE sql STABLE AS $$
 SELECT DISTINCT rp.permission_key
 FROM membership_roles mr
 JOIN memberships m ON m.tenant_id = mr.tenant_id AND m.user_id = mr.user_id AND m.status = 'active'
 JOIN role_permissions rp ON rp.role_id = mr.role_id
 WHERE mr.tenant_id = p_tenant AND mr.user_id = p_user
$$;

INSERT INTO permissions (key, description) VALUES
 ('tenant:read', 'Read tenant profile and settings'),
 ('tenant:manage', 'Change tenant settings, roles and billing'),
 ('member:read', 'List members'),
 ('member:invite', 'Invite members'),
 ('member:manage', 'Change member roles or suspend members'),
 ('role:manage', 'Create or edit custom tenant roles'),
 ('api_key:manage', 'Create and revoke API keys'),
 ('workspace:read', 'Read workspaces'),
 ('workspace:manage', 'Create, rename or archive workspaces'),
 ('work_item:read', 'Read work items'),
 ('work_item:create', 'Create work items'),
 ('work_item:update', 'Edit work items'),
 ('work_item:delete', 'Soft-delete work items'),
 ('comment:create', 'Comment on work items'),
 ('memory:read_shared', 'Read workspace/tenant-visible memory entries'),
 ('memory:write_shared', 'Write workspace/tenant-visible memory entries'),
 ('run:read', 'Read validation runs'),
 ('run:create', 'Save validation runs'),
 ('audit:read', 'Read the audit log')
ON CONFLICT (key) DO NOTHING;

INSERT INTO roles (tenant_id, key, name) VALUES
 (NULL, 'owner', 'Owner'), (NULL, 'admin', 'Admin'), (NULL, 'member', 'Member'), (NULL, 'viewer', 'Viewer')
ON CONFLICT (tenant_id, key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.key FROM roles r CROSS JOIN permissions p
WHERE r.tenant_id IS NULL AND (
 r.key = 'owner'
 OR (r.key = 'admin' AND p.key NOT IN ('tenant:manage'))
 OR (r.key = 'member' AND p.key IN ('tenant:read','member:read','workspace:read','work_item:read','work_item:create','work_item:update','comment:create','memory:read_shared','memory:write_shared','run:read','run:create'))
 OR (r.key = 'viewer' AND p.key IN ('tenant:read','member:read','workspace:read','work_item:read','memory:read_shared','run:read'))
)
ON CONFLICT DO NOTHING;

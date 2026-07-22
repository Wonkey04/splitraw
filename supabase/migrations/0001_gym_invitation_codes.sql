-- Run this in the Supabase SQL editor for this project (no CLI/migration
-- runner is wired up yet, so it isn't applied automatically).

CREATE TABLE gym_invitation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  deleted_at TIMESTAMP NULL
);

CREATE INDEX gym_invitation_codes_org_id ON gym_invitation_codes(organization_id);

-- Auto-generar codigo para gyms existentes que todavia no tengan uno.
INSERT INTO gym_invitation_codes (organization_id, code)
SELECT id,
       SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' FROM (floor(random()*36)+1)::int FOR 1) ||
       SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' FROM (floor(random()*36)+1)::int FOR 1) ||
       SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' FROM (floor(random()*36)+1)::int FOR 1) ||
       SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' FROM (floor(random()*36)+1)::int FOR 1) ||
       SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' FROM (floor(random()*36)+1)::int FOR 1) ||
       SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' FROM (floor(random()*36)+1)::int FOR 1)
FROM organizations
WHERE id NOT IN (SELECT organization_id FROM gym_invitation_codes);

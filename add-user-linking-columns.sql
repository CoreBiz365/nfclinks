-- =========================================
-- Add User Linking Columns to Database
-- =========================================
-- This script adds the required columns for user-BizTag linking

BEGIN;

-- =========================================
-- 1. Add user linking columns to nfc_tags
-- =========================================

-- Add user_id column (owner of the BizTag)
ALTER TABLE app.nfc_tags 
ADD COLUMN user_id UUID NULL;

-- Add created_by column (who configured the BizTag)
ALTER TABLE app.nfc_tags 
ADD COLUMN created_by UUID NULL;

-- =========================================
-- 2. Add organization linking to users
-- =========================================

-- Add organization_id column to users table
ALTER TABLE app.users 
ADD COLUMN organization_id UUID NULL;

-- =========================================
-- 3. Create indexes for performance
-- =========================================

-- Index for user_id lookups
CREATE INDEX idx_nfc_tags_user_id ON app.nfc_tags(user_id);

-- Index for created_by lookups  
CREATE INDEX idx_nfc_tags_created_by ON app.nfc_tags(created_by);

-- Index for organization lookups
CREATE INDEX idx_users_organization_id ON app.users(organization_id);

-- =========================================
-- 4. Add foreign key constraints
-- =========================================

-- Foreign key: nfc_tags.user_id → users.id
ALTER TABLE app.nfc_tags
ADD CONSTRAINT fk_nfc_tags_user
FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE SET NULL;

-- Foreign key: nfc_tags.created_by → users.id  
ALTER TABLE app.nfc_tags
ADD CONSTRAINT fk_nfc_tags_created_by
FOREIGN KEY (created_by) REFERENCES app.users(id) ON DELETE SET NULL;

-- Foreign key: users.organization_id → organizations.id
ALTER TABLE app.users
ADD CONSTRAINT fk_users_organization
FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE SET NULL;

COMMIT;

-- =========================================
-- Verification Queries
-- =========================================

-- Check if columns were added successfully
SELECT 
  'nfc_tags' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'app' 
  AND table_name = 'nfc_tags'
  AND column_name IN ('user_id', 'created_by')
ORDER BY column_name;

SELECT 
  'users' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'app' 
  AND table_name = 'users'
  AND column_name = 'organization_id';

-- Check if foreign keys were created
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'app'
  AND (tc.table_name = 'nfc_tags' OR tc.table_name = 'users')
ORDER BY tc.table_name, tc.constraint_name;

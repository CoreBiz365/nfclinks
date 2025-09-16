-- =========================================
-- Safe Add Columns Script
-- This script safely adds columns only if they don't exist
-- =========================================

-- Check current state first
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

-- =========================================
-- Add columns only if they don't exist
-- =========================================

-- Add user_id to nfc_tags (only if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'app' 
          AND table_name = 'nfc_tags' 
          AND column_name = 'user_id'
    ) THEN
        ALTER TABLE app.nfc_tags ADD COLUMN user_id UUID NULL;
        RAISE NOTICE 'Added user_id column to nfc_tags';
    ELSE
        RAISE NOTICE 'user_id column already exists in nfc_tags';
    END IF;
END $$;

-- Add created_by to nfc_tags (only if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'app' 
          AND table_name = 'nfc_tags' 
          AND column_name = 'created_by'
    ) THEN
        ALTER TABLE app.nfc_tags ADD COLUMN created_by UUID NULL;
        RAISE NOTICE 'Added created_by column to nfc_tags';
    ELSE
        RAISE NOTICE 'created_by column already exists in nfc_tags';
    END IF;
END $$;

-- Add organization_id to users (only if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'app' 
          AND table_name = 'users' 
          AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE app.users ADD COLUMN organization_id UUID NULL;
        RAISE NOTICE 'Added organization_id column to users';
    ELSE
        RAISE NOTICE 'organization_id column already exists in users';
    END IF;
END $$;

-- =========================================
-- Add indexes (only if they don't exist)
-- =========================================

-- Index for user_id
CREATE INDEX IF NOT EXISTS idx_nfc_tags_user_id ON app.nfc_tags(user_id);

-- Index for created_by
CREATE INDEX IF NOT EXISTS idx_nfc_tags_created_by ON app.nfc_tags(created_by);

-- Index for organization_id
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON app.users(organization_id);

-- =========================================
-- Add foreign key constraints (only if they don't exist)
-- =========================================

-- Foreign key: nfc_tags.user_id → users.id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'app' 
          AND table_name = 'nfc_tags' 
          AND constraint_name = 'fk_nfc_tags_user'
    ) THEN
        ALTER TABLE app.nfc_tags
        ADD CONSTRAINT fk_nfc_tags_user
        FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added fk_nfc_tags_user constraint';
    ELSE
        RAISE NOTICE 'fk_nfc_tags_user constraint already exists';
    END IF;
END $$;

-- Foreign key: nfc_tags.created_by → users.id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'app' 
          AND table_name = 'nfc_tags' 
          AND constraint_name = 'fk_nfc_tags_created_by'
    ) THEN
        ALTER TABLE app.nfc_tags
        ADD CONSTRAINT fk_nfc_tags_created_by
        FOREIGN KEY (created_by) REFERENCES app.users(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added fk_nfc_tags_created_by constraint';
    ELSE
        RAISE NOTICE 'fk_nfc_tags_created_by constraint already exists';
    END IF;
END $$;

-- Foreign key: users.organization_id → organizations.id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'app' 
          AND table_name = 'users' 
          AND constraint_name = 'fk_users_organization'
    ) THEN
        ALTER TABLE app.users
        ADD CONSTRAINT fk_users_organization
        FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added fk_users_organization constraint';
    ELSE
        RAISE NOTICE 'fk_users_organization constraint already exists';
    END IF;
END $$;

-- =========================================
-- Final verification
-- =========================================

-- Check final state
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

-- Check constraints
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

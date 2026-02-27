-- Fix RLS if not working properly

-- 1. Make sure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies (if any)
DROP POLICY IF EXISTS "users_view_own_salary" ON profiles;
DROP POLICY IF EXISTS "users_update_own_salary" ON profiles;
DROP POLICY IF EXISTS "service_role_full_access" ON profiles;

-- 3. Create proper RLS policies
CREATE POLICY "users_view_own_profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "users_insert_own_profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "service_role_full_access" ON profiles
  FOR ALL USING (auth.role() = 'service_role');

-- 4. Test the policies
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE tablename = 'profiles';

SELECT 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'profiles';

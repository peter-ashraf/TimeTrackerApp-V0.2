-- Test RLS by simulating different users

-- 1. First, get a real user ID from your profiles table
SELECT id, full_name, username FROM profiles LIMIT 5;

-- 2. Test as a specific user (replace USER_ID with an actual ID)
-- Run this with the role set to 'authenticated'
SET LOCAL ROLE authenticated;
-- Or use: SET SESSION AUTHORIZATION 'USER_ID';

-- 3. Try to view all profiles (should only return your own row)
SELECT id, full_name, salary FROM profiles;

-- 4. Try to view another user's salary (should return empty or error)
SELECT id, full_name, salary FROM profiles WHERE id != 'USER_ID';

-- 5. Test updating your own salary (should work)
UPDATE profiles 
SET salary = 50000 
WHERE id = 'USER_ID';

-- 6. Test updating another user's salary (should fail)
UPDATE profiles 
SET salary = 100000 
WHERE id = 'DIFFERENT_USER_ID';

-- 7. Reset role
RESET ROLE;

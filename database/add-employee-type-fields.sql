-- Add employee type fields to profiles table
-- This migration adds support for full-time and part-time employee configurations

-- Add employee type field
ALTER TABLE profiles 
ADD COLUMN employee_type TEXT DEFAULT 'full-time' CHECK (employee_type IN ('full-time', 'part-time'));

-- Add daily hours field
ALTER TABLE profiles 
ADD COLUMN daily_hours NUMERIC DEFAULT 9 CHECK (daily_hours >= 6 AND daily_hours <= 9);

-- Add monthly hours field
ALTER TABLE profiles 
ADD COLUMN monthly_hours NUMERIC DEFAULT 187 CHECK (monthly_hours > 0);

-- Add work days per week field
ALTER TABLE profiles 
ADD COLUMN work_days_per_week NUMERIC DEFAULT 5 CHECK (work_days_per_week >= 3 AND work_days_per_week <= 5);

-- Add indexes for better performance
CREATE INDEX idx_profiles_employee_type ON profiles(employee_type);
CREATE INDEX idx_profiles_daily_hours ON profiles(daily_hours);
CREATE INDEX idx_profiles_work_days_per_week ON profiles(work_days_per_week);

-- Add RLS policies for new fields (if needed)
-- Note: This assumes existing RLS policies on profiles table cover all columns
-- If you have column-specific policies, you may need to update them

-- Update existing records to ensure they have proper defaults
UPDATE profiles 
SET 
  employee_type = COALESCE(employee_type, 'full-time'),
  daily_hours = COALESCE(daily_hours, 9),
  monthly_hours = COALESCE(monthly_hours, 187),
  work_days_per_week = COALESCE(work_days_per_week, 5)
WHERE employee_type IS NULL 
   OR daily_hours IS NULL 
   OR monthly_hours IS NULL 
   OR work_days_per_week IS NULL;

-- Add comment to document the new fields
COMMENT ON COLUMN profiles.employee_type IS 'Employee type: full-time or part-time';
COMMENT ON COLUMN profiles.daily_hours IS 'Daily work hours: 9 for full-time, 6-9 for part-time';
COMMENT ON COLUMN profiles.monthly_hours IS 'Monthly work hours: 187 for full-time, calculated for part-time';
COMMENT ON COLUMN profiles.work_days_per_week IS 'Work days per week: 5 for full-time, 3-5 for part-time';

-- Enable Row Level Security on leave_settings table
ALTER TABLE public.leave_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to prevent conflicts
DROP POLICY IF EXISTS "Users can view their own leave settings" ON public.leave_settings;
DROP POLICY IF EXISTS "Users can insert their own leave settings" ON public.leave_settings;
DROP POLICY IF EXISTS "Users can update their own leave settings" ON public.leave_settings;
DROP POLICY IF EXISTS "Users can delete their own leave settings" ON public.leave_settings;

-- Create policy for Select (Users can view their own leave settings)
CREATE POLICY "Users can view their own leave settings" 
ON public.leave_settings 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Create policy for Insert (Users can insert their own leave settings)
CREATE POLICY "Users can insert their own leave settings" 
ON public.leave_settings 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create policy for Update (Users can update their own leave settings)
CREATE POLICY "Users can update their own leave settings" 
ON public.leave_settings 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create policy for Delete (Users can delete their own leave settings)
CREATE POLICY "Users can delete their own leave settings" 
ON public.leave_settings 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

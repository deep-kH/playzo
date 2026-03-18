-- Promote existing users to admin for development.
-- In production you would limit this to specific user IDs.
UPDATE public.profiles
SET role = 'admin'
WHERE role = 'viewer';

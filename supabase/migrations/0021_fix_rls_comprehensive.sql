-- Comprehensive RLS fix: ensure admin write access works for authenticated users.

-- 1. Redefine is_admin() with robust fallbacks
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  -- Check profiles table first
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_role = 'admin' THEN
    RETURN true;
  END IF;

  -- Fallback: check JWT claims
  IF coalesce(current_setting('request.jwt.claims', true)::json->>'role', '') = 'admin' THEN
    RETURN true;
  END IF;
  IF coalesce(current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role', '') = 'admin' THEN
    RETURN true;
  END IF;
  IF coalesce(current_setting('request.jwt.claims', true)::json->'user_metadata'->>'role', '') = 'admin' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 2. Ensure every existing auth user has a profile row marked admin
INSERT INTO public.profiles (id, email, role)
SELECT id, coalesce(email, ''), 'admin'
FROM auth.users
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- 3. Ensure ls_tournament_teams has admin write + public read policies
DROP POLICY IF EXISTS "Public Read" ON public.ls_tournament_teams;
CREATE POLICY "Public Read" ON public.ls_tournament_teams FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin Write" ON public.ls_tournament_teams;
CREATE POLICY "Admin Write" ON public.ls_tournament_teams
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

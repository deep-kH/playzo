-- 1. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ls_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ls_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ls_innings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ls_balls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ls_match_state ENABLE ROW LEVEL SECURITY;

-- 2. Create the Admin Check Function (if not already existing)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Public Read Access (Fixed Loop Syntax)
DO $$ 
DECLARE 
  t text;
BEGIN
  -- We use a single ARRAY[...] expression here to fix the syntax error
  FOR t IN SELECT unnest(ARRAY['teams', 'players', 'ls_tournaments', 'ls_matches', 'ls_innings', 'ls_balls', 'ls_match_state']) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Public Read" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Public Read" ON public.%I FOR SELECT USING (true);', t, t);
  END LOOP;
END $$;

-- 4. Admin-Only Write Access (Fixed Loop Syntax)
DO $$ 
DECLARE 
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['teams', 'players', 'ls_tournaments', 'ls_matches', 'ls_innings', 'ls_balls', 'ls_match_state']) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admin Write" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Admin Write" ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());', t, t);
  END LOOP;
END $$;
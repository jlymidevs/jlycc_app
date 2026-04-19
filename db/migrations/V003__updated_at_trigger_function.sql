-- Generic trigger to maintain an updated_at column on row UPDATE.
-- Usage:
--   CREATE TRIGGER trg_<table>_updated_at
--     BEFORE UPDATE ON <schema>.<table>
--     FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
  'BEFORE UPDATE trigger that sets NEW.updated_at = now() on every row update.';

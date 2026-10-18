ALTER TABLE public.fixtures
  ADD COLUMN IF NOT EXISTS lineup_status text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fixtures_lineup_status_check'
      AND conrelid = 'public.fixtures'::regclass
  ) THEN
    ALTER TABLE public.fixtures
      ADD CONSTRAINT fixtures_lineup_status_check
      CHECK (lineup_status IS NULL OR lineup_status IN ('confirmed', 'predicted', 'unavailable'));
  END IF;
END $$;

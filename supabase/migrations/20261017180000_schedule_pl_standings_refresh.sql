-- Keep the current Premier League table fresh without running the full Arsenal enrichment sync.
-- The Edge Function standings_only mode fetches BSD events and republishes the validated 20-club table.
DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'nl4-pl-standings-refresh'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'nl4-pl-standings-refresh',
    '30 * * * *',
    $command$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'nl4_project_url') || '/functions/v1/sync-football-data',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'nl4_legacy_anon_jwt'),
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'nl4_legacy_anon_jwt'),
          'x-nl4-sync-token', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'NL4_SYNC_TOKEN')
        ),
        body := jsonb_build_object('standings_only', true, 'source', 'cron-pl-standings'),
        timeout_milliseconds := 30000
      ) AS request_id;
    $command$
  );
END $$;

-- CAST // SIGNAL: enable administrator-only, guarded Storage API deletion.
-- This SQL creates policies only. It does NOT delete any files.
-- Run once in Supabase SQL Editor after testing the RESOURCE MONITOR.
DO $$
DECLARE
  b text;
  read_policy text;
  delete_policy text;
  admin_condition text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND cmd IN ('DELETE','ALL')
  ) THEN
    RAISE EXCEPTION '既存の削除権限があるため中止します。権限を確認してください';
  END IF;

  FOREACH b IN ARRAY ARRAY['cast-public-media','cast-private-media']
  LOOP
    read_policy := CASE b
      WHEN 'cast-public-media' THEN 'cast_admin_read_published_media'
      ELSE 'cast_admin_read_private_media'
    END;
    delete_policy := CASE b
      WHEN 'cast-public-media' THEN 'cast_admin_delete_unreferenced_public'
      ELSE 'cast_admin_delete_unreferenced_private'
    END;

    SELECT qual INTO admin_condition
    FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname=read_policy
      AND cmd='SELECT'
      AND roles=ARRAY['authenticated']::name[];

    IF admin_condition IS NULL THEN
      RAISE EXCEPTION '管理者の読み取り権限が見つかりません: %', b;
    END IF;

    EXECUTE format($policy$
      CREATE POLICY %I ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = %L
        AND (%s)
        AND name ~* '^published/(audio-[0-9a-f-]{36}[.]mp3|[0-9]+-[0-9a-f-]{36}[.](webp|png|jpg|jpeg|gif))$'
        AND created_at <= now() - interval '10 minutes'
        AND (
          SELECT count(DISTINCT d.kind)
          FROM public.cast_documents d
          WHERE d.kind IN ('draft','published')
            AND d.payload IS NOT NULL
            AND d.payload::jsonb->>'version' = '5'
        ) = 2
        AND NOT EXISTS (
          SELECT 1 FROM public.cast_documents d
          WHERE d.kind IN ('draft','published')
            AND position(
              lower(split_part(storage.objects.name, '/', 2))
              IN lower(d.payload::text)
            ) > 0
        )
      )
    $policy$, delete_policy, b, admin_condition);
  END LOOP;
END $$;

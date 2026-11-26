-- CAST // SIGNAL / SIGNAL REPORT 01
-- Run once in Supabase SQL Editor. Does not change characters, media or existing policies.
BEGIN;
CREATE SCHEMA IF NOT EXISTS cast_analytics_private;
REVOKE ALL ON SCHEMA cast_analytics_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA cast_analytics_private TO anon;

CREATE TABLE IF NOT EXISTS public.cast_signal_daily (
  day date NOT NULL,
  event text NOT NULL CHECK (event IN ('visit','page','referrer','device','select','profile','world','sound','sound_auto','sound_30','sound_complete','lyrics','zeta_char','zeta_world','zeta_site')),
  target text NOT NULL CHECK (length(target) BETWEEN 1 AND 100),
  count bigint NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (day,event,target)
);
ALTER TABLE public.cast_signal_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cast_signal_daily FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.cast_signal_daily TO authenticated;
DROP POLICY IF EXISTS cast_signal_admin_read ON public.cast_signal_daily;
CREATE POLICY cast_signal_admin_read ON public.cast_signal_daily
 FOR SELECT TO authenticated USING (
   EXISTS (SELECT 1 FROM public.cast_documents d WHERE d.kind='draft' AND d.payload IS NOT NULL)
 );

-- Only the bounded ingestion function has write access. No visitor IDs, IPs,
-- user agents, referrer URLs or raw events are persisted by this feature.
CREATE OR REPLACE FUNCTION cast_analytics_private.ingest(events jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  doc jsonb;
  today date := (pg_catalog.now() AT TIME ZONE 'Asia/Tokyo')::date;
  item jsonb;
  e text;
  t text;
  seen text[] := ARRAY[]::text[];
BEGIN
  IF pg_catalog.jsonb_typeof(events) IS DISTINCT FROM 'array' THEN RETURN; END IF;
  IF pg_catalog.jsonb_array_length(events) NOT BETWEEN 1 AND 20 OR pg_catalog.octet_length(events::text)>7000 THEN RETURN; END IF;
  SELECT d.payload::jsonb INTO doc FROM public.cast_documents d WHERE d.kind='published';
  IF doc IS NULL OR doc->>'version' IS DISTINCT FROM '5' THEN RETURN; END IF;
  FOR item IN SELECT value FROM pg_catalog.jsonb_array_elements(events) LOOP
    e := item->>'event'; t := item->>'target';
    IF e IS NULL OR t IS NULL OR t !~ '^[A-Za-z0-9_.-]{1,100}$' OR (e||':'||t)=ANY(seen) THEN CONTINUE; END IF;
    IF e='visit' THEN
      IF t<>'site' THEN CONTINUE; END IF;
    ELSIF e='page' THEN
      IF t NOT IN ('select','index','profile','worlds','world','about') THEN CONTINUE; END IF;
    ELSIF e='referrer' THEN
      IF t NOT IN ('direct','x','zeta','search','other','internal') THEN CONTINUE; END IF;
    ELSIF e='device' THEN
      IF t NOT IN ('mobile','tablet','desktop') THEN CONTINUE; END IF;
    ELSIF e='zeta_site' THEN
      IF t<>'site' THEN CONTINUE; END IF;
    ELSIF e IN ('world','zeta_world') THEN
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(COALESCE(doc->'worlds','[]'::jsonb)) w WHERE w->>'id'=t AND w->>'published' IS DISTINCT FROM 'false') THEN CONTINUE; END IF;
    ELSIF e IN ('select','profile','zeta_char') THEN
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(COALESCE(doc->'characters','[]'::jsonb)) c WHERE c->>'id'=t AND c->>'published' IS DISTINCT FROM 'false') THEN CONTINUE; END IF;
    ELSIF e IN ('sound','sound_auto','sound_30','sound_complete','lyrics') THEN
      IF e='sound_auto' AND t<>'main' THEN CONTINUE; END IF;
      IF t='main' THEN
        IF COALESCE(doc->'site'->'soundtrack'->>'src','')='' THEN CONTINUE; END IF;
      ELSIF NOT EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(COALESCE(doc->'characters','[]'::jsonb)) c WHERE c->>'id'=t AND c->>'published' IS DISTINCT FROM 'false' AND COALESCE(c->'soundtrack'->>'src','')<>'') THEN CONTINUE; END IF;
    ELSE CONTINUE;
    END IF;
    seen := pg_catalog.array_append(seen,e||':'||t);
    INSERT INTO public.cast_signal_daily AS a(day,event,target,count)
      VALUES(today,e,t,1)
      ON CONFLICT(day,event,target) DO UPDATE SET count=a.count+1;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION cast_analytics_private.ingest(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION cast_analytics_private.ingest(jsonb) TO anon;

-- The API wrapper is SECURITY INVOKER; the elevated helper is in a non-exposed schema.
CREATE OR REPLACE FUNCTION public.cast_signal_record(events jsonb)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT cast_analytics_private.ingest(events);
$$;
REVOKE ALL ON FUNCTION public.cast_signal_record(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cast_signal_record(jsonb) TO anon;

CREATE OR REPLACE FUNCTION public.cast_signal_report()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('day',day,'event',event,'target',target,'count',count) ORDER BY day,event,target),'[]'::jsonb)
 FROM public.cast_signal_daily
 WHERE day >= (pg_catalog.now() AT TIME ZONE 'Asia/Tokyo')::date - 179;
$$;
REVOKE ALL ON FUNCTION public.cast_signal_report() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cast_signal_report() TO authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';

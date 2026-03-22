-- Harden search_users against wildcard enumeration and abuse
-- Date: 2026-03-22

create or replace function public.search_users(p_query text)
returns table (
  id uuid,
  name text,
  email text,
  image text,
  last_seen timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_query text;
  v_safe_query text;
begin
  v_query := left(trim(coalesce(p_query, '')), 100);

  if length(v_query) < 2 then
    return;
  end if;

  -- Block empty/wildcard-only probes like '%%' or '__'
  if regexp_replace(v_query, '[%_\s]', '', 'g') = '' then
    return;
  end if;

  -- Per-user search throttling (60 requests / minute)
  perform public.check_action_limit('users_search', 60, 60);

  -- Escape wildcard characters to force literal matching
  v_safe_query := replace(replace(replace(v_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');

  return query
  select
    u.id,
    u.name,
    u.email,
    u.image,
    u.last_seen
  from public.users u
  where
    u.id <> auth.uid()
    and u.email ilike '%' || v_safe_query || '%' escape '\\'
  order by u.email
  limit 10;
end;
$function$;

grant execute on function public.search_users(text) to authenticated;

-- Add public registration and profile APIs to the existing SC FIFA database.

do $$
begin
  if to_regclass('public.admins') is null
    or to_regclass('public.gamers') is null
    or to_regclass('public.registrations') is null
    or to_regclass('public.game_categories') is null
    or to_regclass('public.tournaments') is null then
    raise exception 'SC FIFA migration requires the existing organizer and tournament tables';
  end if;
end;
$$;

-- Extra fields needed for the public registration form.
alter table public.gamers add column if not exists gamer_tag text;
alter table public.gamers add column if not exists country text;
alter table public.registrations add column if not exists status text default 'pending';
alter table public.registrations add column if not exists payment_reference text;
alter table public.game_categories add column if not exists image_url text;
alter table public.tournaments add column if not exists image_url text;
alter table public.tournaments add column if not exists registration_open boolean not null default true;

-- Public-safe catalog. Views deliberately exclude private administrative fields.
create or replace view public.sc_public_categories as
select id, name, image_url from public.game_categories;
create or replace view public.sc_public_tournaments as
select id, title, category_id, tournament_date, venue, registration_fee, prize_pool, image_url, registration_open
from public.tournaments;

-- Public profiles only for approved registrations. No payment references exposed.
create or replace view public.sc_public_profiles as
select r.id as registration_id, g.id as gamer_id, g.gamer_name, g.gamer_tag,
       g.country, g.photo_url, r.tournament_id
from public.registrations r
join public.gamers g on g.id = r.gamer_id
where r.status = 'approved';

-- Public registration RPC: creates gamer + pending registration atomically.
-- SECURITY DEFINER is restricted to only the exact actions below.
create or replace function public.sc_submit_registration(
  p_name text, p_tag text, p_country text, p_tournament_id uuid,
  p_payment_reference text default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_gamer uuid; v_registration uuid;
begin
  if length(btrim(coalesce(p_name,''))) not between 1 and 60
    or length(btrim(coalesce(p_tag,''))) not between 1 and 40
    or length(btrim(coalesce(p_country,''))) not between 1 and 60
    or length(coalesce(p_payment_reference,'')) > 60 then
    raise exception 'Invalid registration fields';
  end if;
  perform 1 from public.tournaments
  where id = p_tournament_id and registration_open
  for share;
  if not found then
    raise exception 'Registration is closed or the tournament is unavailable';
  end if;
  -- Bound anonymous writes across concurrent submissions.
  perform pg_catalog.pg_advisory_xact_lock(84117073);
  if (select count(*) from public.registrations where created_at >= now() - interval '1 minute') >= 30 then
    raise exception 'Registration is busy. Please try again in a minute';
  end if;
  insert into public.gamers(gamer_name,gamer_tag,country)
  values (btrim(p_name),btrim(p_tag),btrim(p_country)) returning id into v_gamer;
  insert into public.registrations(tournament_id,gamer_id,payment_reference,status)
  values (p_tournament_id,v_gamer,nullif(btrim(p_payment_reference),''),'pending')
  returning id into v_registration;
  return v_registration;
end;
$$;

revoke all on function public.sc_submit_registration(text,text,text,uuid,text)
  from public, anon, authenticated;
grant execute on function public.sc_submit_registration(text,text,text,uuid,text) to anon, authenticated;

-- Keep the existing organizer policies and results workflow.
grant select (user_id) on public.admins to authenticated;
revoke all on public.registrations, public.gamers from public, anon;
revoke all on public.tournaments from public, anon;
grant select on public.registrations, public.gamers, public.game_categories, public.tournaments to authenticated;

grant update (status, payment_status) on public.registrations to authenticated;
grant insert (name, image_url) on public.game_categories to authenticated;
grant insert (title, category_id, tournament_date, venue, registration_fee, prize_pool, image_url),
  update (title, category_id, tournament_date, venue, registration_fee, prize_pool, image_url, registration_open)
  on public.tournaments to authenticated;

revoke all on public.sc_public_categories, public.sc_public_tournaments, public.sc_public_profiles
  from public, anon, authenticated;
grant select on public.sc_public_categories, public.sc_public_tournaments, public.sc_public_profiles
  to anon, authenticated;


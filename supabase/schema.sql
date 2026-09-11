-- Centex Walkaround — cloud schema. Run this first, then schema-002-sync.sql.
-- Safe to re-run: tables use IF NOT EXISTS and every policy is dropped before it is created.
-- Tables are prefixed wa_ so this can live in the same Supabase project as Fleet Ops.
-- Every row carries org_id; RLS checks the server-set JWT claim app_metadata.org_id,
-- never user_metadata (which users can edit).

create extension if not exists pgcrypto;

create or replace function wa_org_id() returns text
language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'org_id', '')
$$;
create or replace function wa_is_owner() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'wa_role', 'staff') = 'owner'
$$;

create table if not exists wa_layouts (
  id          text primary key,
  org_id      text not null default wa_org_id(),
  name        text not null,
  interior    jsonb not null default '[]'::jsonb,   -- [{id,name,short,tip,x,y,w,h}]
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists wa_units (
  id          text primary key,
  org_id      text not null default wa_org_id(),
  name        text not null,
  year        text, make text, model text, length text, plate text,
  status      text not null default 'available' check (status in ('available','out','attention','maintenance')),
  layout_id   text references wa_layouts(id) on delete set null,   -- null = built-in Standard
  crm_unit_id text,                                                -- optional link to Fleet Ops camper
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists wa_inspections (
  id            text primary key,
  org_id        text not null default wa_org_id(),
  unit_id       text not null references wa_units(id) on delete cascade,
  type          text not null check (type in ('departure','return')),
  status        text not null check (status in ('in_progress','review','complete')),
  baseline_id   text references wa_inspections(id) on delete set null,
  return_id     text,
  renter        text, booking text,
  started_at    timestamptz not null,
  completed_at  timestamptz,
  layout        jsonb,          -- snapshot of the layout the inspection was shot with
  signoff       jsonb,          -- {name, at, sig_path}
  shot_by       uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists wa_photos (
  id           text primary key,
  org_id       text not null default wa_org_id(),
  unit_id      text not null references wa_units(id) on delete cascade,
  inspection_id text references wa_inspections(id) on delete cascade,
  zone_id      text not null,
  storage_path text not null,   -- walkaround-photos/<org>/<unit>/<inspection>/<zone>.jpg
  width int, height int, bytes int,
  taken_at     timestamptz not null,
  created_at   timestamptz not null default now()
);

create table if not exists wa_inspection_zones (
  inspection_id text not null references wa_inspections(id) on delete cascade,
  zone_id       text not null,
  photo_id      text references wa_photos(id) on delete set null,
  skipped       boolean not null default false,
  taken_at      timestamptz,
  analysis      jsonb,          -- {status, score, note, summary, at, error}
  primary key (inspection_id, zone_id)
);

create table if not exists wa_findings (
  id            text primary key,
  org_id        text not null default wa_org_id(),
  inspection_id text not null references wa_inspections(id) on delete cascade,
  zone_id       text not null,
  title text not null, description text, location_text text,
  x numeric, y numeric,
  severity      text not null check (severity in ('minor','moderate','major')),
  confidence    numeric,
  ai_type       text check (ai_type in ('new','matches_known','uncertain')),
  known_code    text,
  source        text not null check (source in ('ai','manual')),
  ruling        text check (ruling in ('new','preexisting','dismissed')),
  ruled_by      uuid references auth.users(id),
  ruled_at      timestamptz,
  registry_id   text,
  created_at    timestamptz not null default now()
);

create table if not exists wa_registry (
  id            text primary key,
  org_id        text not null default wa_org_id(),
  code          text not null,
  unit_id       text not null references wa_units(id) on delete cascade,
  zone_id       text not null,
  title text not null, description text, location_text text,
  x numeric, y numeric,
  severity      text not null check (severity in ('minor','moderate','major')),
  status        text not null default 'open' check (status in ('open','repaired')),
  origin        text not null check (origin in ('return_inspection','noted_preexisting','manual')),
  inspection_id text references wa_inspections(id) on delete set null,
  photo_id      text references wa_photos(id) on delete set null,
  renter        text, notes text, est_cost text,
  billed        boolean not null default false,
  found_at      timestamptz not null,
  repaired_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, code)
);

create index if not exists wa_inspections_unit_idx on wa_inspections (unit_id, started_at desc);
create index if not exists wa_registry_unit_zone_idx on wa_registry (unit_id, zone_id, status);
create index if not exists wa_photos_insp_idx on wa_photos (inspection_id);

-- Row-level security: org isolation for everyone; finalizing (writing wa_registry) is owner-only.
do $$ declare t text; begin
  foreach t in array array['wa_layouts','wa_units','wa_inspections','wa_photos','wa_inspection_zones','wa_findings','wa_registry'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

drop policy if exists wa_layouts_org on wa_layouts;
create policy wa_layouts_org on wa_layouts for all using (org_id = wa_org_id()) with check (org_id = wa_org_id());
drop policy if exists wa_units_org on wa_units;
create policy wa_units_org on wa_units for all using (org_id = wa_org_id()) with check (org_id = wa_org_id());
drop policy if exists wa_inspections_org on wa_inspections;
create policy wa_inspections_org on wa_inspections for all using (org_id = wa_org_id()) with check (org_id = wa_org_id());
drop policy if exists wa_photos_org on wa_photos;
create policy wa_photos_org on wa_photos for all using (org_id = wa_org_id()) with check (org_id = wa_org_id());
drop policy if exists wa_zones_org on wa_inspection_zones;
create policy wa_zones_org on wa_inspection_zones for all
  using (exists (select 1 from wa_inspections i where i.id = inspection_id and i.org_id = wa_org_id()))
  with check (exists (select 1 from wa_inspections i where i.id = inspection_id and i.org_id = wa_org_id()));
drop policy if exists wa_findings_org on wa_findings;
create policy wa_findings_org on wa_findings for all using (org_id = wa_org_id()) with check (org_id = wa_org_id());
drop policy if exists wa_registry_read on wa_registry;
create policy wa_registry_read on wa_registry for select using (org_id = wa_org_id());
drop policy if exists wa_registry_owner_write on wa_registry;
create policy wa_registry_owner_write on wa_registry for insert with check (org_id = wa_org_id() and wa_is_owner());
drop policy if exists wa_registry_owner_update on wa_registry;
create policy wa_registry_owner_update on wa_registry for update using (org_id = wa_org_id() and wa_is_owner());
drop policy if exists wa_registry_owner_delete on wa_registry;
create policy wa_registry_owner_delete on wa_registry for delete using (org_id = wa_org_id() and wa_is_owner());

-- Storage: one private bucket; paths start with the org id so policies can check the first folder.
insert into storage.buckets (id, name, public) values ('walkaround-photos', 'walkaround-photos', false)
  on conflict (id) do nothing;
drop policy if exists wa_photos_bucket_rw on storage.objects;
create policy wa_photos_bucket_rw on storage.objects for all
  using (bucket_id = 'walkaround-photos' and (storage.foldername(name))[1] = wa_org_id())
  with check (bucket_id = 'walkaround-photos' and (storage.foldername(name))[1] = wa_org_id());

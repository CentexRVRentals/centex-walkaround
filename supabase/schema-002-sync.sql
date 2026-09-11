-- Centex Walkaround — Phase 2 sync migration. Run once, after schema.sql.
-- Inspections become one document per row (zones/analysis/findings as jsonb) to match the
-- app's local model; the two normalized detail tables were never written to and are dropped.
-- Every synced table gets: updated_at (client clock, last-write-wins), synced_at (server
-- clock, pull cursor), deleted_at (soft delete), updated_by. The wa_touch trigger stamps
-- synced_at and silently drops updates that are older than the row it would overwrite.

alter table wa_inspections
  add column if not exists zones    jsonb not null default '{}'::jsonb,
  add column if not exists analysis jsonb not null default '{}'::jsonb,
  add column if not exists findings jsonb not null default '[]'::jsonb;

drop table if exists wa_findings;
drop table if exists wa_inspection_zones;

alter table wa_units add column if not exists crm_name text;
alter table wa_photos add column if not exists updated_at timestamptz not null default now();

-- Photo rows may arrive after the registry entry that references them; the link is by id only.
alter table wa_registry drop constraint if exists wa_registry_photo_id_fkey;
-- Codes are display labels; the app renumbers collisions on pull, so no hard uniqueness.
alter table wa_registry drop constraint if exists wa_registry_org_id_code_key;

create or replace function wa_touch() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at is not null and old.updated_at is not null and new.updated_at < old.updated_at then
    return null;              -- stale write: keep the newer row untouched
  end if;
  new.synced_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

do $$ declare t text; begin
  foreach t in array array['wa_layouts','wa_units','wa_inspections','wa_registry','wa_photos'] loop
    execute format('alter table %I add column if not exists synced_at timestamptz not null default now()', t);
    execute format('alter table %I add column if not exists deleted_at timestamptz', t);
    execute format('alter table %I add column if not exists updated_by uuid', t);
    execute format('drop trigger if exists wa_touch on %I', t);
    execute format('create trigger wa_touch before insert or update on %I for each row execute function wa_touch()', t);
    execute format('create index if not exists %I on %I (org_id, synced_at)', t || '_synced_idx', t);
  end loop;
end $$;

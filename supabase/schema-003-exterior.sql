-- Centex Walkaround — v1.2.0: layouts may customize the exterior walkaround too.
-- Run once, after schema-002-sync.sql. Null means "use the built-in exterior shots".
alter table wa_layouts add column if not exists exterior jsonb;   -- [{id,name,tip,group,x,y}]

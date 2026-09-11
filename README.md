# Centex Walkaround

Departure and return photo inspection for RV travel-trailer rental fleets. Staff shoot every zone at departure, shoot the same angles at return with the departure photo ghosted over the viewfinder, and Claude flags what changed. The owner rules on every finding; only confirmed findings enter the damage registry. Runs as an installable PWA and works offline; AI comparison runs through a signed-in Supabase Edge Function so no API key is ever in the app.

## Run it

```powershell
npm install
npm run dev          # http://localhost:5173
npm run preship      # syntax + lint + tests + production build (must pass before shipping)
```

Without a `.env.local` the app is a fully working **offline build**: photos and records save on the device (IndexedDB), backups and the photo archive work, AI comparison is off. Copy `.env.example` to `.env.local` and fill in the Supabase URL and anon key to enable sign-in and comparisons.

## Deploy

- **Web app:** Netlify, `npm run build`, publish `dist` (netlify.toml is included; git push auto-deploys).
- **Edge Functions:** `supabase functions deploy compare-zone` and `supabase functions deploy draft-notice` after `supabase secrets set ANTHROPIC_API_KEY=...` (optional `ANTHROPIC_MODEL`, default `claude-sonnet-5`).
- **Users:** create staff in Supabase Auth; set `app_metadata.org_id` (and `wa_role: "owner"` for whoever finalizes returns).
- **Phase 2 schema:** `supabase/schema.sql` — cloud sync between phones is not wired yet; the tables, RLS and storage bucket are ready for it.

## Layout

```
src/domain/     zones & layouts, inspection rules, findings/registry rules (pure, tested)
src/lib/        images, zip, backup, share, format, demo imagery
src/data/       IndexedDB records + photo store (ArrayBuffer, verified writes), Supabase client
src/ai/         client for the Edge Functions
src/ui/         theme, atoms, trailer map, camera, compare viewer, signature pad
src/screens/    fleet, unit, inspection, review, report, registry, design, settings, archive
supabase/       Edge Functions (Deno) + schema.sql + config.toml
tests/          Vitest: domain, lib, data, and a full end-to-end run of the app in jsdom
```

See HANDOVER.md for decisions, conventions and known gaps.

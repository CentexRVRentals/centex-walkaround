# HANDOVER — Centex Walkaround

Version: v1.2.0 · Repo: `C:\dev\centex-walkaround` · Stack: Vite + React 18 (PWA) · IndexedDB (idb) · Supabase Edge Functions (Deno) · Netlify

## 1. What this is

The production codebase for the Walkaround prototype piloted as a Claude artifact. Same flows, same design, rebuilt as a modular PWA with real on-device storage and a server-side AI call. Everything the prototype did works here; the artifact-sandbox workarounds (window.storage, blob-URL avoidance, keyless API) are gone.

## 2. Decisions made in this build (flagged for Jesse)

1. **Stack mirrors Fleet Ops** (Vite/React, Supabase, Netlify, PowerShell) so the two apps can share a Supabase project later. Tables are prefixed `wa_`; `wa_units.crm_unit_id` is reserved for linking to Fleet Ops campers.
2. **Local-first.** Records live in IndexedDB on the phone; photos are stored as ArrayBuffer + type (not Blob) because Safari has had Blob-in-IndexedDB bugs and buffers clone identically everywhere. Cloud sync is Phase 2; schema and RLS are written (`supabase/schema.sql`) but not wired.
3. **AI runs in Edge Functions** (`compare-zone`, `draft-notice`) behind Supabase Auth (`verify_jwt = true`). Default model `claude-sonnet-5`, overridable with the `ANTHROPIC_MODEL` secret. Prompt lives server-side.
4. **Sign-in is optional.** No cloud config → offline build; with cloud config, AI features require a signed-in staff account (Settings › Account). Photo capture never requires sign-in.
5. **Every photo write is verified** by reading it back; failures retry at stronger compression (1024 → 800 → 640 px) and finally surface a toast. Launch runs a storage self-test and requests persistent storage.
6. **Layouts are per unit; inspections snapshot their layout.** Editing or deleting a layout never changes a finished inspection's zones or photo file names.

### Phase 2 (v1.1.0) — cloud sync
7. **Pull-first, last-write-wins per record.** Every user edit passes through `stampChanges` (App's `setData`): the changed entity gets `updatedAt` and a dirty mark; deletions become tombstones. `runSync` pulls, then pushes dirty rows (`upsert`), then soft-deletes tombstones (`deleted_at`), then uploads photos, then pulls again. The server's `wa_touch` trigger drops any update older than the row it would overwrite, and `applyPulled` mirrors that locally.
8. **Inspections are one row each** (`zones`, `analysis`, `findings` as jsonb) to match the local document; the normalized `wa_inspection_zones` / `wa_findings` tables were dropped (`schema-002-sync.sql`). Reporting can query jsonb later.
9. **Photos upload once** to `walkaround-photos/<org>/<unit>/<photo>.jpg` with a `wa_photos` row; other phones download on first view (`photos.load` → `fetchRemote`). Photos are never deleted from the bucket by the app.
10. **Sample fleet never syncs** (`demo: true` on units/inspections/registry/photo meta; `planPush` also skips records whose unit is demo). Restore-replace is device-local: records are marked dirty to push, nothing is tombstoned, cursors reset so the full cloud state is pulled back. Reset erases this device only.
11. **Registry codes collide across offline phones**; the pull step renumbers the still-dirty local one (`applyPulled`), and the unique (org, code) constraint was dropped.
12. **Fleet Ops link** reads the CRM's `fleet` table (`select *`) and matches by `name`; other columns are guessed from common spellings (`FLEET_FIELDS`). Linked units carry `crmUnitId` (fleet `id` if present, else the name) and `crmName`.
13. Sync needs `app_metadata.org_id` on the user; without it the Settings card explains what to do instead of failing silently.

### v1.2.0 — editable exterior
14. **Layouts own their exterior list too.** A saved layout carries `exterior: [{id,name,tip,group,x,y}]` (group is one of the two exterior sections); `null`/absent means the built-in shots, so every existing layout and inspection snapshot keeps working. `zonesFromLayout` is the single source of a layout's zone order. Duplicating Standard copies the built-in shots with their ids, so registry history keeps matching by zone.
15. Exterior shots clamp to the whole map (`SHOT_BOUNDS`), rooms to the body (`INTERIOR_BOUNDS`). A layout must keep at least one zone; caps are 16 shots and 12 rooms.

## 3. Conventions

- `npm run preship` must pass before any ship: esbuild syntax → ESLint (no-undef, react/jsx-no-undef, hooks) → Vitest → Vite build.
- Bump `APP_VERSION` in `src/app/version.js` on every change; it shows in Settings.
- State is a single immutable snapshot; `persistDiff` writes only entities whose object reference changed. Never mutate an entity in place.
- Domain rules (`src/domain/*`) are pure and unit-tested; screens contain no business rules that aren't in domain.
- Edge Functions cannot import each other: shared code lives in `supabase/functions/_shared/`.
- RLS checks `app_metadata` (server-set), never `user_metadata`.

## 4. Bug patterns (numbered, keep adding)

- §4.1 fake-indexeddb structured-clones jsdom Blobs into plain objects → store ArrayBuffers (also the right call for Safari).
- §4.2 esbuild passes undefined identifiers as globals; only ESLint catches them, and only `eslint-plugin-react` catches undefined JSX tags.
- §4.3 A re-run comparison after a retake must wait for the new photo id to commit (`rerun` state + effect), or it compares the old photo.
- §4.4 Auto-advance must never wrap to the zone just shot (loop bound `k < order.length`).
- §4.5 `navigator.share` only works synchronously from a tap; backups are built first, then shared from a second tap.
- §4.6 Anything applied from the server must use `setDataRaw`, never `setData`: stamping server rows would mark them dirty and echo them back forever.
- §4.7 Push before pull would send a colliding registry code before the pull could renumber it; the cycle is pull → push → pull.
- §4.8 `persistDiff` op counts change whenever a meta key is added (settings, seq, sync, photoMeta); the db test pins the count on purpose.
- §4.9 Any clamp applied on every zone edit (including renames) must contain the built-in coordinates, or renaming a standard shot silently moves it (`SHOT_BOUNDS.y0` sits above the front hitch circle at y=7).

## 5. Tests

`tests/*.test.js` cover zones/layouts, inspection rules, findings/finalize, zip, backups, the IndexedDB layer, and sync (`tests/sync.test.js`: an in-memory Supabase double with the trigger semantics drives two simulated phones through round-trip, LWW conflict, delete propagation, code renumbering, photo upload/download, and the Fleet Ops import planner). `tests/app.e2e.test.jsx` drives the real App in jsdom with fake-indexeddb: demo → AI comparison (mocked transport, real normalization) → rulings → finalize → report → registry → capture fallback with a file → sign-off → design tab → backup → reset → restore, and asserts on-device persistence between steps. 38 tests.

## 9. Known gaps / next

- Sync is per-record LWW: two people editing the same inspection offline keep only the later save. Fine for a 3-phone yard; revisit if it bites.
- Photos are not deleted from the bucket when replaced or when a unit is deleted (history is kept; storage grows slowly).
- Fleet Ops link is one-way (import). Booking sync (renter/booking prefill on departure) is the next natural step now that `crm_unit_id` is populated.
- Auth UI is email/password only; add magic link once staff accounts exist.
- iOS live camera works in Safari and installed PWA; inside some in-app browsers it falls back to the camera app (by design).
- Renter self-inspection link, booking sync, live alignment meter, claim packet PDF: see the roadmap discussed in chat.

## Version history

| Version | Date | Notes |
| --- | --- | --- |
| 1.0.0 | 2026-09-11 | First codebase build from the prototype: PWA, IndexedDB, Edge Functions, schema, 25 tests |
| 1.1.0 | 2026-09-11 | Phase 2: cloud sync (pull-first LWW, soft deletes, photo upload/download), Fleet Ops import, `schema-002-sync.sql`, 37 tests |
| 1.2.0 | 2026-09-11 | Designer edits exterior shots too (move/add/rename/section, Room and Shot tools), `schema-003-exterior.sql`, 38 tests |

# HANDOVER — Centex Walkaround

Version: v1.0.0 · Repo: `C:\dev\centex-walkaround` · Stack: Vite + React 18 (PWA) · IndexedDB (idb) · Supabase Edge Functions (Deno) · Netlify

## 1. What this is

The production codebase for the Walkaround prototype piloted as a Claude artifact. Same flows, same design, rebuilt as a modular PWA with real on-device storage and a server-side AI call. Everything the prototype did works here; the artifact-sandbox workarounds (window.storage, blob-URL avoidance, keyless API) are gone.

## 2. Decisions made in this build (flagged for Jesse)

1. **Stack mirrors Fleet Ops** (Vite/React, Supabase, Netlify, PowerShell) so the two apps can share a Supabase project later. Tables are prefixed `wa_`; `wa_units.crm_unit_id` is reserved for linking to Fleet Ops campers.
2. **Local-first.** Records live in IndexedDB on the phone; photos are stored as ArrayBuffer + type (not Blob) because Safari has had Blob-in-IndexedDB bugs and buffers clone identically everywhere. Cloud sync is Phase 2; schema and RLS are written (`supabase/schema.sql`) but not wired.
3. **AI runs in Edge Functions** (`compare-zone`, `draft-notice`) behind Supabase Auth (`verify_jwt = true`). Default model `claude-sonnet-5`, overridable with the `ANTHROPIC_MODEL` secret. Prompt lives server-side.
4. **Sign-in is optional.** No cloud config → offline build; with cloud config, AI features require a signed-in staff account (Settings › Account). Photo capture never requires sign-in.
5. **Every photo write is verified** by reading it back; failures retry at stronger compression (1024 → 800 → 640 px) and finally surface a toast. Launch runs a storage self-test and requests persistent storage.
6. **Layouts are per unit; inspections snapshot their layout.** Editing or deleting a layout never changes a finished inspection's zones or photo file names.

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

## 5. Tests

`tests/*.test.js` cover zones/layouts, inspection rules, findings/finalize, zip, backups, and the IndexedDB layer. `tests/app.e2e.test.jsx` drives the real App in jsdom with fake-indexeddb: demo → AI comparison (mocked transport, real normalization) → rulings → finalize → report → registry → capture fallback with a file → sign-off → design tab → backup → reset → restore, and asserts on-device persistence between steps. 25 tests.

## 9. Known gaps / next

- Cloud sync (Phase 2): push/pull of records and photos to `wa_*` tables and the `walkaround-photos` bucket; multi-phone conflict rule (last write wins per entity is enough to start).
- Auth UI is email/password only; add magic link once staff accounts exist.
- iOS live camera works in Safari and installed PWA; inside some in-app browsers it falls back to the camera app (by design).
- Renter self-inspection link, booking sync, live alignment meter, claim packet PDF: see the roadmap discussed in chat.

## Version history

| Version | Date | Notes |
| --- | --- | --- |
| 1.0.0 | 2026-09-11 | First codebase build from the prototype: PWA, IndexedDB, Edge Functions, schema, 25 tests |

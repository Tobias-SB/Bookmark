# Bookmark — Changelog

## Web hosting moves to Cloudflare Workers static assets — 30 October 2026

Owner decision. Supersedes the hosting choice in the S6 desk spike below.
- **Host:** Cloudflare Workers static assets with no Worker script (`wrangler.jsonc`, default `workers.dev` subdomain), instead of Cloudflare Pages. Cloudflare now recommends Workers for new projects; Workers static assets supports `_headers` (not served as a file; 100 rules of up to 2,000 characters) and an explicit `not_found_handling: "single-page-application"`. `_headers` does not apply to Worker-generated responses, so the project never adds a Worker script. The docs do not say whether the single-page fallback carries `_headers`; spike S6 checks it with a deep-link reload. A local `wrangler dev` run (4.156.0) returned 200 with COOP and COEP for `/`, `/spike-s1` and `/readable/abc123`, and did not serve `_headers`; the live deploy still has to show the same.
- **Web output is `single`** (was `static`). Routes such as `readable/[id]` take IDs that exist only on the reader's device and cannot be pre-rendered.
- **Caching:** Workers' default `Cache-Control: public, max-age=0, must-revalidate` already revalidates `index.html`, so `_headers` adds no cache rules. Stale home-screen builds are a Workbox update question for Phase 2.
- **Privacy policy** (§18.1) states that the website's host sees requests, including IP addresses, as any website's host does, and Bookmark receives and stores none of them. Cloudflare Web Analytics stays off.
- **S6 is redefined** (§21): `/` and a deep-link reload both carry COOP/COEP, and `require-corp` works in an iPhone home-screen install. `tools/spikes/S1.md` deploys with `npx wrangler@4.156.0 deploy`.

Spec sections changed: §2.3, §18.1, §18.2, §21 (S6), §22 item 9.

Sources: [Workers static assets headers](https://developers.cloudflare.com/workers/static-assets/headers/), [Workers single-page applications](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/).

## Spike S17 Android device checks — 30 October 2026

Owner, Pixel 10, release build of 666a491 (`/s17`).
- Pass: themed render; light, dark and black switch without flicker, status bar legible; cold start in system dark mode with no white flash; TalkBack announces the AlertDialog with its title; Back closes it.
- **Fail: TalkBack focus is not confined to the dialog.** The installed `@rn-primitives/alert-dialog` renders natively through a portal View and sets only `aria-modal`, which Android ignores, so screen-reader focus reaches the content behind. Select and DropdownMenu use the same portal approach.
- Not run: hardware-keyboard Tab trapping (no keyboard).
- Decision pending with the owner: keep `@rn-primitives` and render the overlay inside React Native `Modal` on Android, or the §21 fallback (all four components on `Modal`).

## Phase 0 desk spikes S5–S8 — 29 October 2026

Desk research only (plan B2). Each result names what a live check still has to confirm.

- **S5 Google Books from the browser: go, pending one live check.** `www.googleapis.com/books/v1/volumes` answers a cross-origin request by echoing the caller's `Origin` in `Access-Control-Allow-Origin` (checked with `curl` and a test origin; the keyless request itself was rate-limited with 429). The Books API takes `key=` on every request, and Google Cloud API keys support HTTP-referrer restrictions, which apply to browser requests. **Owner check:** from the S6 test deploy, a search with a key restricted to that address returns 200, and the same key from `curl` without a referrer returns 403.
- **S6 Cloudflare Pages: go, pending the curl check.** `_headers` allows up to 100 rules of up to 2,000 characters; its headers apply to static asset responses but not to Pages Functions, so the app stays a pure static export. With no top-level `404.html`, Pages serves the root for unknown paths. The docs do not state the plan, nor that the fallback response carries `_headers`. **Owner check:** `curl -I` of `/` and of an unknown deep path both show COOP `same-origin` and COEP `require-corp`. Never ship a top-level `404.html`.
- **S7 AO3 cross-origin reads: unknown.** No public documentation was found and AO3 was not contacted. The design does not depend on it (§10.1).
- **S8 Ko-fi via the project website: no-go; the §21 fallback applies.** Play's Payments policy says apps "may not lead users to a payment method other than Google Play's billing system", including through links, except under region-specific programs that need enrolment. In February 2022 Play rejected StreetComplete for linking to its project home, which listed donation options, and accepted it once the link was removed. The Android app links only to the privacy policy page; Ko-fi stays on the website and web app (§22 item 11).

Device spikes S1–S4 are prepared (`app/spike-s1.tsx`, `tools/spikes/`, `tools/spike-s3/`); none has run.

- `public/_headers` sets COOP and COEP on every route (§18.2). **Provisional:** the Content-Security-Policy is left out until the app is deployable, so S1 tests storage alone; §18.2 makes its `connect-src` depend on S5 and S9.
- **S2 burst (owner-approved one-off):** S2's five requests 1 s apart are faster than §10.1's 2 s pacing, run once to see how AO3 rate-limits, and stop at the first 429 or 503. The app itself keeps the §10.1 pacing.
- The owner fills in the site URL and AO3 work IDs in `tools/spikes/S2.md` before running it. Delete `app/spike-s1.tsx` and the `spike.s1.*` keys once S1 is recorded.

Sources: [Google Books API](https://developers.google.com/books/docs/v1/using), [API key restrictions](https://docs.cloud.google.com/api-keys/docs/add-restrictions-api-keys), [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/), [Cloudflare Pages serving](https://developers.cloudflare.com/pages/platform/serving-pages/), [Play Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738), [StreetComplete #3768](https://github.com/streetcomplete/StreetComplete/issues/3768).

## Phase 0 wave 1: domain functions — 29 October 2026

Owner decisions:
- **Fractional keys** are capped at 1,024 characters (`MAX_KEY_LENGTH`). Keys arrive in sync files, so an over-long key is rejected before the recursive midpoint, and no key over the cap is produced. 1,000 inserts into one gap reach 169 characters.
- **`Ao3Snapshot.series` may be `null`** ("in no series"), which clears all four series fields; `undefined` still leaves them alone (§10.3).
- **`summarizeChanges`** is deferred to the updates inbox (§11.3), where its output shape will be settled.
- **Exclusion filters let books through** (§7.2): `excludeWarnings` and `isAbandoned: false` keep books; the positive fanfic-only forms still exclude them. The `kind` filter includes or excludes a whole kind.
- **"New chapters" stays as §6.6 defines it:** any reading or completed WIP with `chaptersBehind > 0`, so chapter 2 of 5 posted shows "3 new".
- **Remote clocks** more than 24 hours ahead of local time are rejected (`MAX_REMOTE_DRIFT_MS`), as is any remote at the HLC ceiling, so a crafted file cannot stop a device writing.
- **Life clock** (`fieldClocks.deletedAt`, §9.3 rule 2): the deleted-or-live state merges by its own clock, stamped by delete, undo and user edits but never by AO3 updates, a `statusPatch` or other system writes (§8.3). An AO3 update or status reversion on another device therefore never restores a deleted work. This adds a key to the `.bookmark` file's `fieldClocks`.
- **Duplicate `device_id`** after an Android backup restore is handled in the sync service wave: a restored device gets a new id.

Provisional, spec silent:
- `hlcTick` and `hlcReceive` take a `deviceId`, because `hlc_last` is unseeded on the first tick (§9.2 lists only `last` and `wallMs`). Device ids must be UUIDs, and the nil UUID is reserved for `GENESIS_HLC`.
- Invalid fractional keys throw a plain `Error`, as caller bugs; the shelf service maps them to `AppError` at the sync boundary.
- `planAo3Update` sorts changes safety, progress, info; arrays compare as sets but are stored in AO3's order; tag comparison is case-sensitive.
- When neither side of a merge has a life clock, the row comes back live and reports restored: a wrongly restored row is visible, a wrongly hidden one is purged after 180 days.

For the next waves:
- The sync service must check every clock in an imported file with `isHlc`, run the drift check on the highest one, require `kind` and `sourceType` on readables rows, drop `values.deletedAt`, and take a cover's `imageData` from the winning row.
- The readables repository must reject a patch whose kind differs from the stored row; that rejection is what keeps a book-shaped patch from skipping `stripAo3OwnedFields`.
- Repository tests must cover the §8.3 life-clock stamping rules on every write path.
- §8.6 gap: live child rows of a purged parent are never purged.

## Phase 0 B0: domain types — 29 October 2026

- **`AO3_OWNED_FIELDS`** is the spec §6.5 list as written (21 fields), approved by the owner. `satisfies` ties it to the `FanficPatch` keys, so a misspelt or non-patchable field fails type-check.
- **`ReadableFilters` and `DEFAULT_FILTERS`** live in `src/features/readables/domain/readableFilters.ts`, as spec §7.2 says, rather than in `readable.ts` as the plan said. W3 adds the filter functions to that file.
- **`ReadingState` and `ContentPreferences`** live in `readable.ts`, the spec §6 default location, because §6.6 and §7.8 name no file.

## Phase 0: generated native folders — 28 October 2026

- `expo run:android` generates `android/`. It is build output (spec §2.4: native settings go through `app.config.ts` and config plugins, never the generated projects), so `/android` and `/ios` stay in `.gitignore` and are never committed. Both were already ignored; neither was ever tracked.
- The build switched the `android` and `ios` npm scripts to `expo run:android` and `expo run:ios`, which build the native app instead of opening Expo Go.
- **Open:** the build also wrote the app ID `io.github.tobias_sb.bookmark` (`android.package`, `ios.bundleIdentifier`) into `app.config.ts`. It stays uncommitted until the owner decides, before the first Play upload, because a published app ID can never change and the Google Books key restriction (spec §10) is tied to it.

## Phase 0: graphify hooks — 28 October 2026

- The graphify git hooks (post-commit, post-checkout, post-merge) keep rebuilding in the main checkout, so the hub always queries current code. A local guard makes them skip secondary worktrees, so parallel spokes never rebuild over each other. The hooks live in untracked `.git/hooks/`; re-running `graphify hook install` drops the guard, so re-add it then.
- `CLAUDE.md`: "only after merging" becomes "subagents never run `graphify update`", matching the hooks.

## Phase 0: npm audit triage — 28 October 2026

- `npm audit` reports three high and thirteen low findings, all from two advisories in build and test tooling. Neither reaches the app bundle, so nothing changes now. Do not run `npm audit fix --force`: it downgrades Expo to 51 and Jest to 25.
- **Zod** (high, GHSA-mrhx-c7xc-m3w5, fixed in 4.6.6): `zod@3.25.76` comes in through `@expo/cli` and `eslint-plugin-react-hooks`, which only read our own config. No override, because Zod 4 changes the API those tools use. It clears when Expo updates. Spec §4 now requires Zod 4.6.6 or later when the app adds Zod itself.
- **deepmerge** (low, GHSA-gcqx-w48m-w2h4, no fixed release): `deepmerge@4.3.1` comes in through `@expo/config` and `jest-config` and merges only our own config files. Accepted. The app must not use deepmerge on untrusted input.

## Phase 0 Task 9: CI — 28 October 2026

- `.github/workflows/ci.yml` runs on every push and pull request on `ubuntu-latest`: Node from `.nvmrc` with the npm cache, then `npm ci`, `typecheck`, `lint`, `test` and `export:web`. It has read-only permissions, no deploy and no secrets.
- **Provisional:** `.nvmrc` pins Node 22, which meets Expo's `^22.13.0`; this machine runs 24.
- `typecheck` now runs `expo customize tsconfig.json` first. That regenerates the git-ignored `expo-env.d.ts` and typed-route declarations, without which a fresh checkout fails `tsc`. It leaves `tsconfig.json` unchanged.

## Phase 0 Task 8: enforcement — 28 October 2026

- `eslint.config.js` enforces the `CLAUDE.md` red flags that lint can express: `Platform.OS`, `fetch`, storage, `DELETE FROM` on synced tables, raw colours, banned libraries, Ko-fi, `any`, `@ts-ignore`, object-literal assertions, and JSX text outside `t()`. Each rule has a flagged fixture and an allowed fixture in `src/__tests__/lint/redFlags.test.ts`.
- `DELETE FROM` on a synced table is allowed only in `src/features/*/data/*Repository.ts`, following spec v4.8 (§16), rather than the plan's function-name selector. Review still confirms it sits in `purgeTombstonesOlderThan`. `DELETE FROM id_aliases` is flagged everywhere (§8.3).
- **Provisional:**
  - `app.config.ts` may hold a raw colour, because the Android adaptive-icon background must be a literal.
  - Ko-fi is allowed only in `*.web.ts(x)` files, as an approximation of "never reachable from native".
  - `npm run lint` fails on warnings too (`--max-warnings 0`).
- **Stop hook:** `.claude/hooks/stop-checks.sh` runs type-check, lint and tests when source or config changed, and blocks (exit 2) on failure. It stays silent on Markdown-, `docs/`- and `tasks/`-only changes. It blocks once per stop; on the repeat stop (`stop_hook_active`) it lets Claude finish, so a failure Claude can't fix never loops.
- **Review fixes:** a file in two zones (for example `src/platform/x.web.ts`) is exempt from both. Banned-library matching covers package imports only. The colour pattern catches hex inside longer strings and no longer flags words such as "go-to-green". `*.sh` files are checked out with LF.
- **Not lintable; left to review and tests:** `DELETE FROM` with an interpolated or bracketed table name, `fetch` or `Platform.OS` reached by destructuring or computed access, named colours outside style objects, and `as unknown as X` casts.

## Phase 0 Task 7: scripts — 28 October 2026

- Scripts: `typecheck`, `lint` (`expo lint`, flat config), `test` and `export:web`. Each exits 0 on a clean tree and non-zero on a planted failure. The `CLAUDE.md` Commands table is filled in.
- **Provisional:** the Jest projects split by file type, not folder: `*.test.ts` runs in `jest-expo/node` and `*.test.tsx` in `jest-expo`.
- **New dev dependencies:** `eslint` and `eslint-config-expo` (already in §4).
- `ThemeProvider` drops its "applied" render gate. Its layout effect already runs before paint, and the gate was a set-state-in-effect lint error.

## Phase 0 Task 6: initial migration — 28 October 2026

- `001_initial.ts` holds the §8.2 SQL verbatim. A test fails if it drifts from the spec, because pre-release the two are edited together.
- The Up Next seed follows spec v4.8 (§7.7, §9.2): fixed values, `GENESIS_HLC` as `updated_hlc` and every field clock, and `hlc_last` not seeded. This replaces the per-device values in the Phase 0 plan, which predate v4.8.
- **Provisional:**
  - "Every field" in the seed's `field_clocks` means the nine `Shelf` domain fields other than `id` (§6.4, §9.4).
  - `runMigrations` takes only `randomUUID`; the plan's `clock` became unnecessary once the seed timestamps were fixed.
  - A database with a `user_version` newer than the app is refused with `unsupported_version`.
- **New dependency:** `expo-crypto` (already in §4).
- **Web check:** migrations run on a fresh database and re-run as a no-op after a reload.

## Phase 0 Task 5: database port — 28 October 2026

- `withWriteQueue` turns an unqueued connection into the `Db` port. Writes and transactions share one promise chain, reads run freely, and every failure becomes an `AppError` (`db`, or `storage_full` when the driver reports a full disk). Inside a transaction, the `tx` handle skips the queue.
- **Provisional:**
  - A nested `tx.transaction` joins the outer transaction.
  - Named params are written expo-sqlite style (`{ $id }`); `createTestDb` strips the prefix for better-sqlite3.
  - The database file is `bookmark.db`.
  - `canTipInApp` is `false` until tip build flags exist.
- **New dev dependencies:** `better-sqlite3` (already in §4) and its types. Metro adds `wasm` as an asset extension for expo-sqlite on web.
- **Web check (headless Chromium, static export):** the database opens under COOP/COEP, `wa-sqlite.wasm` loads, the app renders, and a reload reopens it.
- **Deferred to Phase 1:** the database error screen's **Export database file**, because it needs the files adapter.

## Phase 0 Task 4: clock, errors, json — 28 October 2026

- **Provisional:** `Clock` is `{ now(): Date }` with `systemClock`. `errors.ts` is §15 verbatim plus `appError()` and `isAppError()`. `parseJsonArray` returns `[]` for anything that is missing, malformed or not an array.
- The minimal Jest config the plan put here already arrived in Task 2.

## Phase 0 Task 3: theme — 28 October 2026

- **Provisional token names:** `surface`, `surface-variant`, `on-surface`, `on-surface-variant`, `primary`, `on-primary`, `outline`, `warning`, `on-warning`, `error`, `on-error`, `focus`, for light, dark and black. `contrast.test.ts` parses `global.css` and holds every text pair to 4.5:1, and outline and focus to 3:1 (§14).
- `ThemeProvider` takes `preference` as a prop. The root passes `'system'` until Phase 1's `SettingsProvider` supplies the stored value. `'system'` reaches Uniwind unchanged, because on native an explicit light or dark pins `Appearance`.
- Selected tabs use bold text as well as colour (§14).

## Phase 0 Task 2: tabs layout — 28 October 2026

- `(tabs)/_layout.tsx` uses headless `expo-router/ui` tabs through `<TabList asChild>`, with our `TabBar` below 900 px and `NavRail` at 900 px and wider. `TabItem` is the shared tab button.
- **Provisional:** `t()` is a typed lookup over `src/shared/i18n/en.ts` with no dependency. Tabs show labels only, because the spec names no icon set. `@/` maps to `src/`.
- Jest (`jest-expo`) and Testing Library arrived in Task 2 rather than Task 4, because Task 2 has component tests. TypeScript 6 defaults `types` to `[]`, so `tsconfig.json` names `jest`.

## Spike S17 — 28 October 2026

**Installed:** Expo SDK 58.0.21 · React Native 0.88.1 · React 19.3.0 · React Native Web 0.21.4 · Uniwind 1.13.1 · Tailwind CSS 4.3.3 · `@rn-primitives` alert-dialog, dropdown-menu, select 1.5.2, portal 1.5.3 · expo-router 58.0.28.

**Web (static export served with COOP `same-origin` / COEP `require-corp`, checked headless in Chromium):**
- `crossOriginIsolated === true`, no console errors.
- Light, dark and black switch at runtime. A cold load with a preset theme paints only that theme. Before JS runs, the page background follows the system scheme (`html`/`body` use `--color-surface`); an exact pre-JS match is impossible because the saved theme lives in SQLite.
- AlertDialog: `role="alertdialog"` named by its title, Tab and Shift+Tab stay inside, Escape closes, focus returns to the trigger.
- **Defect (Uniwind 1.13.1, Windows only):** the web transformer matches `/components/web/metro-injected.js` with forward slashes, so on Windows extra themes are never registered on web and `setTheme('black')` throws. Native and Linux builds (CI, hosting) are unaffected. Fixed by `patches/uniwind+1.13.1.patch`, which normalises the path. Re-verified after a clean `npm ci`.
- **New dependency: `patch-package`** (dev, `postinstall`), so Windows development matches CI. It was added to the §4 table. `uniwind` is pinned exactly while the patch exists. Remove both when Uniwind ships a fix. The patch was written with `git diff`, because `patch-package`'s own generator fails on this machine.

**Expo Router root:** expo-router 58 uses `src/app/` as the routes root whenever it exists, which collides with `src/app/theme/` (§17). The plugin's `root` is pinned to `./app`.

**Static serving:** `public/serve.json` (not the repo root, as the plan had it) so the export copies it into `dist/`; `npx serve@14 dist` then sends COOP/COEP. The production host sets its own headers (S6).

**Android:** the bundle exports and registers all three themes. Device checks are pending the owner.

**Result:** web go. Android pending.

## Spec v4.8 — 28 October 2026

Answers questions raised while planning the Phase 0 migration.

- **Up Next seed:** fixed values on every device, with `GENESIS_HLC` as every field's clock, so seeds merge without conflict and any real edit wins (§7.7, §8.2).
- **HLC:** `GENESIS_HLC` defined. `field_clocks` keys are camelCase domain field names. `hlc_last` is not seeded (§9.2).
- **Lint:** `DELETE FROM` on synced tables is allowed only in repository files; review confirms it sits in `purgeTombstonesOlderThan` (§16).

**Spec sections changed:** §7.7, §8.2, §9.2, §16, §22 (item 39).

## Spec v4.7 — 28 October 2026

Resolves contradictions between `CLAUDE.md` and the spec, found during the kickoff review.

- **Tombstone purge:** each synced repository except `aliasRepository` exposes `purgeTombstonesOlderThan(db, cutoff)`. A startup service runs them in one transaction, and they are the only hard delete of synced rows. `id_aliases` rows are never purged (§8.3, §8.6, §16, §22.4).
- **Storage:** `AsyncStorage` and `localStorage` are banned outright, not only "for data" (§4).
- **Spec gaps:** §0 now matches `CLAUDE.md`. Take a provisional choice and record it; stop and ask first only when the choice is hard to undo.
- **AO3-owned fields:** §16 now says they are written only by AO3 updates (`applyAo3Fields` with a `planAo3Update` patch), and user patches pass through `stripAo3OwnedFields`. `planAo3Update` itself is pure and writes nothing.

**Spec sections changed:** §0, §4, §8.3, §8.6, §16, §22 (item 4).

## Spec v4.6 — 28 October 2026

**Development workflow**
- `CLAUDE.md` replaces the old system prompt as the top of the priority order (§0). It and the subagent definitions in `.claude/agents/` point to spec sections instead of repeating them; the spec does not describe the development tooling (§0, §5.2).
- The version number is removed from the spec's title. Spec versions are tracked only in this changelog.
- "Full files only — no diffs" is retired. The rule is now "complete code only": partial edits are allowed, placeholder or collapsed code is not (§5.2).

**Quality**
- ESLint added to the stack table (§4).
- Architecture lint rules added (§16): ESLint enforces the §5.2 rules it can express (`Platform.OS`, `fetch`, `AsyncStorage`/`localStorage`, raw colours, banned libraries, Ko-fi in native code, `any`, `@ts-ignore`). The rest are covered by repository tests and review. CI lint includes them.

**Roadmap**
- Phase 0 now runs spike S17 first, because it can change the stack, and includes the architecture lint rules (§19).

**Repository layout**
- `CLAUDE.md`, `CHANGELOG.md`, `docs/` and `.claude/` added to the folder structure. `.gitignore` excludes `CLAUDE.local.md`, `.claude/settings.local.json` and generated tool output such as `graphify-out/` (§17).

**Spec sections changed:** title, §0, §4, §5.2, §16, §17, §19, §20 (decisions 39–40).

## Spec v4.5 — 26 October 2026

**Tech stack**
- Baseline set to Expo SDK 58, React Native 0.88, React 19.3, React Native Web 0.21, Node 22.13 or later.
- React Native Paper removed. Styling is now Uniwind with Tailwind CSS v4; themes (light, dark, black) are CSS variables in `global.css`.
- Components are our own (`src/shared/components/`, listed in §12.14). `@rn-primitives` is added only for AlertDialog, DropdownMenu, Select and Portal, because focus handling, portals and dismissal are costly to build correctly.
- `@react-native-community/datetimepicker` added for date input on native, behind a new `dateInput` platform adapter; web uses `<input type="date">`.
- Tabs: Expo Router headless JS tabs on every platform, including iOS in Phase 6, with a nav rail at 900 px and wider. Native tabs are not used.
- Forms: `Controller` for every input component (was "every Paper input").
- Provider order: `ThemeProvider` (Uniwind) replaces `PaperProvider`; `PortalHost` added.

**Scope**
- Discreet mode removed: `ContentPreferences.discreetMode`, summary blur and cover blur. `coverVisibility` now returns `'show' | 'placeholder'`. Sync import ignores a `discreetMode` field in older files. Content preferences (hidden warnings and ratings) are unchanged.

**Spec sections changed:** §1 (principle 6), §2.1, §2.4, §3.1, §3.2, §4, §5.1, §5.2, §5.4, §5.5, §7.8, §7.12, §8.1, §8.7, §9.3, §10.9, §12.1, §12.4, §12.5, §12.9, §12.10, §12.13, §12.14 (new), §13.2, §14, §16, §17, §18.2, §19, §20 (decisions 34–38), §21 (spike S17), §22 (items 35–38).

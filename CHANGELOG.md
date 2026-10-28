# Bookmark — Changelog

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

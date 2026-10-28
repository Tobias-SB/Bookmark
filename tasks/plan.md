# Implementation Plan: Phase 0

## Overview

**Part A (this pass)** is the serial foundation, which the hub builds on `phase-0/foundation` with one commit per task:
- S17
- the skeleton
- theme
- utils
- the `Db` port
- `001_initial`
- scripts
- enforcement
- CI

Each task's reviewer diffs against the previous task's commit (`main` for Task 1).

**Part B (the Phase 0 remainder)** is listed and briefed here, but isn't built in this pass:
- fan-out wave 1
- desk spikes S5–S8
- device spikes S1–S4
- owner tasks

The spikes and owner tasks need your evidence or action.

**Provisional** means the spec doesn't decide it (§0 v4.7). It's the simplest consistent option, recorded until you confirm it.

**Working method:**
- **APIs:** confirm every API in the installed `.d.ts`.
- **Checks:** run them after each task.
- **Review:** run the reviewer after each task, with the brief format in `CLAUDE.md`.
- **Jest timing:** a minimal Jest config is pulled forward into Task 4, because Tasks 3–6 need tests. Task 7 finishes the scripts.

---

# Part A: Foundation (serial, hub)

## Task 1: Spike S17. Scaffold and stack proof (go/no-go)

**Spec:** §4, §8.1, §14, §17, §21 S17

**Steps:**

1. Run `npx create-expo-app@latest ../bookmark-scaffold --template blank-typescript`.
   - *Provisional:* blank, so there are no example routes.
   - SDK 58.0.21 is current.
2. Move the generated files in, without overwriting `CLAUDE.md`, `CHANGELOG.md`, `docs/`, `.claude/`, `.agents/`, `skills-lock.json` or `tasks/`.
   - Merge `.gitignore` and add `graphify-out/`, `.claude/settings.local.json` and `CLAUDE.local.md`.
   - Delete the sibling folder.
3. Install with `npx expo install`:
   - `expo-router` and its peers
   - `react-native-web`, `react-dom`
   - `uniwind`, `tailwindcss@4`
   - `@rn-primitives/alert-dialog`, `/dropdown-menu`, `/select`, `/portal`
4. Add `app.config.ts`:
   - typed routes
   - `web.output: 'static'`
   - scheme `bookmark` (*provisional*)
5. Add `metro.config.js` with `withUniwindConfig` and a `black` extra theme.
6. Add a minimal `global.css`.
7. Add a throwaway `app/s17.tsx`:
   - a themed card
   - light, dark and black switch buttons
   - an AlertDialog
8. The root layout holds rendering until the theme is applied.
9. Run `expo export --platform web` and serve `dist/` with `npx serve@14`. Its `serve.json` sets COOP `same-origin` and COEP `require-corp`. *Provisional:* no dependency gets added.

**Files:**
- `package.json`, lockfile, `app.config.ts`, `metro.config.js`, `babel.config.js` (only if needed), `tsconfig.json`, `.gitignore`
- `global.css`, `app/_layout.tsx`, `app/s17.tsx`, `serve.json`

**Acceptance criteria:**
- [ ] The installed versions of Expo, React Native, React, React Native Web, Uniwind, Tailwind and `@rn-primitives` are recorded.
- [ ] Web, under the headers:
  - `crossOriginIsolated === true` with no console errors
  - the themed screen renders
  - all three themes switch at runtime
  - a cold load with a preset theme has no wrong-theme flash
- [ ] Web AlertDialog:
  - it has `role="alertdialog"` with a name
  - Tab and Shift+Tab are trapped inside it
  - Escape closes it
  - focus returns to the trigger
- [ ] Go/no-go is written into `CHANGELOG.md`. If it's no-go, the §21 fallback applies and I stop to re-plan with you.

**Tests:** none automated, because it's a spike. The hub checks web with a browser tool if one is available; otherwise it goes to you.

**Manual checks for you (Android):**
1. Run `npx expo run:android` (or an EAS development build) and open `/s17`.
2. Confirm the screen renders themed.
3. Switch the three themes. Check for no flicker and a legible status bar.
4. Cold start with black preset: the first frame is black, with no white flash.
5. Open the AlertDialog:
   - TalkBack announces it as a dialog with its title
   - Back closes it
   - focus stays inside
6. Optionally, on a keyboard, check that Tab stays inside the dialog.

**Checkpoint:** I stop and report S17 before Task 2.

## Task 2: JS tabs layout

**Spec:** §4, §12.1, §12.14 (TabBar, NavRail), §14, §22.37

**What it does:**
- `app/(tabs)/_layout.tsx` uses headless `expo-router/ui`. It shows `TabBar` when the width is below 900 and `NavRail` at 900 and above.
- There are five placeholder screens.
- `app/s17.tsx` is deleted.
- Strings go through a minimal `t()` in `src/shared/i18n/`, with typed keys and no dependency. *Provisional.*
- Labels only, no icons. *Provisional:* the spec names no icon set.
- The unread badge waits for Phase 1 data.

**Files:**
- `app/_layout.tsx`, `app/(tabs)/_layout.tsx` and the five tab screens
- `src/shared/components/TabBar.tsx`, `NavRail.tsx`
- `src/shared/i18n/index.ts`, `en.ts`
- tests

**Acceptance criteria:**
- [ ] The bottom bar shows at 899 and the rail at 900. Both use `tablist`/`tab` and announce the selected state.
- [ ] Targets are at least 48 dp, labels always show, and the bottom bar uses `useSafeAreaInsets().bottom`.
- [ ] Typed routes compile, and the export has a URL per tab.

**Tests:** Testing Library on `TabBar` and `NavRail`, plus a layout test that mocks the width at 899 and 900.

## Task 3: Theme tokens and `src/app/theme/`

**Spec:** §4, §8.1, §8.7 (`theme`), §14

**What it does:**
- `global.css` holds the semantic tokens for light, dark and black. The token names are *provisional*: `surface`, `surface-variant`, `on-surface`, `on-surface-variant`, `primary`, `on-primary`, `outline`, `warning`, `on-warning`, `error`, `on-error`, `focus`.
- `resolveTheme(pref, systemScheme)` is pure.
  - When the preference is `system` and the system is dark, it returns `dark`.
- `ThemeProvider` applies the theme through Uniwind and follows `Appearance`.
- It takes `preference` as a prop. Phase 0 passes `'system'`, and Phase 1's `SettingsProvider` will feed the stored value.

**Files:** `global.css`, `src/app/theme/resolveTheme.ts`, `ThemeProvider.tsx`, `index.ts`, tests

**Acceptance criteria:**
- [ ] Token classes only.
- [ ] Every text/background pair meets AA (4.5:1) in all three themes.
- [ ] A preference change restyles the app without a remount.

**Tests:**
- the `resolveTheme` table
- a contrast test that parses `global.css` (enforces §14's "checked when tokens change")

## Task 4: `clock.ts`, `errors.ts`, `json.ts` (+ minimal Jest config)

**Spec:** §6 preamble, §8.2, §15

**What it does:**

| File | Contents |
|---|---|
| `src/shared/utils/clock.ts` | `interface Clock { now(): Date }` and `systemClock`. *Provisional shape.* |
| `src/shared/types/errors.ts` | §15 verbatim, plus `appError()` and `isAppError()` |
| `src/shared/utils/json.ts` | `parseJsonArray(value: string \| null): unknown[]`. It never throws. |

**Files:** the three files, tests, `jest.config.js`

**Acceptance criteria:**
- [ ] `parseJsonArray` returns `[]` for `null`, `''`, `'{'`, `'{}'`, `'1'` and `'"x"'`, and returns arrays as they are.
- [ ] `isAppError` accepts every code, and rejects `Error`, `null` and unknown codes.

**Tests:** unit tests for each file.

## Task 5: `Db` port, write queue, `createExpoDb`, `createTestDb`, `DatabaseProvider` / `useDb`

**Spec:** §5.3, §5.4, §8.1, §8.5, §15

**What it does:**
- **`Db.ts`:** verbatim from §5.3.
- **`writeQueue.ts`:**
  - one promise chain
  - a failure rejects only its own caller
  - inside `transaction`, the `tx` handle bypasses the queue, which avoids deadlock
- **`createExpoDb.ts`:**
  - on Android, WAL and `busy_timeout=5000`
  - `withExclusiveTransactionAsync` on Android, `withTransactionAsync` on web
  - the platform comes from `capabilities.platform`
- **`src/platform/capabilities.ts`:** the full §5.4 interface. Spike-gated web flags are `false`, and the Ko-fi flag is `false` on native.
- **`createTestDb.ts`:** `better-sqlite3` behind the same port and queue. Named params are normalised (*provisional*).
- **Metro:** the `expo-sqlite` web WASM config, plus COOP/COEP headers on the dev server.
- **Errors:** raw errors map to `AppError{code:'db'}`.
- **`DatabaseProvider` / `useDb`:** `useDb` throws a named error outside the provider.
- **Root layout:**
  - keeps the splash up
  - opens the database and migrates
  - shows a minimal database error screen with **Try again**
- **Deferred:** **Export database file** (§8.5) waits for the `files` adapter in Phase 1.

**Files:**
- `src/db/Db.ts`, `writeQueue.ts`, `createExpoDb.ts`, `createTestDb.ts`, `DatabaseProvider.tsx`, `useDb.ts`
- `src/platform/capabilities.ts`, `metro.config.js`, `app/_layout.tsx`
- tests

**Acceptance criteria:**
- [ ] Concurrent writes run in order, and a read isn't blocked by a slow write.
- [ ] A throwing transaction rolls back and the queue continues.
- [ ] `createTestDb` passes the port contract suite.
- [ ] `useDb` outside the provider throws.

**Tests:**
- the contract suite on `createTestDb`
- `writeQueue` ordering and failure-isolation tests
- a `useDb` test
- `createExpoDb` is checked manually and through the export only

## Task 6: `001_initial.ts` and the migration runner

**Spec:** §0, §8.2, §8.5, §9.2, §22.15

**What it does:**
- The §8.2 SQL verbatim.
- `runMigrations(db, { randomUUID, clock })`:
  - reads `PRAGMA user_version`
  - runs one transaction per migration
  - sets `user_version` inside that transaction
- It inserts the Up Next shelf and `device_id`.
- The Up Next values the spec leaves open are *provisional*:

| Value | Choice |
|---|---|
| `name` | `'Up Next'`. The UI shows `t()` by `system_key`, since it can't be renamed (§7.7). |
| `sort_key` | `'a0'` |
| `updated_hlc` | the §9.2 format built inline, `<15-digit ms>:00000:<device_id>` |
| `field_clocks` | `'{}'` |
| `hlc_last` | seeded with that same clock |

These are pre-release in-place edits, so they're cheap to change.

**Files:** `src/db/migrations/001_initial.ts`, `index.ts`, `__tests__/migrations.test.ts`, `app/_layout.tsx`

**Acceptance criteria:**
- [ ] On a fresh database:
  - `user_version = 1`
  - all 13 tables and every index exist
  - the Up Next row is there
  - `device_id` is a UUID
- [ ] Re-running is a no-op.
- [ ] An injected failing migration rolls back completely.
- [ ] The CHECK constraints hold:
  - a book with `is_complete` set is rejected
  - a fanfic missing `is_complete` is rejected
  - a smart shelf without filters is rejected
  - a duplicate live source is rejected, but a tombstoned duplicate is allowed

**Tests:** `migrations.test.ts` on `createTestDb`, running 0 → 1.

**After merge:** `graphify update` on `src/`.

## Task 7: Scripts and the Commands table

**Spec:** §4, §16

**Scripts:**

| Purpose | Script |
|---|---|
| Type-check | `typecheck`: `tsc --noEmit` |
| Lint | `lint`: `expo lint` (flat config) |
| Unit tests | `test`: `jest` |
| Single test file | `test -- <path>` |
| Web export | `export:web`: `expo export --platform web` |

- Jest projects: `jest-expo` for UI, and the Node environment for `src/db` and the domain folders.
- Fill in the `CLAUDE.md` Commands table. The uncompressed command is `rtk proxy <cmd>`.

**Files:** `package.json`, `jest.config.js`, `eslint.config.js`, `CLAUDE.md`

**Acceptance criteria:**
- [ ] All scripts exit 0 on a clean tree.
- [ ] A planted type error, lint error or failing test each makes its script exit non-zero. The plants are reverted.

## Task 8: Enforcement (ESLint red flags and the `Stop` hook)

**Spec:** §4, §5.2, §8.3, §8.6, §16, and the `CLAUDE.md` red flags

### Lint rules

| Red flag | Rule | Allowed in |
|---|---|---|
| `Platform.OS` | `no-restricted-syntax` on the member expression | `src/platform/**` |
| `fetch` | `no-restricted-globals`, plus `globalThis.fetch` / `window.fetch` | `src/shared/http/**` |
| `AsyncStorage`, `localStorage` | `no-restricted-imports` (async-storage); `no-restricted-globals` (`localStorage`, `sessionStorage`) and the member forms | nowhere (v4.7) |
| `DELETE FROM` the six tombstoned tables | `no-restricted-syntax` regex on `Literal`/`TemplateElement` | only inside a function named `purgeTombstonesOlderThan` in `src/features/*/data/*Repository.ts` (esquery `:not(...)` on the enclosing function or variable declarator) |
| `DELETE FROM id_aliases` | the same regex | nowhere |
| Raw colours | string literals with hex, `rgb(`/`rgba(`/`hsl(`, Tailwind palette or arbitrary colour classes, and named colours on colour style keys | `src/app/theme/**` |
| Banned libraries | `no-restricted-imports` patterns: paper, `*blur*`, `victory*`, `*chart*`, `recharts`, `d3*` | nowhere |
| Ko-fi | `/ko-?fi/i` in strings, and the identifier `KOFI_URL` | `**/*.web.ts(x)` (*provisional* approximation of "reachable from native") |
| `any` / `@ts-ignore` | `@typescript-eslint/no-explicit-any`, `ban-ts-comment` | nowhere |
| JSX text not in `t()` | `react/jsx-no-literals` (`noStrings`) | tests |
| `as` casts | `consistent-type-assertions` with `objectLiteralTypeAssertions: 'never'` (partial) | — |

**Lint can't catch these, so they stay with the reviewer's grep and with tests:**
- HLC ticking and `field_clocks` stamping, and `created_hlc` on aliases
- a purge that deletes rows without the `deleted_at < cutoff` condition (repository tests catch it)
- AO3-owned fields written outside `applyAo3Fields` with a `planAo3Update` patch, and a user patch that skips `stripAo3OwnedFields`
- a stored rating, review, score, kudos count or hit count (`rating` is a legitimate content-rating column)
- `as` casts used to silence errors in general
- Ko-fi reachable transitively from native code
- SQL assembled at runtime from fragments

### Stop hook

The hook is `.claude/hooks/stop-checks.sh`, registered under `Stop` in `.claude/settings.json`:
- It exits 0 silently when `git status --porcelain` shows no changed source or config files.
- Otherwise it runs type-check, lint and tests, and on failure exits 2 with a summary.
- *Provisional:* when `stop_hook_active` is set, it still blocks, but with a short message.

**Files:** `eslint.config.js`, `src/__tests__/lint/redFlags.test.ts`, `.claude/settings.json`, `.claude/hooks/stop-checks.sh`

**Acceptance criteria:**
- [ ] Each rule has a failing fixture and an allowed-path fixture, including a purge function, which passes, and the same SQL elsewhere, which fails.
- [ ] The hook is silent on a docs-only change and blocks on a planted type error.

## Task 9: CI (GitHub Actions)

**Spec:** §16 (CI), §4

**What it does:**
- `.github/workflows/ci.yml` runs on every `push` and `pull_request`, on `ubuntu-latest`:
  - Node from `.nvmrc`
  - `npm ci`
  - `npm run typecheck`
  - `npm run lint`
  - `npm test`
  - `npm run export:web`
- npm is cached.
- `.nvmrc` pins Node 22 LTS (*provisional*). That meets 22.13 or later, though your machine runs 24.
- No deploy, no secrets.

**Files:** `.github/workflows/ci.yml`, `.nvmrc`

**Acceptance criteria:**
- [ ] The workflow is valid YAML that uses only the scripts from Task 7.
- [ ] The first push of `phase-0/foundation` shows a green run.
- [ ] A run on a planted failure goes red. That's checked once, then the plant is reverted.

**Manual steps for you:**
- `origin` (`github.com/Tobias-SB/Bookmark`) exists, is reachable, and is empty. I'll ask before the first push, because pushing is outward-facing.
- In the repo's Settings → Actions, allow Actions.
- If the repo is private, Actions minutes are capped (2,000 a month on the free plan). Public is free (§16).

**Checkpoint:** all checks pass in CI. Merge to `main` (after you OK it). Then:
- rebuild graphify
- run `/doctor prompt-audit` and report what it flags in `CLAUDE.md` and `.claude/agents/`, without applying anything
- present Part B for your go-ahead

---

# Part B: Phase 0 remainder (listed, not built in this pass)

## B0. Prerequisite (hub, serial): the §6 domain types

Wave 1's domain functions need the shared model types first, so the hub lands them before fanning out:
- **`src/features/readables/domain/readable.ts`:** the enums, the `Readable` union, `ReadableFilters` and `ContentPreferences` (§6.1, §6.2, §6.5, §7.2, §7.8)
- **`src/features/ao3/domain/` types:** `Ao3Snapshot`, `Ao3Change`, and `AO3_OWNED_FIELDS` (§6.5, §10.3)
  - `AO3_OWNED_FIELDS` membership is stop-and-ask, so I'll present it before committing.

These are contract-like and shared across spokes, so the hub owns them.

## B1. Fan-out wave 1

Each brief has the format `CLAUDE.md` requires. Every spoke works in its own worktree, branched from `main` after Part A merges and B0 lands, and diffs against `main`.

**Shared check commands for every brief:** `npm run typecheck`, `npm run lint`, `npm test -- <own test paths>`.

**Disjointness:** `applyProgressChange` and `applyFilters` both live in `src/features/readables/domain/`. Their files differ, but the folder doesn't. That's flagged against "disjoint folders", so one spoke does both, serially.

| # | Goal | Spec | Files the spoke may change | Acceptance criteria | Model | Worktree |
|---|---|---|---|---|---|---|
| W1 | `fractionalKeyBetween(a, b)` and key generation for N items | §7.7, §17 | `src/shared/utils/fractionalIndex.ts`, its test | `a < result < b` for all valid inputs, including null ends; keys stay short across 1,000 repeated inserts; `fast-check` ordering property | Sonnet, reviewer Sonnet | `../bookmark-wt-fractional` |
| W2 | `hlcTick`, `hlcReceive`, and `mergeRows` | §9.1–§9.3, §16 | `src/features/sync/domain/hlc.ts`, `merge.ts`, their tests | §9.2 format with string order equal to time order; the clock never goes backwards; merge is field-wise LWW, with deletes, the restore summary, and the deterministic JSON tie-break; `fast-check`: commutative, associative, idempotent, convergent over 3 devices. Duplicate-work aliasing (§9.3 rule 3) is included only for its domain part (choosing the canonical id). | **Opus**, reviewer **Opus**; `doubt-driven-development` | `../bookmark-wt-hlc` |
| W3 | `applyProgressChange`, then `applyFilters` and search, plus `countActiveFilters` | §7.1, §7.2, §7.4, §7.8 | `src/features/readables/domain/progressRules.ts`, `readableFilters.ts`, their tests | every row of the §7.1 rule table and its events; every §7.2 filter, sort and search case; content preferences hide correctly; filtering 5,000 rows takes under 100 ms (§16 budget, as a test) | Sonnet, reviewer Sonnet | `../bookmark-wt-readables` |
| W4 | `planAo3Update` and `stripAo3OwnedFields`, `summarizeChanges` | §6.5, §7.5, §10.3 | `src/features/ao3/domain/ao3Update.ts`, its test | the plan patches only `AO3_OWNED_FIELDS`; change severities match §10.3; it is pure (the clock is passed in); the user patch is stripped | **Opus**, reviewer **Opus**; `doubt-driven-development` | `../bookmark-wt-ao3` |
| W5 | §12.14 shared components, in 4 serial batches within one spoke (one folder): **(a)** Actions and Display minus BarChart/CoverImage; **(b)** Inputs; **(c)** Layout minus TabBar/NavRail (done in Task 2); **(d)** Primitive-backed (AlertDialog, DropdownMenu, Select, Snackbar) | §12.14, §14, §16 (shared components) | `src/shared/components/**`, `src/shared/i18n/en.ts` (new keys only) | token classes only; 48 dp targets; roles and labels; 200% font scale; Testing Library covers roles, disabled and selected states, and keyboard behaviour for primitives on web. **Gate:** S17 is go and Task 3 tokens are merged. Excluded: CoverImage, BarChart, AuthorFeedbackPanel and DateField, which need adapters or feature data from later phases. | Sonnet, reviewer Sonnet | `../bookmark-wt-components` |

At most 5 spokes run at once: W1, W2, W3, W4 and W5.

## B2. Desk spikes (the hub researches; go/no-go goes in `CHANGELOG.md`)

| Spike | Question | Method | Go means |
|---|---|---|---|
| S5 | Can the browser call the Google Books API? Does an HTTP-referrer-restricted key work? | Google's docs on API key restrictions and CORS on `googleapis.com`. I'll list anything that only a live call can confirm as an owner check. | Browser calls are documented as supported and referrer restrictions apply to browser requests. |
| S6 | Does the free host apply `_headers` (COOP/COEP) with an SPA fallback? | Cloudflare Pages docs on `_headers`, limits and SPA handling; a comparison with Netlify | It's documented on the free plan. Final confirmation is a curl of the S1 test deploy. |
| S7 | Does AO3 allow cross-origin reads? | Informational. Public reports and AO3's terms. I won't hit AO3 from here. | It's recorded either way; the design doesn't depend on it. |
| S8 | Is a link from the Play app to a website that hosts Ko-fi acceptable? | Play Payments policy and the developer program policy on external donation links | The policy allows informational links that don't facilitate in-app payment for digital goods. Otherwise, the §21 fallback. |

## B3. Device spikes (you run them; I prepare steps and pages; never marked passed without your result)

| Spike | I prepare | You run | Go | No-go |
|---|---|---|---|---|
| S1 | A throwaway route `app/spike-s1.tsx` that writes a counter row to `expo-sqlite`, shows the row count, `navigator.storage.estimate()` and `persist()` results, plus a "write 5 MB" button. Deployed to the S6 host. | (1) Open it on iPhone Safari and Add to Home Screen. (2) Tap +1 three times. (3) Close the app and reopen it. (4) Reboot and reopen. (5) Write 5 MB ×4. (6) Report the counts and the quota. | The count survives (3) and (4); there are no errors; the quota is at least 50 MB. | Data is lost, or it errors → the §21 fallback (`sql.js` + IndexedDB) |
| S2 | A checklist of `curl` commands with the §10.2 user-agent: a General work, a Mature work with `view_adult=true`, a restricted work, and a burst of 5 requests 1 s apart. The saved HTML goes in `src/features/ao3/__fixtures__/`. | Run them from your machine and send the files and status codes. | The adult interstitial is bypassed by the param; restricted works give a distinguishable response; rate limiting gives 429 or 503 with Retry-After. | Adjust the `politeFetch` mapping (not a blocker) |
| S3 | A throwaway bookmarklet that reads the work title, tries `navigator.clipboard.writeText` and shows its result, and an install page `tools/spike-s3/index.html`. | Install it and run it on an AO3 work in iOS Safari, Android Chrome and desktop Chrome/Firefox. Report what it shows and whether the clipboard has the text. | It runs under AO3's CSP and the clipboard is written on iPhone. | Show the payload for manual copy and rely on pasted text |
| S4 | The same bookmarklet in a "count blurbs" mode, which reports the `li.blurb` count and the page heading text. | Run it on each §21 S4 page type (bookmarks, history, Marked for Later, subscriptions, series, author works, search, collections, another user's bookmarks) and report the table. | Recorded per page. | Document only the supported pages |

## B4. Owner tasks

- Create the Google Play developer account (individual). This includes the identity checks and the fee.
- Start recruiting 12 Play testers for the closed test (§19). They're needed for 14 days before production access.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Uniwind or `@rn-primitives` on RN 0.88 under `require-corp` | High | S17 first; §21 fallback |
| Web first-frame theme with static pre-render | Medium | Render nothing until the database and theme are ready; check a cold load |
| `better-sqlite3` on Windows with Node 24, and Linux CI with Node 22 | Medium | Prebuilt binaries; pin a version if needed and record it |
| `expo-sqlite` web WASM and COOP/COEP | Medium | Follow the installed docs. iPhone is S1. |
| Stop hook loops or slows every turn | Low | Skip when nothing has changed |
| Private repo Actions minutes | Low | Make the repo public, or keep CI lean |

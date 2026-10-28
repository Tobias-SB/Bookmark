# Bookmark — Specification

The single source of truth for Bookmark: product, platforms, data model, domain rules, persistence, sync, AO3 access, screens, release and roadmap. It replaces `BOOKMARK_V1_REFERENCE.md`, `BOOKMARK_V2_REFERENCE.md` and the v3 spec. History lives in `CHANGELOG.md`, never as inline comments here.

v4 is a deliberate redesign. The owner gave free rein to change anything, so this version re-platforms where it helps (Expo Router, a database port, a web client, Uniwind) and resolves the findings of the v3 review.

---

## 0. How to Use This Document

**Priority order:** `CLAUDE.md` → codebase and installed package versions → this spec → user request (unless the user explicitly overrides scope or architecture and confirms).

- If this spec and the codebase conflict, flag the conflict before proceeding.
- If no codebase exists, this spec is the primary guide; implement the simplest structure consistent with it.
- Anything not covered here is provisional: say that no rule exists, implement the simplest consistent approach, and record it as provisional until the owner confirms. Stop and ask first only when the choice would be hard to undo (`CLAUDE.md` lists these cases). Current provisional decisions are in §22; unverified assumptions that block work are the spikes in §21.
- **Pre-release migrations:** until the first Google Play production release, schema changes edit `001_initial.ts` in place, and development installs must clear app data (an in-place edit never reaches a device that already ran `001`). From the first production release onward, migrations are forward-only, one file per change, and this note must be updated.
- **Working instructions:** how Claude Code works in this repository (check commands, contract files, subagents and tooling) lives in `CLAUDE.md` and `.claude/agents/`. Those files point to sections of this spec rather than repeating them, and this spec does not describe the development tooling.

**Vocabulary:** *readable* is the code concept (a book or a fanfic). *Library* is the user-facing word. *Work* means an AO3 work. *Device* means one install: the Android app, or the web app in one browser profile.

---

## 1. Product Principles

Every rule in this spec traces back to one of these. When a request conflicts with a principle, say so.

1. **Reader-first.** Each feature answers one of: *What should I read next? Where was I? What's new in what I follow? How do I find that thing again?*
2. **Local-first and private.** All user data lives only on the user's own devices. No accounts, no servers that hold user data, no analytics, no telemetry, no ads. The app has no backend at all.
3. **Fandom etiquette.** No reviews, star ratings, scores, kudos/hit counts, or commentary visible to others. Favourites and notes are private. The app never copies, stores or redistributes work text, never asks for AO3 credentials, and is not affiliated with AO3 or the Organization for Transformative Works (OTW). No AO3 logo, name styling or colour scheme. Cover art is always the reader's own choice, kept on their devices and credited to the artist (§10.9).
4. **Gentle on AO3.** No crawling and no background polling. Every AO3 request is user-initiated, paced, capped and identifiable. Prefer reading pages the user already has open (the capture tool, §10.5) over making new requests.
5. **Free forever, honestly funded.** Every feature is free; nothing is ever sold, unlocked or gated. No ads, subscriptions or paywalls. Optional tips and clearly labelled bookshop links on books the reader doesn't own help cover costs, and costs and income are published (§12.12). Nothing to host except static files on a free tier.
6. **One codebase, two clients.** A full Android app on Google Play, and a web app (PWA) for iPhone, iPad and desktop, built from the same Expo project, with the same design on both.
7. **Sync-ready from day one.** Every user-data row carries the metadata needed to merge with another device (§9), even before sync ships, because retrofitting it later means migrating every row.

---

## 2. Platforms and Distribution

### 2.1 Capability matrix

| Capability | Android app (Google Play) | Web app (iPhone, iPad, desktop) |
|---|---|---|
| Library, detail, edit, progress, notes, favourites, shelves, picker, stats | Yes | Yes |
| Add an AO3 work by pasting its link (app fetches the page) | Yes | No — browsers block reading another site's pages unless that site allows it; the design does not rely on AO3 allowing it |
| Capture tool: copy work data from an AO3 page you have open, paste into the app (§10.5) | Yes | Yes |
| Paste copied AO3 page text (fallback, §10.4) | Yes | Yes |
| Share an AO3 link from the browser to the app | Yes (share intent) | No — not relied on; iOS web apps cannot be relied on as share targets |
| Check WIPs for updates by fetching | Yes (§11.1) | No — use capture on AO3 listing pages instead (§11.2) |
| Google Books search | Yes | Yes, if the API allows browser calls (spike S5); otherwise hidden |
| ISBN barcode scanning | Yes | No |
| Book covers found automatically (Open Library by ISBN, Google Books result) | Yes | Only if those image hosts allow browser downloads (spike S9); otherwise choose from photos |
| Cover from an image on an AO3 work page | Yes — the app downloads the image the reader picks | Save the image in Safari, then choose it from photos |
| Cover from photos or files | Yes (system photo picker) | Yes (Photos or Files) |
| App lock (biometric/PIN), hide content in recents | Yes | No |
| Backup and sync files | Share sheet / file picker | Download / file picker |
| Optional tips | Only through Google Play billing, and only if enabled (§12.12); never a link to Ko-fi | Ko-fi link |
| Bookshop links on books marked not owned | Yes | Yes |
| Works offline | Yes | Yes (service worker) |

Features read these differences from `PlatformCapabilities` (§5.4), never from `Platform.OS`. The native iOS app (Phase 6) matches the Android column except where §2.4 says otherwise.

### 2.2 Android

- Distributed only through Google Play as an Android App Bundle built with EAS. No self-hosted APKs.
- Requires a development build (not Expo Go) because of config-plugin modules (share intent, local authentication, screen capture, camera).
- A personal Play developer account created after 13 November 2023 must run a closed test (at least 12 testers opted in for 14 continuous days) before production access. Recruit testers during Phase 0 (§19).

### 2.3 Web (PWA)

- A static export of the same Expo app, hosted on a free static host that supports custom response headers (needed for COOP/COEP, §18.2). Cloudflare Pages supports a `_headers` file; confirm the free plan includes it (spike S6). The host's default subdomain is used, so there is no domain cost.
- The same site serves the privacy policy, help pages, the capture-tool install page, the public costs page and the Ko-fi link (§12.12).
- **iPhone:** users must use **Add to Home Screen**. Home-screen web apps keep their own storage, separate from Safari, and WebKit does not expect their first-party data to be deleted under its 7-day storage rule. In an ordinary Safari tab, storage can be cleared after 7 days of Safari use without a visit. The web app detects when it runs in a tab (`display-mode` is not `standalone`) and shows a persistent install banner.
- Because home-screen storage is separate from Safari, a link opened from Safari lands in Safari, not the installed app. All hand-offs into the web app therefore go through the clipboard or a file, never a URL (§10.5).
- iOS does not support background sync for web apps, and there is no server to send push notifications. The web app does nothing in the background.

### 2.4 iOS (Phase 6, not yet built)

A native iOS app is the same Expo project with an `ios` target added. It starts only when the iOS fund covers a year of Apple's developer fee (§12.12, §19). Everything in Phases 1–5 must stay iOS-ready so that adding the target is configuration and a short list of platform work, not a rewrite.

**Habits for Phases 1–5**
- Shared code never uses Android-only shortcuts or checks `Platform.OS`; differences go through `PlatformCapabilities` and adapters (§5.4).
- Native-only adapters are `.native.ts` (shared by Android and iOS). Add `.android.ts` / `.ios.ts` only when the two genuinely differ, and note why.
- Screens are not forked by platform. Layout uses safe-area insets and theme tokens, never platform-specific measurements.
- Config plugins and native settings are added through `app.config.ts`, never by editing generated native projects.

**What the iOS app gains over the web app:** AO3 link fetching, update checks and refresh (no browser restrictions), share from Safari, barcode scanning, app lock, automatic covers.

**Differences from Android**

| Area | iOS approach |
|---|---|
| Share from Safari | A share extension through `expo-share-intent`'s iOS support; needs an App Group so the extension can hand the link to the app. More setup and testing than Android's intent filter (spike S16). |
| Screen privacy | iOS cannot reliably block screenshots. When `screen_privacy` is on, cover the app with a plain overlay whenever it becomes inactive, so the app switcher shows nothing (spike S16). |
| Backups | iOS includes app data in iCloud and computer backups by default. To match Android (§13.2), exclude the database file and its folder from backup with a small native setting added through a config plugin (spike S16). |
| Permission text | Usage descriptions for the camera (barcode scan), Face ID (app lock) and any photo access the image picker requires; plain, specific wording. |
| App lock | `expo-local-authentication` with Face ID, Touch ID or the device passcode. |
| Keyboard | `KeyboardAvoidingView` with `behavior="padding"` on iOS (`"height"` stays on Android), chosen by the shared form layout component, not by each screen. |
| Date input | The `.native` date adapter (§4) uses the iOS system picker; no extra work. |
| Tips | Apple in-app purchase consumables, which App Review Guideline 3.1.1 allows for tips, behind `IOS_TIPS_ENABLED` (off by default). Copy as §12.12, naming Apple and its 15% Small Business Program rate. The Ko-fi link never appears in the iOS app. |
| Look and feel | The app's own Uniwind design and JS tab bar, identical to Android and web (§4, §12.1). Expo Router's native stack gives iOS back gestures. No native tabs. |
| AO3 access | Identical rules (§10.1) through the same `politeFetch`; the User-Agent names iOS. |

**Capability values on iOS:** `canFetchAo3`, `canReceiveShares`, `canAppLock`, `canScanBarcodes`, `canSearchGoogleBooks`, `canFetchCoverImages` and `canDownloadImageLinks` are true; `canShowSupportLink` is false; `canTipInApp` follows `IOS_TIPS_ENABLED`; `isInstalledWebApp` is true.

**Moving from the web app:** the native app cannot see the web app's storage. iOS onboarding adds a step: "Used Bookmark on the web? Create a sync file there and merge it here" (§9).

---

## 3. Scope

### 3.1 In scope

**Library and organisation**
- Books and fanfic in one library; search across title, authors, fandoms, relationships, characters, tags, summary and notes.
- Filters (modal), sort, active-filter chips, multi-select bulk actions.
- Favourites (private affinity signal).
- Shelves: the built-in **Up Next** queue, user manual shelves (ordered) and smart shelves (saved filters).
- Series grouping with "next in series".
- User tags, kept separate from AO3 tags.

**Reading tracking**
- Status (want to read, reading, completed, DNF) with derived states: caught up, new chapters, finished.
- Progress in pages, percent or minutes (books) and chapters (fanfic), with one-tap +1.
- Start, finish and last-read dates; re-reads with a read count; a reading history of status events.
- Notes as a private, dated journal per readable, optionally pinned to a chapter or page.

**AO3**
- Add by link (Android), capture tool (all platforms), pasted page text (all platforms).
- Update checks (Android fetch; capture on listing pages everywhere) with an updates inbox that puts archive-warning changes first.
- Content preferences: hide works with chosen archive warnings or ratings.
- Rec-list import: capture an AO3 collection, series or someone's public bookmarks and add the works to a shelf (§10.5).
- A gentle prompt to leave kudos or a comment on AO3 when you finish a fic (§12.13).

**Books**
- Google Books search, ISBN barcode scan (Android), manual entry, Goodreads CSV import (ratings ignored).
- Ownership (owned / not owned), a **To buy** shelf, and clearly labelled independent-bookshop links on books marked not owned (§12.12).

**Covers**
- An optional cover for any readable. Books: found by ISBN (Open Library) or taken from a Google Books result. Anything: chosen by the reader from an AO3 work's images, their photos or files, or an image link (Android).
- Fan art is always the reader's choice, credited to the artist, and kept private (§10.9).
- Stored on the device as small images; shown in lists and on the detail screen.

**Discovery**
- Home: continue reading, new chapters, Up Next, "pick something for me".
- A local, explainable next-read picker. No machine learning, no other people's data.
- Private reading stats (works finished, words and pages read, top fandoms, authors who made your year). No streaks or goals.

**Data**
- Backup and sync through the same `.bookmark` file: export, merge-import, optional passphrase encryption, merge summary, backup reminders.
- Imports: AO3 link lists (CSV/TXT), Goodreads CSV. Exports: `.bookmark` (full), CSV (readable by spreadsheets).

**Privacy, settings and support**
- Themes (system, light, dark, black), list density, content preferences, app lock and screen privacy (Android).
- Onboarding, about (not-affiliated statement, privacy policy, licences), feedback by email.
- Optional tips (Ko-fi on web; Google Play billing on Android only if enabled) and a public costs page with an iOS fund (§12.12).

### 3.2 Out of scope, with reasons

| Out of scope | Reason |
|---|---|
| Accounts, cloud sync services, any server holding user data | Principle 2 |
| Reviews, star ratings, scores, kudos/hits import, comments, public lists | Principle 3 |
| Reading or downloading work text; an in-app AO3 browser | Principle 3; AO3 is where works are read |
| Background or scheduled AO3 checks; push notifications | Principle 4; AO3 already offers subscription emails |
| Logging in to AO3 or handling AO3 credentials | Principle 3; the OTW warns users against giving credentials to apps |
| Automated import from other fanfic sites | Each site's terms differ; manual entry covers them |
| A native iOS app, for now | Apple's $99 yearly fee; planned once the public iOS fund covers a year (§19, Phase 6) |
| A paid iOS app | Charges iPhone readers for what everyone else gets free; paid AO3-related apps drew fandom backlash |
| Ads, subscriptions, paid features or paid unlocks, telemetry, third-party crash reporting | Principles 2 and 5. Tips are the only purchase and unlock nothing. Google Play's built-in Android vitals is acceptable |
| Mentioning or linking Ko-fi or any other way to pay inside the Android app or its Play listing | Google Play payments policy (§12.12); revisit if the UK's proposed steering rules take effect |
| Shopping or affiliate links on fanfic | Principle 3 |
| Recommendations from other users or ML | Principle 2; the picker is local and explainable |
| Fetching images from Instagram, Tumblr or other social sites; scraping Goodreads | Their terms prohibit automated collection; the reader saves the image and chooses it instead (§10.9) |
| Hot-linked covers (showing an image straight from another site) | Breaks offline use, expiring links break it, and it fails under the web app's cross-origin isolation; covers are stored on the device instead |
| Reading goals and streaks | They add pressure, not value; stats stay descriptive |
| Discreet mode (blurring summaries, tags or covers) | Not needed for now; content preferences hide works entirely. Revisit later (§22) |
| Live device-to-device sync | Research only (§9.7); file sync covers the need |
| Android home-screen widget | Research only; needs native code |

If a capability is not listed in §3.1, it is out of scope. If the user expands scope, implement it and say that scope changed.

---

## 4. Tech Stack

Expo managed workflow with development builds. Targets `android` and `web` (`ios` in Phase 6). Installed package versions are the source of truth for APIs.

**Baseline:** Expo SDK 58 · React Native 0.88 · React 19.3 · React Native Web 0.21 · Node 22.13 or later.

| Area | Choice | Rule |
|---|---|---|
| Routing | Expo Router (typed routes) | File-based routes give real web URLs, static export and deep links. |
| Tab navigation | Expo Router headless (JS) tabs on every platform | One `(tabs)/_layout.tsx` styled with Uniwind; a bottom tab bar below 900 px wide and a navigation rail at 900 px and wider. No native tabs on any platform, including iOS (§12.1). |
| Styling | Uniwind + Tailwind CSS v4 | `className` on React Native components. `global.css` at the project root is the theme root; light, dark and black themes are CSS variables. Semantic token classes only, no raw colours or hex values in components. |
| Components | Our own, in `src/shared/components/` | Built on plain React Native components with Uniwind classes. No component library. Every component meets §14 (48 dp targets, roles, labels, font scaling). |
| Interactive primitives | `@rn-primitives/*` (the unstyled primitives behind React Native Reusables) | Only for AlertDialog, DropdownMenu, Select and Portal, where focus, portals and dismissal are hard to get right. Styled with our tokens. Confirm with spike S17. |
| Date input | `@react-native-community/datetimepicker` (native); `<input type="date">` (web) | Behind the `dateInput` platform adapter, used only through the shared `DateField`. ISO strings in and out. |
| Storage | `expo-sqlite` on Android and web, behind the `Db` port (§5.3) | Web support is alpha and needs the WASM Metro config plus COOP/COEP headers; use `require-corp` because Safari does not support `credentialless` (spike S1). No AsyncStorage and no localStorage anywhere: all persistence, settings included, is SQLite. |
| Server state | TanStack Query v5 | Query keys from factories only. |
| Forms | React Hook Form + `@hookform/resolvers` + Zod (installed major) | `Controller` for every input component; validate on submit. |
| Validation | Zod 4.6.6 or later | Required minimum: earlier versions can exhaust memory on an oversized array that fails validation (GHSA-mrhx-c7xc-m3w5). Every array and string schema on untrusted input still carries the `.max()` caps from §9 and §10. |
| Layout | `react-native-safe-area-context` | `SafeAreaProvider` at root. |
| IDs and randomness | `expo-crypto` | `randomUUID()`, `getRandomValues()`. |
| Encryption | `@noble/ciphers`, `@noble/hashes` | Pure JS, same code on Android and web. Backup/sync file encryption only. |
| Files and sharing | `expo-file-system`, `expo-sharing`, `expo-document-picker` | Android. Web equivalents live in platform adapters. |
| Clipboard | `expo-clipboard` | Capture tool hand-off. |
| Share target | `expo-share-intent` | Android only. |
| App lock | `expo-local-authentication`, `expo-screen-capture` | Android only. |
| Barcodes | `expo-camera` | Android only, Phase 5. |
| Images | `expo-image-picker`, `expo-image-manipulator` | Pick covers (Android system photo picker; file input on web), resize and re-encode them. Both support Android and web. Broad media permissions are removed (§13.2). |
| Tips (Android, optional) | An in-app purchase library that works with Expo development builds (for example `react-native-iap`) | Consumable tip products through Google Play billing. No server and no receipt checks, because tips unlock nothing. Chosen and recorded in `CHANGELOG.md` only if Android tips are enabled (§12.12). |
| Keep awake | `expo-keep-awake` | During update checks. |
| Splash | `expo-splash-screen` | Held until the database is ready. |
| Linking | `expo-linking` | All `openURL` calls. |
| Web offline | Workbox (build-time dev dependency) | Generates the service worker for the static export. |
| HTTP | `fetch` via `httpClient` (§13.1) | AO3 requests always via `politeFetch`. |
| Tests | Jest (`jest-expo`), Testing Library, `better-sqlite3`, `fast-check`, Maestro (Android E2E), Playwright (web E2E) | Dev dependencies only. |
| Lint | ESLint with Expo's config | Dev dependency. Carries the architecture lint rules (§16). |
| Dependency patches | `patch-package` | Dev dependency, run on `postinstall`. Only for upstream bugs with a recorded reason in `CHANGELOG.md`; each patch is removed once the upstream fix ships. |

**Not used:** React Native Paper or any other styled component library; native tabs; blur libraries; chart libraries (the stats bar chart is plain Views).

Do not add a library when the stack covers the need. Any new dependency must be justified in `CHANGELOG.md` and added to this table.

---

## 5. Architecture

### 5.1 Layers

```
routes (app/)  →  feature UI  →  hooks  →  services / repositories  →  Db port · httpClient · platform adapters
                                   ↘ domain (pure) ↙
```

- **Domain** (`src/features/*/domain/`): pure TypeScript. No React, SQLite, network or platform imports. All business rules live here and are unit tested.
- **Repositories**: map rows to domain objects, validate shape, read, write, transact, and do persistence bookkeeping (ids, timestamps, HLC field clocks, tombstones). No product rules.
- **Services**: orchestrate multi-step flows (AO3 update, capture apply, sync merge, imports). They own transactions that span tables, using `db.transaction`.
- **Hooks**: connect UI to services and repositories through TanStack Query; call domain rules; never contain rules themselves.
- **Routes** (`app/`): thin. They compose feature UI and read route params. They never touch the database or network.
- **Shared components** (`src/shared/components/`): presentational building blocks with no data access. They may use platform adapters (for example `DateField` uses `dateInput`) but never split by platform themselves.
- **Platform adapters** (`src/platform/`): the only place `.native.ts(x)` / `.web.ts(x)` splits appear.

### 5.2 Rules at a glance

`CLAUDE.md` and the subagent definitions in `.claude/agents/` point here instead of repeating these rules. Where a rule can be checked mechanically, ESLint enforces it (§16).

- Complete code only: no placeholder or collapsed code (`// existing code`, `...`, or stubs standing in for logic). Shared types and domain files first, then their importers.
- Business rules are pure functions in `domain/`. Repositories and UI never contain them.
- Every database write goes through the `Db` port's write queue (§5.3). Multi-table writes use `db.transaction`.
- Every synced-table write bumps HLC field clocks; deletes are tombstones (§9).
- `Readable` is a discriminated union on `kind`; `kind` is immutable; `id` is the only identity; `sourceId` is an external reference.
- AO3-owned fields on AO3-sourced works are written only by AO3 updates (§6.5).
- Every AO3 request goes through `politeFetch`, is user-initiated, and never runs in the background.
- Capture payloads, pasted text and imported files are untrusted input: Zod-validate and size-cap before use.
- Network access only to the allowlisted hosts (§13.1).
- Covers are stored on the device as image data, never hot-linked; images are never fetched from social sites (§10.9).
- Platform differences only through `PlatformCapabilities` and platform adapters.
- Typed routes only. Uniwind semantic token classes only. All user-facing strings through `t()`.
- UI is built from our own components in `src/shared/components/`; `@rn-primitives` only for dialogs, menus, selects and portals.
- React Hook Form + Zod for every form; `Controller` for every input component.
- Keep native code iOS-ready: no Android-only shortcuts in shared code (§2.4).
- State conflicts explicitly; never expand scope silently.

### 5.3 Database port and write queue

```ts
// src/db/Db.ts
export type SqlParams = (string | number | null)[] | Record<string, string | number | null>;

export interface Db {
  run(sql: string, params?: SqlParams): Promise<{ changes: number }>;
  all<T>(sql: string, params?: SqlParams): Promise<T[]>;
  first<T>(sql: string, params?: SqlParams): Promise<T | null>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}
```

- **Implementations:** `createExpoDb` (Android and web, wraps `expo-sqlite`) and `createTestDb` (Node, wraps `better-sqlite3`, used by repository and migration tests).
- **Write queue:** both implementations serialise `run`, `exec` and `transaction` through one in-process queue; reads run freely. This matters because `expo-sqlite`'s `withTransactionAsync` is not exclusive (other queries can join it), and `withExclusiveTransactionAsync` is not supported on web. With every write queued, a long update check can never interleave with a tap on "favourite".
- On Android, `transaction` uses `withExclusiveTransactionAsync`; on web it uses `withTransactionAsync`, which is safe only because of the queue.
- On open (Android): `PRAGMA journal_mode = WAL`, `PRAGMA busy_timeout = 5000`. No `foreign_keys` pragma: there are no foreign keys, deliberately (§8.2).

### 5.4 Platform capabilities

```ts
// src/platform/capabilities.ts
export interface PlatformCapabilities {
  platform: 'android' | 'ios' | 'web';   // 'ios' from Phase 6 (§2.4)
  canFetchAo3: boolean;          // native (android, ios)
  canReceiveShares: boolean;     // native: android intent filter, ios share extension
  canAppLock: boolean;           // native
  canScanBarcodes: boolean;      // native
  canSearchGoogleBooks: boolean; // native; web if spike S5 passes
  canFetchCoverImages: boolean;  // automatic book covers: native; web if spike S9 passes
  canDownloadImageLinks: boolean;// AO3 page images and pasted image links: native
  canShowSupportLink: boolean;   // Ko-fi link: web only; always false in Play and App Store builds
  canTipInApp: boolean;          // store tips: android with ANDROID_TIPS_ENABLED; ios with IOS_TIPS_ENABLED
  isInstalledWebApp: boolean;    // web: display-mode standalone; native: true
}
```

UI hides, replaces or explains features from this object. Platform adapters (`files`, `clipboard`, `share`, `lock`, `keepAwake`, `persistStorage`, `dateInput`) expose one interface with `.native` and `.web` implementations.

### 5.5 Feature modules

| Module | Owns |
|---|---|
| `readables` | Readable model, progress/status rules, filters, search, library and detail UI |
| `notes` | Notes journal |
| `shelves` | Up Next, manual and smart shelves |
| `series` | Series keys, grouping, next-in-series |
| `ao3` | `politeFetch` use, work-page parser, copied-text parser, capture payloads, rec-list import, update planning, AO3-owned fields, author feedback prompt |
| `books` | Google Books, ISBN, barcode scan, Goodreads CSV import |
| `covers` | Cover model, sources, image processing, bulk book-cover job, cover picker |
| `updates` | Update check runs, check state, inbox |
| `discovery` | Home sections, next-read picker |
| `stats` | Reading stats |
| `sync` | HLC, merge, `.bookmark` file format, encryption, sync log |
| `settings` | Settings storage, appearance, content preferences, about, feedback |
| `support` | Tips (Play billing or Ko-fi), tip card, bookshop links, support copy |
| `privacy` | App lock, screen privacy |
| `onboarding` | First-run flow |

Inter-feature imports go through each module's `index.ts` only.

---

## 6. Domain Model

Location: `src/features/readables/domain/readable.ts` unless stated. Dates are ISO 8601 strings in every layer except display. "Now" always comes from an injected `Clock` (`src/shared/utils/clock.ts`) so tests control time.

### 6.1 Enums and constants

```ts
export type ReadableKind = 'book' | 'fanfic';
export type ReadableStatus = 'want_to_read' | 'reading' | 'completed' | 'dnf';
export type SourceType = 'manual' | 'ao3' | 'google_books';
export type BookProgressUnit = 'pages' | 'percent' | 'minutes';
export type ProgressUnit = BookProgressUnit | 'chapters';
export type BookFormat = 'print' | 'ebook' | 'audio';
export type AO3Rating = 'general' | 'teen' | 'mature' | 'explicit' | 'not_rated';
export type AuthorType = 'known' | 'anonymous' | 'orphaned';

export const AO3_RATING_LABELS: Record<AO3Rating, string> = {
  general: 'General Audiences',
  teen: 'Teen And Up Audiences',
  mature: 'Mature',
  explicit: 'Explicit',
  not_rated: 'Not Rated',
};

export const AO3_ARCHIVE_WARNINGS = [
  'No Archive Warnings Apply',
  'Creator Chose Not To Use Archive Warnings',
  'Graphic Depictions Of Violence',
  'Major Character Death',
  'Rape/Non-Con',
  'Underage',
] as const;

export const AO3_CATEGORIES = ['F/F', 'F/M', 'Gen', 'M/M', 'Multi', 'Other'] as const;
```

Status stays at four values. "Waiting for the author" is the derived *caught up* state (§6.6), not a status, so readers never have to maintain it by hand.

### 6.2 Readable (discriminated union)

```ts
interface ReadableBase {
  id: string;                        // Crypto.randomUUID(); immutable; primary identity
  title: string;
  authors: string[];                 // [] when unknown; AO3 co-creators and multi-author books
  status: ReadableStatus;            // default 'want_to_read'
  progressCurrent: number | null;    // position in progressUnitFor(readable)
  totalUnits: number | null;         // book: total pages/minutes (100 for percent); fanfic: planned final chapters
  sourceType: SourceType;            // immutable
  sourceUrl: string | null;
  sourceId: string | null;           // AO3 work id or Google Books volume id; immutable
  summary: string | null;
  userTags: string[];                // user-owned; never touched by AO3 updates
  isFavourite: boolean;              // private
  seriesKey: string | null;          // §7.6
  seriesName: string | null;
  seriesPart: number | null;
  seriesTotal: number | null;
  startedAt: string | null;          // set when reading first starts (or a re-read starts)
  finishedAt: string | null;         // most recent finish
  lastReadAt: string | null;         // last progress or status change
  readCount: number;                 // completed reads, including re-reads
  dateAdded: string;                 // user-facing, backdatable, never in the future
  createdAt: string;                 // set once by the repository
  updatedAt: string;                 // set by the repository on every write
}

export interface Book extends ReadableBase {
  kind: 'book';
  progressUnit: BookProgressUnit;    // default 'pages'; 'minutes' suits audiobooks
  format: BookFormat | null;
  isbn13: string | null;
  publishedDate: string | null;      // from Google Books when available
  isOwned: boolean | null;           // null = not set; only false can show a bookshop link (§7.13)
}

export interface Fanfic extends ReadableBase {
  kind: 'fanfic';
  isComplete: boolean;               // false = WIP; manual default false
  isAbandoned: boolean;              // user annotation; independent of isComplete
  availableChapters: number | null;  // chapters posted (left side of AO3 "X/Y")
  wordCount: number | null;          // null = unknown, never 0
  fandoms: string[];
  relationships: string[];           // preserves AO3 "/" and "&"
  characters: string[];
  categories: string[];              // values from AO3_CATEGORIES
  ao3Tags: string[];                 // AO3 freeform tags; AO3-owned
  rating: AO3Rating | null;
  archiveWarnings: string[];         // strings, not an enum, so AO3 changes never break parsing
  authorType: AuthorType | null;
  publishedAt: string | null;
  ao3UpdatedAt: string | null;       // AO3 "Updated:" or "Completed:" date
}

export type Readable = Book | Fanfic;
```

Keep four shapes separate and map explicitly: domain model, persistence row, remote snapshot (`Ao3Snapshot`, Google Books result), form model.

### 6.3 Notes journal

Location: `src/features/notes/domain/note.ts`.

```ts
export interface ReadableNote {
  id: string;
  readableId: string;
  body: string;                      // plain text, non-empty after trimming
  position: number | null;           // optional chapter/page/percent the note refers to
  createdAt: string;
  updatedAt: string;
}
```

- Notes are a dated journal: a readable can have any number. A reader who wants one running note simply edits a single entry.
- Notes are private and are never reviews: no scores, nothing shared or posted (principle 3).
- Only the user writes notes. Imports, captures and AO3 updates never create or change them.
- Saving an empty or whitespace-only body deletes the note (tombstone).
- Separate rows make sync safe: two devices adding notes to the same work both keep their notes (§9.3).

### 6.4 Shelves, history and updates

```ts
// src/features/shelves/domain/shelf.ts
export interface Shelf {
  id: string;                        // 'shelf_up_next' for the system shelf, UUID otherwise
  name: string;
  type: 'manual' | 'smart';
  systemKey: 'up_next' | null;
  filters: ReadableFilters | null;   // smart shelves only
  sourceName: string | null;         // rec-list shelves: the list's name
  sourceUrl: string | null;          // rec-list shelves: the list's AO3 address
  sortKey: string;                   // fractional index; order of shelves in the list
  createdAt: string;
  updatedAt: string;
}

export interface ShelfItem {
  id: string;                        // `${shelfId}:${readableId}`, deterministic so the same membership made on two devices merges
  shelfId: string;
  readableId: string;
  position: string;                  // fractional index within the shelf
  addedAt: string;
}

// src/features/readables/domain/readingEvent.ts
export type ReadingEventType = 'started' | 'finished' | 'dnf' | 'reread_started';
export interface ReadingEvent {
  id: string;
  readableId: string;
  type: ReadingEventType;
  at: string;
  wordsAtEvent: number | null;       // fanfic wordCount when the event happened (for stats)
  unitsAtEvent: number | null;       // totalUnits when the event happened
}

// src/features/updates/domain/wipUpdate.ts
export interface WipUpdate {
  id: string;
  readableId: string;
  readableTitle: string;             // snapshot, survives deletion of the readable
  readableAuthors: string[];
  source: 'fetch' | 'capture';
  kind: 'changed' | 'not_found' | 'restricted';
  checkedAt: string;
  isRead: boolean;
  changes: Ao3Change[];              // empty for not_found / restricted
  statusReverted: boolean;
  hasSafetyChange: boolean;          // archive warnings or rating changed
}
```

### 6.5 Input types and AO3-owned fields

```ts
export type CreateBookInput = Omit<Book, 'id' | 'createdAt' | 'updatedAt'>;
export type CreateFanficInput = Omit<Fanfic, 'id' | 'createdAt' | 'updatedAt'>;
export type CreateReadableInput = CreateBookInput | CreateFanficInput; // id and timestamps are generated by the repository

type CommonPatch = Partial<Pick<ReadableBase,
  | 'title' | 'authors' | 'status' | 'progressCurrent' | 'totalUnits' | 'sourceUrl'
  | 'summary' | 'userTags' | 'isFavourite' | 'seriesKey' | 'seriesName' | 'seriesPart'
  | 'seriesTotal' | 'startedAt' | 'finishedAt' | 'lastReadAt' | 'readCount' | 'dateAdded'>>;

export type BookPatch = { kind: 'book' } & CommonPatch &
  Partial<Pick<Book, 'progressUnit' | 'format' | 'isbn13' | 'publishedDate' | 'isOwned'>>;

export type FanficPatch = { kind: 'fanfic' } & CommonPatch &
  Partial<Pick<Fanfic, 'isComplete' | 'isAbandoned' | 'availableChapters' | 'wordCount'
    | 'fandoms' | 'relationships' | 'characters' | 'categories' | 'ao3Tags' | 'rating'
    | 'archiveWarnings' | 'authorType' | 'publishedAt' | 'ao3UpdatedAt'>>;

export type ReadablePatch = BookPatch | FanficPatch;
```

- A patch's `kind` must equal the stored kind; the repository rejects a mismatch with a `validation` error. Because the patch is a union, a fanfic-only field on a book is a compile error.
- `id`, `kind`, `sourceType`, `sourceId`, `createdAt` and `updatedAt` are never patchable.

**AO3-owned fields.** For a fanfic with `sourceType === 'ao3'`, these fields belong to AO3 and change only through AO3 updates (§7.5):

```ts
export const AO3_OWNED_FIELDS = [
  'title', 'authors', 'authorType', 'summary', 'fandoms', 'relationships', 'characters',
  'categories', 'ao3Tags', 'rating', 'archiveWarnings', 'availableChapters', 'totalUnits',
  'wordCount', 'isComplete', 'publishedAt', 'ao3UpdatedAt',
  'seriesKey', 'seriesName', 'seriesPart', 'seriesTotal',
] as const;
```

- The edit form shows them read-only with "From AO3 — refresh or capture to update".
- `stripAo3OwnedFields(readable, patch)` (domain) removes them from user patches; hooks apply it before writing.
- Everything else (status, progress, dates, read count, user tags, favourite, abandoned flag, shelves, notes) is user-owned and never touched by AO3 updates.
- Manual fanfic (`sourceType === 'manual'`) owns nothing: every field is user-editable.
- Google Books data is prefill only: after creation, every book field is user-editable and there is no refresh.

### 6.6 Derived values (never stored)

```ts
export type ReadingState = 'not_started' | 'in_progress' | 'caught_up' | 'new_chapters' | 'finished' | 'dnf';
```

| Function | Returns |
|---|---|
| `progressUnitFor(r)` | `'chapters'` for fanfic; `r.progressUnit` for books |
| `progressCeiling(r)` | Fanfic: `availableChapters ?? totalUnits ?? null`. Book: `100` for percent, else `totalUnits` |
| `isFinalPosition(r, p)` | Book: `p` equals a known ceiling. Fanfic: `isComplete` and `p === totalUnits` (known) |
| `chaptersBehind(f)` | `availableChapters − (progressCurrent ?? 0)` when status is `reading` or `completed` and `availableChapters` is known; otherwise 0 |
| `readingStateOf(r)` | `'not_started'` · `'in_progress'` · `'caught_up'` (WIP, reading, at the last posted chapter) · `'new_chapters'` (`chaptersBehind > 0` on a reading or completed WIP) · `'finished'` · `'dnf'` |
| `displayAuthors(r)` | Joined authors; "Anonymous" or "Orphaned work" from `authorType` |
| `notesUpdatedAt(notes)` | Latest note `updatedAt`, for "Notes updated …" |

**Progress display**
- Book (pages): `"125 / 420 pages"`; percent: `"42%"`; minutes: `"3 h 05 / 9 h 40"`.
- Fanfic detail: `"Chapter 8 of 48 posted (50 planned)"`; unknown total `"Chapter 8 of 48 posted"`.
- Fanfic list item: `"ch. 8 / 48 · 50"` or `"ch. 8 / 48 · ?"`, plus a `"3 new"` badge when `chaptersBehind > 0`.

### 6.7 Covers

Location: `src/features/covers/domain/cover.ts`.

```ts
export type CoverSource = 'open_library' | 'google_books' | 'ao3_page' | 'image_link' | 'device';
export type CoverSize = 'thumb' | 'full';

export interface Cover {
  readableId: string;            // one cover per readable
  source: CoverSource;
  isFanArt: boolean;             // true by default for ao3_page; the reader can change it
  creditName: string | null;     // artist name, shown as "Cover art by …"
  creditUrl: string | null;      // where the art lives (the AO3 work, the artist's post)
  originUrl: string | null;      // address it was downloaded from, if any; never used for display
  mime: 'image/jpeg';
  width: number;                 // of the full-size variant
  height: number;
  createdAt: string;
  updatedAt: string;
}
```

- Covers are optional. A readable without one shows a generated placeholder (initials on a theme-token background), never a network image.
- Each cover is stored as two JPEG variants: `thumb` (160 px wide) for lists and `full` (600 px wide, at most 1,000 px tall) for the detail screen. The domain object carries metadata only; image bytes load through `useCoverImage(readableId, size)`.
- Covers are decoration, not metadata: they are not part of `Readable`, not AO3-owned, and AO3 updates never change them.

---

## 7. Domain Rules (pure functions)

All functions here are pure, live in `domain/` folders, take time and randomness as arguments, and are unit tested.

### 7.1 Progress and status: `applyProgressChange`

```ts
export type ProgressChange =
  | { status: ReadableStatus }
  | { progressCurrent: number | null }
  | { increment: 1 }
  | { startReread: true };

export type ProgressResult =
  | { ok: true; patch: ReadablePatch; events: Omit<ReadingEvent, 'id'>[] }
  | { ok: false; error: AppError };   // code 'validation'

applyProgressChange(current: Readable, change: ProgressChange, now: string): ProgressResult
```

| Trigger | Result |
|---|---|
| Progress set above 0 while `want_to_read` | status → `reading`; `startedAt` = now if null; event `started` |
| Progress reaches a final position (`isFinalPosition`) | status → `completed`; `finishedAt` = now; `readCount` + 1; event `finished` |
| Fanfic WIP progress reaches `availableChapters` | stays `reading`; derived state becomes `caught_up`; no auto-complete |
| Status set to `completed` | Book with known ceiling or complete fanfic with known total: progress = that value. WIP fanfic: progress = `availableChapters` if known ("finished what's posted"). Then `finishedAt`, `readCount` + 1, event `finished` |
| Status set to `dnf` | progress preserved; event `dnf` |
| Status set to `want_to_read` | progress → null; dates and read count unchanged |
| Status set to `reading` from `want_to_read` | `startedAt` = now if null; event `started` |
| Progress lowered below the final position while `completed` | status → `reading` (correction or re-read); `readCount` unchanged |
| `startReread` (only from `completed` or `dnf`) | status → `reading`; progress → null; `startedAt` = now; event `reread_started` |
| Any progress or status change | `lastReadAt` = now |

Validation (returns a `validation` error instead of a patch): progress and totals are non-negative integers; percent is 0–100; progress ≤ `progressCeiling` when known; for fanfic, `availableChapters` ≤ `totalUnits` when both known.

`increment` adds one unit (one chapter, page or percent) and then applies the rules above, which is what the list's one-tap +1 uses.

### 7.2 Filters, search and sort

```ts
// src/features/readables/domain/readableFilters.ts
export interface ReadableFilters {
  version: 1;
  kind?: ReadableKind;
  status?: ReadableStatus[];             // OR
  readingState?: ReadingState[];         // OR; e.g. ['new_chapters']
  favouritesOnly?: boolean;
  shelfId?: string;
  seriesOnly?: boolean;
  ownership?: 'owned' | 'not_owned';     // books only; 'not_owned' means isOwned === false
  isComplete?: boolean;                  // fanfic only
  isAbandoned?: boolean;                 // fanfic only; true = only, false = hide
  fandoms?: string[];                    // fanfic only; OR, case-insensitive exact
  relationships?: string[];              // fanfic only; OR
  characters?: string[];                 // fanfic only; OR
  ratings?: AO3Rating[];                 // fanfic only; OR
  categories?: string[];                 // fanfic only; OR
  excludeWarnings?: string[];            // fanfic only; hide works carrying ANY of these
  includeTags?: string[];                // AND over userTags ∪ ao3Tags
  excludeTags?: string[];                // NONE over userTags ∪ ao3Tags
  lengthMin?: number;                    // words (fanfic) or pages (books)
  lengthMax?: number;
  search?: string;
  sortBy?: 'dateAdded' | 'title' | 'author' | 'updatedAt' | 'lastReadAt'
         | 'length' | 'chaptersBehind' | 'ao3UpdatedAt';
  sortOrder?: 'asc' | 'desc';
}
export const DEFAULT_FILTERS: ReadableFilters = { version: 1, sortBy: 'dateAdded', sortOrder: 'desc' };
```

- `applyFilters(readables, notesByReadable, filters, prefs): FilterResult`, where `FilterResult = { items: Readable[]; matchedIn: Record<string, 'title' | 'authors' | 'tags' | 'summary' | 'notes' | 'other'>; hiddenByPrefsCount: number }`. Axes combine with AND. Fanfic-only filters never match books.
- **Content preferences apply first** (§7.8), so hidden works never appear unless the user taps "Show hidden".
- **Search:** case- and diacritic-insensitive (`NFKD`, strip marks); whitespace-separated terms are ANDed; `"quoted phrases"` match exactly. Fields: title, authors, fandoms, relationships, characters, user and AO3 tags, summary, note bodies. Results record which field matched so the list can show "matched in notes".
- **Sort:** `length` is words for fanfic and pages for books. Nulls sort last in both directions. `chaptersBehind` sorts descending by default.
- Also exported: `countActiveFilters(filters)` (badge: one per non-empty axis, one per tag, one for non-default sort), `describeFilters(filters)` (chip labels), `buildVocabulary(readables, field, kind?)` (tags, fandoms, relationships, characters).
- Filtering runs in JavaScript over the full list. Performance budget: under 100 ms for 5,000 readables on a mid-range Android phone. If the budget is missed, add a list projection before touching SQL.

### 7.3 Duplicate detection

- AO3: same `sourceId` (work id). The unique index (§8.2) is the backstop; the app checks first and offers to open the existing entry.
- Books: same `isbn13`, or same Google Books volume id.
- Manual entries: if normalised title plus first author matches an existing readable, show "Looks like you already have this" and let the user continue.
- During sync, duplicates are merged rather than rejected (§9.3).

### 7.4 Status events and stats inputs

Every result of `applyProgressChange` that includes events is written in the same transaction as the patch. Events are append-only; the user can delete a history entry from the detail screen (tombstone).

### 7.5 AO3 updates: `planAo3Update`

Location: `src/features/ao3/domain/ao3Update.ts`. One function serves single refresh, update checks and capture.

```ts
planAo3Update(current: Fanfic, incoming: Ao3Snapshot, now: string): Ao3UpdatePlan

export interface Ao3UpdatePlan {
  changed: boolean;                  // false → write nothing
  patch: FanficPatch;                // AO3-owned fields only
  changes: Ao3Change[];              // field, before, after, severity ('safety' | 'progress' | 'info')
  statusPatch: { status: 'reading' } | null;
  statusReverted: boolean;
  suggestMarkFinished: boolean;      // work became complete and the reader is on the last chapter
}
```

- **Change detection compares the AO3-owned fields directly** (arrays as sets), not the AO3 updated date. The page has already been read, so comparing is free, and it also catches edits that do not change the date, such as new archive warnings.
- **Unknown versus empty:** in `Ao3Snapshot`, `undefined` means "this source did not include the field" (for example a listing page has no published date) and leaves the stored value alone; `null` or `[]` means "present and empty" and overwrites it.
- **Status reversion:** if `status === 'completed'` and incoming `availableChapters` > (`progressCurrent` ?? 0), status becomes `reading` and `statusReverted = true`. This works for `?` totals, which most WIPs have.
- **Completion:** if the work changes from WIP to complete and the reader is caught up, nothing changes automatically; the inbox offers "Mark finished" (`suggestMarkFinished`).
- **Severity:** archive warning or rating changes are `safety` and are shown first and never collapsed. Chapter, total and completion changes are `progress`. Everything else is `info`.
- User-owned fields, including `isAbandoned`, are never in the patch.

### 7.6 Series

- `seriesKey`: `'ao3:<seriesId>'` for AO3 series, otherwise `'name:<normalised series name>'`. Readables sharing a key form a series.
- `seriesOverview(readables, key)` returns the parts in library order by `seriesPart`, the highest finished part, `nextPart` (the lowest part above the highest finished part that is in the library), and `missingParts` when `seriesTotal` is known. Missing AO3 parts link to `https://archiveofourown.org/series/<seriesId>`.
- Display: `"Part 2 of 7 in <name>"`, `"Part 2 of ? in <name>"`, `"Part of <name>"`.
- A work in several AO3 series stores its first series only.

### 7.7 Shelves

- **Up Next** is a system manual shelf with the fixed id `shelf_up_next`, created by migration on every device, so it never duplicates in sync. It cannot be renamed or deleted and is pinned first. Its seed row is identical on every device: `name` `'Up Next'` (shown through `t()`, keyed by `systemKey`, never by the stored name), `type` `'manual'`, `system_key` `'up_next'`, `sort_key` `'a0'`, `created_at` and `updated_at` `'1970-01-01T00:00:00.000Z'`, `updated_hlc` `GENESIS_HLC`, and every field in `field_clocks` stamped with `GENESIS_HLC` (§9.2). Because the seed is the same everywhere and its clocks are the lowest possible, any real edit wins a merge.
- Manual shelves are ordered by fractional-index `position` strings (`fractionalKeyBetween(a, b)` in `src/shared/utils/fractionalIndex.ts`), so a reorder writes one row and merges cleanly.
- Smart shelves store `ReadableFilters` (versioned). Opening one runs `applyFilters`. "Save as shelf" on the library creates one from the active filters.
- A readable can be on any number of shelves. Tombstoning a readable hides its shelf items without deleting them, so restoring it restores its shelves.
- Shelves created from a rec list keep `sourceName` and `sourceUrl` and show "From <name>" with a link to the list (§10.5).
- **Suggested shelf:** the Shelves tab offers a one-tap **To buy** smart shelf (`{ kind: 'book', ownership: 'not_owned', status: ['want_to_read', 'reading'] }`) once any book is marked not owned. It is an ordinary smart shelf the reader can rename or delete.

### 7.8 Content preferences

```ts
export interface ContentPreferences {
  hiddenWarnings: string[];          // works carrying any of these are hidden everywhere
  hiddenRatings: AO3Rating[];
}
```

- Applied before filters in the library, shelves, picker, Home and stats lists. Never applied to the inbox, because a safety change on a work you already have must always be visible.
- Hidden counts are shown ("4 hidden by your content settings · Show").
- Content preferences are the one setting that travels in sync files (§9.4).

### 7.9 Next-read picker: `pickNextRead`

Location: `src/features/discovery/domain/pickNextRead.ts`. Answers "suggest my next read" without other people's data or machine learning.

```ts
pickNextRead(input: {
  readables: Readable[]; shelfItems: ShelfItem[]; events: ReadingEvent[];
  criteria: PickCriteria; prefs: ContentPreferences; skippedIds: string[];
  now: string; random: () => number;
}): PickResult

export interface PickResult {
  pick: Readable | null;
  alternates: Readable[];             // up to 2
  reasons: Record<string, string>;    // readable id → strongest reason
  emptiedBy?: keyof PickCriteria;     // when pick is null
}

export interface PickCriteria {
  kind?: ReadableKind;
  length?: 'quick' | 'short' | 'medium' | 'long';  // fanfic <10k / 10–40k / 40–100k / >100k words; books <150 / 150–300 / 300–500 / >500 pages
  completeOnly?: boolean;                           // skip WIPs
  ownedOnly?: boolean;                              // books: only books you own ("pick from my own shelves")
  fandom?: string;
  shelfId?: string;
}
```

- **Pool:** `want_to_read` readables matching the criteria and content preferences, minus `skippedIds` (this session's "Not now" picks).
- **Weights:** base 1. On Up Next ×3 ("On your Up Next"). Next part of a series you finished a part of ×2 ("Next in <series>"). Added more than six months ago ×1.5 ("Waiting since <month year>"). Same fandom or author as something finished in the last 90 days ×1.5 ("You've been reading <fandom>"). Favourite author ×1.5.
- Weighted random choice using the injected `random`; two alternates from the rest of the pool. Each result carries its strongest reason.
- Empty pool: return `pick: null` and the criterion that emptied it, so the UI can suggest relaxing it.

### 7.10 Stats: `computeStats`

Location: `src/features/stats/domain/computeStats.ts`. `computeStats(readables, events, year, prefs)` returns, for the year: works finished (books, fanfic), re-reads, DNFs, words read (sum of `wordsAtEvent` on `finished` fanfic events), pages read (finished books in pages), finishes per month, top fandoms by finishes, longest work finished, and **authors who made your year**: up to 10 authors ranked by works finished that year (ties broken by words read, then name), each with their finished works and links. Anonymous and orphaned works are grouped as "Anonymous and orphaned works" with no link. Ranking is by what you finished, never by ratings. Descriptive only: no goals, streaks or comparisons.

### 7.11 Update check targets: `selectWipCheckTargets`

Location: `src/features/updates/domain/wipCheckTargets.ts`.

`selectWipCheckTargets(readables, checkState, opts: { scope: 'all' | 'favourites' | 'up_next'; includeAbandoned: boolean; limit: number }): Fanfic[]`

- A target is a fanfic with `sourceType === 'ao3'`, `isComplete === false`, a `sourceId`, not tombstoned, in scope, and not abandoned unless `includeAbandoned`.
- Order: never-checked first, then oldest `lastCheckedAt`. Truncate to `limit` (default 60, §22). An interrupted run therefore resumes where it stopped.

### 7.12 Covers

Location: `src/features/covers/domain/`.

- `coverVisibility(cover, surface, settings): 'show' | 'placeholder'`. `placeholder` when there is no cover or `cover_display` hides covers on this surface (`'list' | 'detail'`). Otherwise `show`.
- `coverCandidatesFromSnapshot(snapshot)` turns `Ao3Snapshot.imageUrls` into picker options: https only, de-duplicated, page order, at most 10.
- `defaultCredit(source, readable)` pre-fills credit: for `ao3_page`, `creditUrl` is the work URL and `isFanArt` is true; for `device` and `image_link`, the fields start empty and the reader is prompted (not required) to fill them.
- `selectCoverFetchTargets(readables, coverMeta, fetchState, limit)` for the bulk book-cover job: live books with an `isbn13`, no live cover, and no `none` result in `cover_fetch_state` from the last 90 days; newest `dateAdded` first; truncated to `limit` (default 200).
- `validateImageInput(meta)` accepts JPEG, PNG, WebP and HEIC/HEIF (phone photos) up to 10 MB and at least 32 × 32 px; anything else is rejected with a plain message.

### 7.13 Bookshop links and tip card

Location: `src/features/support/domain/`.

- `bookshopLinkFor(book, settings, storefronts): { url: string; storefront: string } | null` returns a link only when **all** hold: `isOwned === false`; status is `want_to_read` or `reading`; `isbn13` is present; `show_bookshop_links` is on; and a Bookshop.org storefront is configured for the reader's region (`bookshop_region`, or the device locale's region when `auto`). Otherwise `null`. Fanfic never gets a link because `isOwned` exists only on books.
- The URL is built from the storefront's configured template and affiliate id (`BOOKSHOP_STOREFRONTS`, spike S13 confirms the format).
- `shouldShowTipCard(settings, capabilities, now)` is true only when a tip route exists (`canTipInApp` or `canShowSupportLink`), `first_used_at` is at least 30 days ago, and `tip_card_dismissed` is false.

### 7.14 Author feedback prompt

Location: `src/features/ao3/domain/authorFeedback.ts`.

`shouldPromptAuthorFeedback(readable, trigger, settings, nudgeState): boolean`, where `trigger` is `'finished'` (a `finished` event) or `'caught_up'` (a WIP reaching its last posted chapter). True only when **all** hold:

- The readable is fanfic with a page to open: `sourceType === 'ao3'`, or manual fanfic with an https `sourceUrl`.
- `author_feedback_prompt` allows the trigger: `finished` allows finishes only; `finished_and_caught_up` also allows caught-up WIPs; `off` allows nothing.
- It has not been shown for this read already: for finishes, `nudgeState.readCountAtShow` differs from the new `readCount`; for caught-up, `nudgeState.chaptersAtShow` differs from `availableChapters`.

The app never records or guesses whether the reader left kudos or a comment.

---

## 8. Persistence

### 8.1 Startup and providers

- The root layout (`app/_layout.tsx`) imports `global.css`, keeps the splash screen up, opens the database, runs migrations, loads settings, then renders. If migrations fail, it shows the database error screen (§8.5) instead of the app.
- Provider order (outer → inner): `DatabaseProvider` → `SettingsProvider` → `SafeAreaProvider` → `ThemeProvider` (applies the saved theme through Uniwind) → `QueryClientProvider` → `PortalHost` (`@rn-primitives`) → `AppLockGate` (Android) → router `Stack`.
- The database and settings sit outside `ThemeProvider` so the first frame already uses the saved theme.
- `useDb()` returns the `Db` port and throws a clear error if used outside the provider.

### 8.2 Schema (`001_initial.ts`)

Synced tables share three columns: `field_clocks` (JSON map of field → HLC), `updated_hlc` (max clock in the row) and `deleted_at` (tombstone time, null when live). There are **no foreign keys**: sync can deliver a note before its readable, and tombstoned parents keep their children.

```sql
-- ===== synced =====
CREATE TABLE readables (
  id                 TEXT PRIMARY KEY NOT NULL,
  kind               TEXT NOT NULL CHECK (kind IN ('book','fanfic')),
  title              TEXT NOT NULL,
  authors            TEXT NOT NULL DEFAULT '[]',
  status             TEXT NOT NULL DEFAULT 'want_to_read'
                     CHECK (status IN ('want_to_read','reading','completed','dnf')),
  progress_current   INTEGER CHECK (progress_current IS NULL OR progress_current >= 0),
  total_units        INTEGER CHECK (total_units IS NULL OR total_units >= 0),
  source_type        TEXT NOT NULL CHECK (source_type IN ('manual','ao3','google_books')),
  source_url         TEXT,
  source_id          TEXT,
  summary            TEXT,
  user_tags          TEXT NOT NULL DEFAULT '[]',
  is_favourite       INTEGER NOT NULL DEFAULT 0 CHECK (is_favourite IN (0,1)),
  series_key         TEXT,
  series_name        TEXT,
  series_part        INTEGER,
  series_total       INTEGER,
  started_at         TEXT,
  finished_at        TEXT,
  last_read_at       TEXT,
  read_count         INTEGER NOT NULL DEFAULT 0 CHECK (read_count >= 0),
  date_added         TEXT NOT NULL,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  -- book-only
  progress_unit      TEXT CHECK (progress_unit IS NULL OR progress_unit IN ('pages','percent','minutes')),
  book_format        TEXT CHECK (book_format IS NULL OR book_format IN ('print','ebook','audio')),
  isbn13             TEXT,
  published_date     TEXT,
  is_owned           INTEGER CHECK (is_owned IS NULL OR is_owned IN (0,1)),
  -- fanfic-only
  is_complete        INTEGER CHECK (is_complete IS NULL OR is_complete IN (0,1)),
  is_abandoned       INTEGER CHECK (is_abandoned IS NULL OR is_abandoned IN (0,1)),
  available_chapters INTEGER CHECK (available_chapters IS NULL OR available_chapters >= 0),
  word_count         INTEGER CHECK (word_count IS NULL OR word_count > 0),
  fandoms            TEXT NOT NULL DEFAULT '[]',
  relationships      TEXT NOT NULL DEFAULT '[]',
  characters         TEXT NOT NULL DEFAULT '[]',
  categories         TEXT NOT NULL DEFAULT '[]',
  ao3_tags           TEXT NOT NULL DEFAULT '[]',
  rating             TEXT CHECK (rating IS NULL OR rating IN ('general','teen','mature','explicit','not_rated')),
  archive_warnings   TEXT NOT NULL DEFAULT '[]',
  author_type        TEXT CHECK (author_type IS NULL OR author_type IN ('known','anonymous','orphaned')),
  published_at       TEXT,
  ao3_updated_at     TEXT,
  -- sync
  field_clocks       TEXT NOT NULL DEFAULT '{}',
  updated_hlc        TEXT NOT NULL,
  deleted_at         TEXT,
  CHECK (kind = 'book'   OR (is_complete IS NOT NULL AND is_abandoned IS NOT NULL)),
  CHECK (kind = 'fanfic' OR (progress_unit IS NOT NULL AND is_complete IS NULL AND is_abandoned IS NULL
                             AND available_chapters IS NULL AND word_count IS NULL AND rating IS NULL
                             AND author_type IS NULL)),
  CHECK (kind = 'book'   OR (progress_unit IS NULL AND book_format IS NULL AND isbn13 IS NULL AND is_owned IS NULL))
);
CREATE UNIQUE INDEX uq_readables_source ON readables (source_type, source_id)
  WHERE source_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_readables_isbn ON readables (isbn13) WHERE isbn13 IS NOT NULL;
CREATE INDEX idx_readables_live ON readables (deleted_at);

CREATE TABLE notes (
  id            TEXT PRIMARY KEY NOT NULL,
  readable_id   TEXT NOT NULL,
  body          TEXT NOT NULL,
  position      INTEGER,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  field_clocks  TEXT NOT NULL DEFAULT '{}',
  updated_hlc   TEXT NOT NULL,
  deleted_at    TEXT
);
CREATE INDEX idx_notes_readable ON notes (readable_id);

CREATE TABLE shelves (
  id            TEXT PRIMARY KEY NOT NULL,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('manual','smart')),
  system_key    TEXT CHECK (system_key IS NULL OR system_key IN ('up_next')),
  filters_json  TEXT,
  source_name   TEXT,
  source_url    TEXT,
  sort_key      TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  field_clocks  TEXT NOT NULL DEFAULT '{}',
  updated_hlc   TEXT NOT NULL,
  deleted_at    TEXT,
  CHECK ((type = 'smart') = (filters_json IS NOT NULL))
);

CREATE TABLE shelf_items (
  id            TEXT PRIMARY KEY NOT NULL,      -- `${shelf_id}:${readable_id}`
  shelf_id      TEXT NOT NULL,
  readable_id   TEXT NOT NULL,
  position      TEXT NOT NULL,
  added_at      TEXT NOT NULL,
  field_clocks  TEXT NOT NULL DEFAULT '{}',
  updated_hlc   TEXT NOT NULL,
  deleted_at    TEXT
);
CREATE INDEX idx_shelf_items_shelf ON shelf_items (shelf_id, position);
CREATE INDEX idx_shelf_items_readable ON shelf_items (readable_id);

CREATE TABLE reading_events (
  id              TEXT PRIMARY KEY NOT NULL,
  readable_id     TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('started','finished','dnf','reread_started')),
  at              TEXT NOT NULL,
  words_at_event  INTEGER,
  units_at_event  INTEGER,
  field_clocks    TEXT NOT NULL DEFAULT '{}',
  updated_hlc     TEXT NOT NULL,
  deleted_at      TEXT
);
CREATE INDEX idx_events_readable ON reading_events (readable_id, at);
CREATE INDEX idx_events_at ON reading_events (type, at);

CREATE TABLE id_aliases (
  alias_id      TEXT PRIMARY KEY NOT NULL,
  canonical_id  TEXT NOT NULL,
  created_hlc   TEXT NOT NULL
);

CREATE TABLE covers (
  readable_id   TEXT PRIMARY KEY NOT NULL,
  source        TEXT NOT NULL
                CHECK (source IN ('open_library','google_books','ao3_page','image_link','device')),
  is_fan_art    INTEGER NOT NULL DEFAULT 0 CHECK (is_fan_art IN (0,1)),
  credit_name   TEXT,
  credit_url    TEXT,
  origin_url    TEXT,
  mime          TEXT NOT NULL CHECK (mime IN ('image/jpeg')),
  width         INTEGER NOT NULL CHECK (width > 0),
  height        INTEGER NOT NULL CHECK (height > 0),
  thumb_data    BLOB NOT NULL,
  image_data    BLOB NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  field_clocks  TEXT NOT NULL DEFAULT '{}',
  updated_hlc   TEXT NOT NULL,
  deleted_at    TEXT
);

-- ===== device-local (never synced) =====
CREATE TABLE wip_updates (
  id                TEXT PRIMARY KEY NOT NULL,
  readable_id       TEXT NOT NULL,
  readable_title    TEXT NOT NULL,
  readable_authors  TEXT NOT NULL DEFAULT '[]',
  source            TEXT NOT NULL CHECK (source IN ('fetch','capture')),
  kind              TEXT NOT NULL CHECK (kind IN ('changed','not_found','restricted')),
  checked_at        TEXT NOT NULL,
  is_read           INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0,1)),
  changes_json      TEXT NOT NULL DEFAULT '[]',
  status_reverted   INTEGER NOT NULL DEFAULT 0 CHECK (status_reverted IN (0,1)),
  has_safety_change INTEGER NOT NULL DEFAULT 0 CHECK (has_safety_change IN (0,1))
);
CREATE INDEX idx_wip_updates_inbox ON wip_updates (is_read, checked_at);

CREATE TABLE ao3_check_state (
  readable_id      TEXT PRIMARY KEY NOT NULL,
  last_checked_at  TEXT NOT NULL,
  last_result      TEXT NOT NULL
                   CHECK (last_result IN ('unchanged','changed','not_found','restricted','failed'))
);

CREATE TABLE cover_fetch_state (
  readable_id    TEXT PRIMARY KEY NOT NULL,
  last_tried_at  TEXT NOT NULL,
  last_result    TEXT NOT NULL CHECK (last_result IN ('found','none','failed'))
);

CREATE TABLE author_nudge_state (
  readable_id         TEXT PRIMARY KEY NOT NULL,
  last_shown_at       TEXT NOT NULL,
  read_count_at_show  INTEGER NOT NULL,
  chapters_at_show    INTEGER
);

CREATE TABLE sync_log (
  id                 TEXT PRIMARY KEY NOT NULL,
  at                 TEXT NOT NULL,
  direction          TEXT NOT NULL CHECK (direction IN ('export','import')),
  peer_device_id     TEXT,
  peer_device_label  TEXT,
  summary_json       TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE app_settings (
  key    TEXT PRIMARY KEY NOT NULL,
  value  TEXT NOT NULL
);
```

The migration also inserts the Up Next shelf (`id = 'shelf_up_next'`, `system_key = 'up_next'`, `type = 'manual'`; full seed values in §7.7) and generates `device_id` in `app_settings`.

Cover images live in their own table so the library list query never loads image bytes; `listReadables` never joins `covers`.

JSON array columns are read with `parseJsonArray` (`src/shared/utils/json.ts`), which never throws and returns `[]` for null or malformed input.

### 8.3 Repositories

Plain async functions taking `db: Db` first; no hooks; return domain objects, never rows. Mappers (`*Mapper.ts`) convert rows to the discriminated union by `kind`. Columns are `snake_case`. Reads exclude tombstoned rows unless the function name says otherwise (`…IncludingDeleted`).

| Repository | Functions |
|---|---|
| `readableRepository` | `listReadables`, `getReadable`, `findBySource`, `findByIsbn`, `createReadable`, `updateReadable(db, id, patch)`, `applyAo3Fields(db, id, patch)`, `tombstoneReadable`, `restoreReadable`, `listReadablesIncludingDeleted`, `upsertReadableFromSync` |
| `noteRepository` | `listNotes(readableId)`, `listAllNotes`, `createNote`, `updateNote`, `tombstoneNote`, sync variants |
| `shelfRepository` | `listShelves`, `createShelf`, `updateShelf`, `tombstoneShelf`, `listShelfItems(shelfId)`, `addToShelf`, `moveShelfItem`, `removeFromShelf`, sync variants |
| `readingEventRepository` | `listEvents(readableId)`, `listEventsBetween`, `insertEvents`, `tombstoneEvent`, sync variants |
| `aliasRepository` | `listAliases`, `insertAlias`, `resolveId` |
| `wipUpdateRepository` | `listInbox`, `countUnread`, `insertUpdate`, `markRead`, `markAllRead`, `deleteRead`, `deleteAll`, `purgeReadOlderThan` |
| `checkStateRepository` | `getCheckStates`, `upsertCheckState` |
| `coverRepository` | `getCoverMeta(readableId)`, `listCoverMeta`, `getCoverImage(readableId, size)`, `setCover`, `updateCoverCredit`, `tombstoneCover`, sync variants |
| `coverFetchStateRepository` | `getCoverFetchStates`, `upsertCoverFetchState` |
| `authorNudgeRepository` | `getNudgeState(readableId)`, `upsertNudgeState` |
| `syncLogRepository` | `insertSyncLog`, `listSyncLog` |
| `settingsRepository` | `getSetting`, `setSetting`, `getAllSettings` |

**Bookkeeping in repositories (and nothing more):** generate ids; set `createdAt`/`updatedAt`; tick the HLC (§9.2) and update `field_clocks` for every field written; set `updated_hlc`; write tombstones instead of deleting synced rows. The one exception is `purgeTombstonesOlderThan(db, cutoff)`, which each synced repository except `aliasRepository` exposes for the launch purge (§8.6). `updateReadable` rejects a patch whose `kind` differs from the stored row.

Cross-table writes (for example a progress change plus its events, or an AO3 update plus its inbox entry) are composed by services inside `db.transaction`; a repository never writes another module's table.

### 8.4 Query keys

Each module exports a key factory from `domain/queryKeys.ts`: `readableKeys` (`all`, `list`, `detail(id)`), `noteKeys` (`byReadable(id)`, `all`), `shelfKeys`, `eventKeys`, `wipUpdateKeys` (`list`, `unreadCount`), `coverKeys` (`allMeta`, `meta(id)`, `image(id, size)`), `settingsKeys`. Cover image queries use a long `staleTime`; on web, the `blob:` URLs they create are revoked when the image unmounts. List queries are not keyed by filters: `useReadables(filters)` fetches once and applies `applyFilters` in a memoised `select`. Mutations invalidate the narrowest key that covers them. Routine actions (+1, status, favourite, note save) use optimistic updates with rollback, because they must feel instant.

### 8.5 Migrations and database errors

- Files: `src/db/migrations/NNN_name.ts`, tracked with `PRAGMA user_version`. Each migration runs inside one transaction; `user_version` is set inside the same transaction.
- A failed migration rolls back. The app shows a database error screen with **Try again** and **Export database file** (a rescue copy via the files adapter). Retrying on next launch is safe because nothing was applied.
- After the first production release, the Android app copies the database file before running any new migration and keeps the last copy.
- Migration tests run every historical schema forward to the latest on `createTestDb`.

### 8.6 Deletion

- Deleting a readable writes a tombstone and shows an **Undo** snackbar for 8 seconds. No confirmation dialog for single deletes; bulk deletes confirm with a count.
- Tombstoned rows (and their notes, shelf items, events and cover) disappear from every view but stay in storage so sync can propagate the delete.
- Tombstones older than 180 days are purged on launch. A startup service calls each synced repository's `purgeTombstonesOlderThan` inside one transaction; it deletes only rows whose `deleted_at` is older than the cutoff. This is the only hard delete of synced rows. `id_aliases` rows have no tombstones and are never purged, so old sync files still resolve to canonical ids. A device that has not synced for longer than that may bring a purged item back on its next merge; the merge summary says so.
- Inbox entries are kept after deletion because they hold a title snapshot.

### 8.7 Settings

Device-local key/value pairs in `app_settings`.

| Key | Values | Default |
|---|---|---|
| `device_id` | UUID | generated by migration |
| `device_label` | text | "Android phone" / "<browser> on <OS>" |
| `hlc_last` | HLC string | — |
| `theme` | `system` · `light` · `dark` · `black` | `system` |
| `list_density` | `comfortable` · `compact` | `comfortable` |
| `cover_display` | `everywhere` · `detail_only` · `off` | `everywhere` |
| `sync_include_covers` | boolean | `true` |
| `default_sort` | `ReadableFilters['sortBy']` | `dateAdded` |
| `default_add_status` | `ReadableStatus` | `want_to_read` |
| `content_prefs` | `ContentPreferences` JSON (synced, §9.4) | nothing hidden |
| `content_prefs_hlc` | HLC of the last change to `content_prefs` (used by sync) | — |
| `app_lock` | `off` · `biometric` | `off` |
| `lock_after_seconds` | number | `60` |
| `screen_privacy` | boolean (Android FLAG_SECURE) | `false` |
| `wip_check_scope` | `all` · `favourites` · `up_next` | `all` |
| `wip_check_limit` | number | `60` |
| `backup_reminder_days` | number, 0 = off | `30` |
| `last_export_at` | ISO date | — |
| `onboarding_done` | boolean | `false` |
| `first_used_at` | ISO date | set on first launch |
| `show_bookshop_links` | boolean | `true` |
| `bookshop_region` | `auto` or a storefront code | `auto` |
| `tip_card_dismissed` | boolean | `false` |
| `author_feedback_prompt` | `finished` · `finished_and_caught_up` · `off` | `finished` |

---

## 9. Sync and Backup

### 9.1 Model

- Sync and backup are the same thing: a `.bookmark` file containing the device's full state, which another device **merges** (never overwrites).
- The merge is state-based and deterministic: merging A into B gives the same result as merging B into A, merging the same file twice changes nothing, and any number of devices converge once they have exchanged files. These three properties are tested with `fast-check` (§16).
- The app never uploads anything. The user moves the file however they like (Nearby Share, Files, email to self, a cloud drive). The app recommends a passphrase whenever the file will leave the device.

### 9.2 Hybrid logical clock (HLC)

Location: `src/features/sync/domain/hlc.ts`.

- Format: `"<wall-ms, 15 digits>:<counter, 5 digits>:<deviceId>"`, so plain string comparison gives a total order, with the device id breaking ties.
- `hlcTick(last, wallMs)` for local writes; `hlcReceive(last, remote, wallMs)` when merging, so a device's clock never falls behind clocks it has seen.
- The repository ticks once per write and stamps every field it writes with that clock in `field_clocks`. `hlc_last` is persisted in the same transaction.
- `field_clocks` keys are the camelCase domain field names, the same keys as `SyncRow.values` and `SyncRow.fieldClocks` (§9.4).
- `GENESIS_HLC = '000000000000000:00000:00000000-0000-0000-0000-000000000000'` sorts below every real clock. It is used only for rows seeded identically on every device (the Up Next shelf). `hlc_last` is not seeded; the first `hlcTick` starts from the wall clock.

### 9.3 Merge rules

`mergeRows(local, remote)` in `src/features/sync/domain/merge.ts`, used for every synced table:

1. **Fields:** for each field, keep the value whose clock is higher. Equal clocks with different values cannot happen except by bug; if they do, the lexicographically larger JSON value wins so all devices still agree.
2. **Deletes:** a row is deleted if its delete clock is higher than every field clock. If an edit is newer than the delete, the row is restored and the summary says "Restored *Title* — edited on another device after it was deleted".
3. **Duplicate AO3 works** (same `source_type` + `source_id`, different ids, both live): the canonical id is the one with the earlier `created_at` (ties: lower id). Fields merge by clock; an `id_aliases` row records alias → canonical; notes, shelf items, events and the cover of the alias are re-pointed (if both have a cover, the newer one wins). Aliases are synced as a set, and `resolveId` follows chains, so every device lands on the same canonical row.
4. **Notes, shelf items, events and covers** merge by id like any row (covers by `readable_id`). Two devices adding notes to the same work keep both. The same shelf membership created on two devices has the same deterministic id and merges into one. A cover replaced on one device replaces it everywhere once merged.
5. **Settings:** only `content_prefs` travels, as one last-writer-wins value. When importing, unknown keys in the incoming value (such as a `discreetMode` field from an older file) are ignored.
6. **Never synced:** inbox (`wip_updates`), `ao3_check_state`, `cover_fetch_state`, `author_nudge_state`, `sync_log`, all other settings.
7. **Absence is not deletion:** a file exported without covers never removes covers on merge. Only tombstones delete.

### 9.4 File format

```ts
interface BookmarkSyncFile {
  format: 'bookmark-sync';
  version: 1;
  schemaVersion: number;
  exportedAt: string;
  deviceId: string;
  deviceLabel: string;
  hlc: string;
  tables: {
    readables: SyncRow[]; notes: SyncRow[]; shelves: SyncRow[];
    shelfItems: SyncRow[]; readingEvents: SyncRow[]; aliases: AliasRow[];
    covers?: CoverSyncRow[];         // omitted when exported without covers
  };
  settings: { contentPrefs: { value: ContentPreferences; hlc: string } };
}

interface SyncRow {
  id: string;
  values: Record<string, unknown>;   // camelCase domain fields, without sync columns
  fieldClocks: Record<string, string>;
  updatedHlc: string;
  deletedAt: string | null;
}

interface AliasRow { aliasId: string; canonicalId: string; createdHlc: string }

interface CoverSyncRow extends SyncRow {
  imageData: string | null;          // base64 of the full-size JPEG; null for tombstones
}                                    // thumbnails are regenerated on import

interface BookmarkEncryptedFile {
  format: 'bookmark-sync-encrypted';
  version: 1;
  kdf: { name: 'scrypt'; N: number; r: number; p: number; salt: string };   // base64
  cipher: 'xchacha20-poly1305';
  nonce: string;                                                           // base64, random per file
  ciphertext: string;                                                      // base64 of the JSON above
}
```

- File extension `.bookmark`, UTF-8 JSON. Exports include tombstones.
- Import validates with Zod, rejects files over 150 MB (covers make files large; spike S10 measures import time), and rejects a newer `schemaVersion` with "This file was made by a newer version of Bookmark — update the app first".
- Encryption uses `@noble/hashes` (scrypt) and `@noble/ciphers` (XChaCha20-Poly1305). A wrong passphrase fails authentication and reports "Wrong passphrase"; there is no recovery.

### 9.5 Transports

| Step | Android | Web (iPhone, desktop) |
|---|---|---|
| Export | Share sheet (`expo-sharing`) | Browser download (iPhone: saves to Files) |
| Import | Document picker; also "Open with Bookmark" for `.bookmark` files via the share intent | File picker; drag and drop on desktop |

### 9.6 Sync and backup UX

- **Settings → Sync & backup:** *Create sync file* (optional passphrase; **Include covers**, default from `sync_include_covers`, with the estimated file size), *Merge a sync file*, device label, and a list of devices last merged with and when.
- **Merge summary** after every import: added, updated, restored, duplicates merged, purged items that reappeared. Recorded in `sync_log`.
- **Backup reminder:** a Home banner when `last_export_at` is older than `backup_reminder_days`, explaining that data lives only on this device.
- **Moving to a new phone:** export on the old device, import on the new one; the same flow, no special case.

### 9.7 Future: live sync (research, not committed)

Direct device-to-device sync over a WebRTC data channel, paired by scanning QR codes, reusing `mergeRows`. It needs `react-native-webrtc` on Android, public STUN servers, both devices online at once, and may fail on some networks. Revisit only if file sync proves too manual.

---

## 10. Metadata, AO3 Access and Capture

### 10.1 AO3 access rules

These apply to every AO3 request the native apps make (Android now; iOS from Phase 6) (principle 4).

- **User-initiated only:** adding by link, refreshing one work, or a check run the user starts. Never in the background, never on launch, never on a timer.
- **Paced:** one request at a time, at least 2,000 ms apart with ±500 ms jitter, through `politeFetch`.
- **Capped:** a check run fetches at most `wip_check_limit` works (default 60).
- **Backs off:** on 429 or 503, wait for `Retry-After` (or 60 s if absent) and retry once. Two rate-limit responses in one run end the run with "AO3 asked us to slow down — try again in N minutes". Never retry silently in a loop.
- **Identifiable:** `User-Agent: Bookmark/<version> (<Android|iOS>; personal reading tracker; +<website URL>)`.
- **Anonymous:** no login, no cookies, no stored AO3 credentials, ever. Restricted (logged-in-only) works are reported as restricted and handled by the capture tool, which runs in the user's own logged-in browser.
- **Minimal:** fetch only `https://archiveofourown.org/works/<id>` with `view_adult=true` (spike S2), never `view_full_work` and never downloads. Parse metadata and discard the rest of the page; work text is never stored.
- **Never from CI or tests:** tests use saved fixtures (§16).

### 10.2 `politeFetch`

`src/shared/http/politeFetch.ts`, Android only. Returns a typed result and never throws:

```ts
type PoliteResult =
  | { kind: 'ok'; html: string; finalUrl: string }
  | { kind: 'not_found' }
  | { kind: 'restricted' }                       // redirected to login, or the "only available to registered users" page
  | { kind: 'adult_gate' }                       // adult-content interstitial still shown (spike S2)
  | { kind: 'rate_limited'; retryAfterMs: number }
  | { kind: 'blocked' }                          // challenge or error page instead of a work page
  | { kind: 'network_error'; message: string };
```

Clock, delay and jitter are injectable for tests.

### 10.3 `Ao3Snapshot` and changes

Location: `src/features/ao3/domain/ao3Snapshot.ts`. Every AO3 source produces this shape.

```ts
export interface Ao3Snapshot {
  workId: string;
  url: string;                               // canonical https://archiveofourown.org/works/<id>
  title?: string;
  authors?: string[];
  authorType?: AuthorType;
  summary?: string | null;
  fandoms?: string[];
  relationships?: string[];
  characters?: string[];
  categories?: string[];
  ao3Tags?: string[];
  rating?: AO3Rating | null;
  archiveWarnings?: string[];
  availableChapters?: number;
  totalUnits?: number | null;                // '?' → null
  wordCount?: number | null;
  isComplete?: boolean;
  publishedAt?: string | null;
  ao3UpdatedAt?: string | null;
  series?: { seriesId: string; name: string; part: number; total?: number | null };
  hasAbandonedTag?: boolean;                 // any freeform tag equal to "abandoned", case-insensitive
  imageUrls?: string[];                      // work pages only: https image addresses in the summary, notes and first chapter; at most 10
}

export interface Ao3Change {
  field: (typeof AO3_OWNED_FIELDS)[number];
  before: unknown;
  after: unknown;
  added?: string[];                          // for array fields
  removed?: string[];
  severity: 'safety' | 'progress' | 'info';
}
```

`undefined` means the source did not include the field; `null` or `[]` means present and empty (§7.5).

**Author detection** (all sources): an author link to `/users/orphan_account/` → `orphaned`, no author link → `anonymous`, otherwise `known` with the pseud names.

**Abandoned tag:** when a new work's snapshot has `hasAbandonedTag`, the add flow asks "This work is tagged Abandoned on AO3. Mark it as abandoned in your library?" Updates never change `isAbandoned`.

### 10.4 Sources

| Source | Where it runs | Function | Notes |
|---|---|---|---|
| Work page fetch | Android | `parseAo3WorkHtml(html, url): ParseResult<Ao3Snapshot>` | String parsing only (no DOM in React Native). Reads `dl.work.meta` and `dl.stats`, the title and byline, summary and series blocks. |
| Capture tool | Any browser on an AO3 page | Bookmarklet DOM extractor (§10.5) | Work pages and pages listing work blurbs. |
| Pasted page text | Android and web | `parseAo3CopiedText(text): ParseResult<Ao3Snapshot>` | The fallback that always works: on an AO3 work page, Select All → Copy, then paste. Reads the labelled lines ("Rating:", "Archive Warning:", "Category:", "Fandom:", "Relationship:", "Characters:", "Additional Tags:", "Series:", "Published:", "Updated:"/"Completed:", "Words:", "Chapters:"). Title and authors are heuristics, so the result always opens in the review form. |

**Work page mapping** (`dl.stats` is authoritative for numbers and dates):

| AO3 element | Snapshot field |
|---|---|
| `dd.published` | `publishedAt` |
| `dt.status` + `dd.status` | `"Completed:"` → `isComplete = true`, `ao3UpdatedAt`; `"Updated:"` → `isComplete = false`, `ao3UpdatedAt`; absent → `isComplete = (available === total)`, `ao3UpdatedAt = publishedAt` |
| `dd.words` (strip separators) | `wordCount` |
| `dd.chapters` (`X/Y`, `X/?`) | `availableChapters`, `totalUnits` |
| `dd.rating.tags a.tag` | `rating` (unknown text → `null` plus a parse warning) |
| `dd.warning.tags a.tag` | `archiveWarnings` |
| `dd.category.tags a.tag` | `categories` |
| `dd.fandom.tags a.tag` | `fandoms` |
| `dd.relationship.tags a.tag` | `relationships` |
| `dd.character.tags a.tag` | `characters` |
| `dd.freeform.tags a.tag` | `ao3Tags`, `hasAbandonedTag` |
| `dd.series` | `series` (first series; `total = null` when unknown) |
| `a[rel="author"]` | `authors`, `authorType` |
| `img[src]` in the summary, notes and first chapter | `imageUrls` (https only, at most 10). Only the image addresses are read; the surrounding text is never stored. |

Kudos, hits, bookmarks and comment counts are never read.

```ts
export interface ParseResult<T> { value: T | null; warnings: string[] }
```

Parsers never throw and extract field by field so a partial page still yields a partial snapshot.

### 10.5 Capture tool

The capture tool turns an AO3 page the user already has open into data the app can import, with **no extra requests to AO3**. It is the main AO3 path for the web app and the low-impact path for bulk updates everywhere.

**What it is:** a bookmarklet (a bookmark whose address is a small script). Its source lives in `tools/capture-bookmarklet/`, unminified and published; a build script produces the `javascript:` URL and the install page on the website. It reads only the current page's DOM, makes no network requests, and writes one JSON payload to the clipboard.

**Pages it reads:**
- A work page → one full snapshot.
- Any page that lists work blurbs (for example bookmarks, history, Marked for Later, series, author works, search and tag listings; spike S4 confirms which) → up to 100 snapshots. Blurbs carry title, authors, fandoms, rating, warnings, categories, completion, relationships, characters, freeform tags, summary, words, chapters, series and the updated date, but not the published date, which therefore stays `undefined`.
- **Rec lists:** the same listing pages when they belong to someone else (an AO3 collection, a series, another user's public bookmarks) also set `listSource` from the page heading. The tool reads only the works' own metadata, never other users' bookmark notes or tags.

**Payload:**

```ts
interface CapturePayload {
  format: 'bookmark-capture';
  version: 1;
  toolVersion: string;
  capturedAt: string;
  pageUrl: string;
  pageKind: 'work' | 'listing';
  listSource?: {               // listing pages only: the list being captured
    kind: 'collection' | 'bookmarks' | 'series' | 'other';
    name: string;              // from the page heading, e.g. the collection's title
    url: string;               // the list's AO3 address
  };
  works: Ao3Snapshot[];        // 1–100
}
```

**Hand-off:** the bookmarklet copies the payload and shows a small overlay: "Copied 20 works — open Bookmark and tap Paste from AO3". On iPhone the clipboard is the only route, because the home-screen app's storage is separate from Safari (§2.3). If the clipboard write fails (spike S3), the overlay shows the payload in a selected text box to copy by hand. If AO3's Content Security Policy blocks the bookmarklet in a browser (spike S3), the pasted-text fallback (§10.4) still works.

**In the app (`/capture`):**
1. `parseCapturePayload(text)` validates with Zod: format and version, at most 100 works, string length caps (titles 500, summaries 10,000, at most 300 tags per list), URL must be an AO3 work URL, `imageUrls` must be https addresses (at most 10 per work), and `listSource.url` must be an AO3 address. Anything else is rejected with a plain message.
2. A preview groups the works as **New**, **Updates** and **Unchanged**, using `findBySource` and `planAo3Update`.
3. The user picks a status for new works (default from settings) and taps **Apply**. One transaction creates the new readables and applies updates; updates create inbox entries with `source: 'capture'`. When the payload has a `listSource`, the preview also offers **Add these works to a shelf**: a new manual shelf named after the list (with `sourceName` and `sourceUrl`) or an existing shelf, plus **Include works I already have** (on by default). Capturing the list's next page and choosing the same shelf appends to it.
4. Payloads from tool versions older than the app's minimum show "Your capture tool is out of date — reinstall it from the website".

### 10.6 Google Books

- Search by title, author or ISBN. Map `volumeInfo` to the form: title, authors, page count (`totalUnits`), ISBN-13, published date, description (`summary`); `seriesInfo.volumeSeries[0].orderNumber` → `seriesPart`; series name and total stay empty.
- `sourceType = 'google_books'`, `sourceId` = volume id. Prefill only (§6.5).
- **Attribution (Google's branding guidelines):** show "Powered by Google" next to search results and link each result to its Google Books page (`volumeInfo.infoLink`).
- **Cover:** the chosen result's `imageLinks.thumbnail`, upgraded to https, is offered as the cover (§10.9).
- The API key ships inside the app and the web bundle, so it is restricted in Google Cloud: Android package name and signing certificate for the app, HTTP referrer for the website (spike S5).
- Barcode scan (Android, Phase 5) reads an EAN-13 and runs an ISBN search. A scanned book defaults to `isOwned = true`, since the reader is holding it.

### 10.7 Imports

| Import | Mapping |
|---|---|
| AO3 link list (`.csv` or `.txt`) | Find AO3 work URLs anywhere in the file, de-duplicate by work id, preview the count. On Android, fetch them through a persisted queue that respects §10.1 and survives the app closing. On web, list them for the user to capture from AO3 instead. |
| Goodreads CSV | Title, Author + Additional Authors → `authors`, ISBN13, Number of Pages, Exclusive Shelf (`to-read` → `want_to_read`, `currently-reading` → `reading`, `read` → `completed`), Date Read → `finishedAt`, Date Added → `dateAdded`, Read Count → `readCount`, Bookshelves → `userTags`, Private Notes → a note, Owned Copies (above 0 → `isOwned = true`; otherwise left unset). **My Rating and My Review are ignored** (principle 3). |
| `.bookmark` file | Merge (§9). |

Every import shows a preview (counts, duplicates found, rows skipped with reasons) before writing, and writes in one transaction.

### 10.8 Exports

- `.bookmark` (full state, §9.4).
- CSV: one row per readable with readable columns (lists joined with `; `), plus a separate notes CSV. For spreadsheets and for leaving the app.

### 10.9 Covers: sources and processing

**Sources**

| Source | How | Platforms |
|---|---|---|
| Open Library by ISBN | `https://covers.openlibrary.org/b/isbn/<isbn13>-L.jpg?default=false` (404 means no cover). Offered when a book with an ISBN is added, from **Find cover** on the detail screen, and by the bulk job below. | Android; web if spike S9 passes |
| Google Books result | The chosen search result's `imageLinks.thumbnail`. | Android; web if spikes S5 and S9 pass |
| AO3 work page images | The reader picks one of the snapshot's `imageUrls` (from a fetch or a capture). Android downloads the chosen image once. On web the picker explains: open the work in Safari, press and hold the image, **Save to Photos**, then choose it from photos. AO3 does not host images, so these downloads go to the image's own host, not AO3. | Android download; web via photos |
| Photos or files | `expo-image-picker`: the Android system photo picker; a file input on web (iPhone offers Photos and Files). This is how art from Instagram, Tumblr or anywhere else gets in: the reader saves or screenshots it first. | All |
| Image link | The reader pastes an https address that points directly at an image file. Android downloads it once. | Android only |

The app never loads or parses social media pages (Instagram, Tumblr, Pinterest, X and so on) and never scrapes Goodreads. Instagram's terms prohibit collecting information in unauthorised ways; the reader's own save is the respectful route.

**Bulk book covers (Find missing covers).** Offered after a Goodreads import and in Settings → Covers; Android, and web if spike S9 passes. The reader starts it; it never runs on its own. Targets come from `selectCoverFetchTargets`. One Open Library request at a time, at least 3.5 s apart, because Open Library allows 100 ISBN lookups per IP every 5 minutes and asks apps not to crawl its cover API. Progress bar and **Stop**; each result is saved to `cover_fetch_state`, so a later run resumes. A 403 ends the run with "Open Library asked us to slow down — try again later". About includes a courtesy link to Open Library.

**Processing (`coverService.setCoverFromImage`)**
1. Check type and size with `validateImageInput`.
2. Decode, resize and re-encode with `expo-image-manipulator`: `full` 600 px wide (at most 1,000 px tall) and `thumb` 160 px wide, JPEG quality 0.8. Re-encoding drops all embedded metadata, including photo location.
3. Store both variants and the metadata in one transaction, replacing any previous cover.
4. On web, display through same-origin `blob:` URLs made from the stored bytes, which work under the site's cross-origin isolation.

**Downloads (Android):** through `httpClient`, with a 10 MB limit, an `image/*` content-type check, a 15-second timeout and no cookies. Every download is one the reader asked for, or part of the bulk job the reader started.

**Fan art and credit**
- The app never chooses fan art by itself; the reader always picks.
- AO3 page images are marked as fan art and credited to the work's URL by default; the reader is prompted to add the artist's name and link.
- The detail screen shows "Cover art by <name>" linking to `creditUrl` whenever credit exists.
- Covers stay on the reader's devices and in their own sync files. They are never included in CSV exports.

**Display**
- `cover_display`: **Everywhere** (list thumbnails and detail), **Detail only**, or **Off**, applied through `coverVisibility` (§7.12).
- Settings → Covers shows the storage covers use and offers **Remove all covers**.

---

## 11. Updates

### 11.1 Check run (Android)

- Started from the Updates tab or the Home "New chapters" card. Scope control: **All WIPs** / **Favourites** / **Up Next** (persisted as `wip_check_scope`), plus "Also check abandoned works" (not persisted).
- The button shows the target count, for example "Check 24 favourites". With no targets: "No WIPs to check in Favourites".
- Targets come from `selectWipCheckTargets` (§7.11). The run keeps the screen awake, shows "Checking 3 of 24", and has a **Stop** button. Each work's result is written to `ao3_check_state` as it completes, so stopping or closing the app loses nothing and the next run continues with the least recently checked works.
- Per work, in one transaction: `applyAo3Fields`, optional status patch, inbox entry, check state.
- Result snackbar: "5 works updated", "Everything is up to date", or "5 updated · 2 couldn't be checked".

### 11.2 Updates by capture (all platforms)

The Updates tab explains the low-impact path: open your AO3 bookmarks, history or Marked for Later, run the capture tool, and paste. Every listed work you already have is updated in one go without the app contacting AO3. This is the only update path on the web app.

### 11.3 Inbox

- Unread first (newest first), then read. Safety changes sort to the top of unread and always show expanded with a warning icon and text.
- Collapsed card: title, authors, a one-line summary from `summarizeChanges(changes)` (pure, `src/features/updates/domain/summarizeChanges.ts`), and the source ("Checked" or "Captured").
- Expanded: added items (`+`), removed items (`−`), numbers as "was X → now Y", the status-reversion message, and actions: **Open in library**, **Open on AO3**, **Mark finished** (when `suggestMarkFinished`).
- `not_found`: "No longer available on AO3 — your entry and notes are kept". `restricted`: "Now limited to logged-in AO3 users — update it with the capture tool".
- Bulk: Mark all read, Clear read, Clear all (confirm). Read entries older than 90 days are purged on launch.
- The Updates tab shows an unread badge.

---

## 12. Screens and Navigation

### 12.1 Routes (Expo Router, typed routes)

```
app/
  _layout.tsx                 global.css, providers, splash, database gate, app lock gate
  onboarding.tsx
  (tabs)/_layout.tsx          JS tabs: Home · Library · Shelves · Updates · Settings
  (tabs)/index.tsx            Home
  (tabs)/library.tsx
  (tabs)/shelves.tsx
  (tabs)/updates.tsx
  (tabs)/settings.tsx
  readable/new.tsx            add (quick-add modes)
  readable/[id]/index.tsx     detail
  readable/[id]/edit.tsx
  readable/[id]/cover.tsx     choose, credit or remove a cover
  shelf/[id].tsx
  series/[key].tsx
  pick.tsx                    next-read picker
  stats.tsx
  capture.tsx                 paste + preview
  import.tsx                  files: .bookmark, AO3 link list, Goodreads CSV
  sync.tsx                    sync & backup
  settings/appearance.tsx
  settings/content.tsx
  settings/covers.tsx
  settings/privacy.tsx        Android only
  settings/about.tsx
  feedback.tsx
```

- **Tabs:** `(tabs)/_layout.tsx` uses Expo Router's headless (JS) tabs on every platform, including iOS in Phase 6. One layout file, not split by platform. Below 900 px wide it renders a bottom tab bar; at 900 px and wider (desktop web, large tablets) it renders a navigation rail. Both are our own components styled with Uniwind, with `tablist` / `tab` roles, selected state announced, 48 dp targets, labels always shown, and the Updates unread badge. Native tabs are not used.
- Library filters arrive as a serialised `filters` search param (`/library?filters=…`), which is how tappable tags and "Save as shelf" work and why web URLs are shareable within the user's own browser.
- Detail, edit and capture are modal presentations on Android. At widths ≥ 900 px, Library shows list and detail side by side.

### 12.2 Home

Sections in order, each hidden when empty:
1. Install banner (web in a Safari tab) and backup reminder banner.
2. **Continue reading:** `reading` items by `lastReadAt`, each with progress and a **+1** button.
3. **New chapters:** `new_chapters` items with "3 new" badges; a "Check for updates" action on Android.
4. **Up Next:** the first five items of the Up Next shelf.
5. **Pick something for me:** opens the picker.
6. **Your year:** works finished and words read so far, linking to Stats.

### 12.3 Library

- Inline search, filter button with active-count badge, sort menu, active-filter chips (each removable), "Save as shelf".
- `FlatList`, `keyExtractor = id`, memoised items. Item: cover thumbnail (when `cover_display` is Everywhere), title, authors, kind icon, status or reading state, progress line, "N new" badge, favourite heart, and rating only when content preferences don't hide it. Tags, summaries, relationships and warnings are not shown in the list.
- Long-press (Android) or checkbox mode (web) for multi-select: set status, add to shelf, favourite, delete.
- Empty library: add actions. No results: "No matches" with **Clear filters** and, when relevant, "4 hidden by your content settings".

**Filter modal** (draft state, applied on **Apply**, live match count, **Clear all**): Kind · Status and reading state · General (favourites, in a series, shelf, length range, owned / not owned for books) · AO3 (only when Fanfic is selected: complete/WIP, abandoned, ratings, categories, fandoms, relationships, characters, **exclude warnings**) · Tags (include → exclude → off cycle; vocabulary from the scoped library) · Sort.

### 12.4 Detail

Top to bottom: cover (tap to enlarge, or **Add cover**) with its "Cover art by …" credit line · title, authors (with Anonymous/Orphaned label and explanation), favourite toggle · reading-state banner ("Caught up", "3 new chapters", "Finished · read 2 times") · progress control (−, value, +, edit; unit from `progressUnitFor`) · status chips · actions (Open on AO3, Refresh (Android, AO3 works), Start re-read, Add to shelf, Up Next toggle, Change cover) · archive warnings (prominent, icon + text) and rating · fandoms, relationships (first 3, expandable), characters, categories · AO3 tags and user tags (collapsed; tap a tag to open the library filtered by it) · summary · series card with next part · notes journal (newest first, **Add note** pre-filled with the current position) · reading history (events, deletable) · details (words, published, AO3 updated, date added) · Delete (with Undo).

Books also show an **Owned** control (Owned · Not yet · not set). When `bookshopLinkFor` returns a link, a row appears under the actions: **Find at an independent bookshop**, with the affiliate disclosure from §12.12. It opens in the browser.

All inline edits save immediately through the hooks and roll back with a snackbar on failure.

### 12.5 Add and edit

- **Add** opens with quick-add modes: **Paste AO3 link** (Android: fetch and prefill), **Paste from capture tool**, **Paste page text**, **Search books** (Google Books), **Scan barcode** (Android), **Enter manually**. Every mode ends in the same review form, which shows a cover candidate when there is one (Open Library or Google Books for books; the work's images for AO3) with **Use this cover**, **Choose another** and **No cover**.
- Form: React Hook Form + Zod + `Controller`, validate on submit, explicit form-model mapping. Numeric inputs are strings with a Zod transform (blank → null, non-negative integer, else an error); `keyboardType="number-pad"`. `dateAdded` uses the shared `DateField` (§4), defaults to today and cannot be in the future.
- `kind` is chosen on add and fixed on edit. Fanfic-only fields render only for fanfic. AO3-owned fields on AO3 works are read-only with "From AO3".
- Fields: title, authors (chips), status, progress, total (with unit selector for books), date added, user tags, source URL, favourite, series (name, part, total), book format, ISBN and ownership (Owned / Not yet, optional), fanfic completion/abandoned/available chapters/words/fandoms/relationships/characters/categories/rating/warnings. Notes are added from the detail screen, not this form.
- Leaving with unsaved changes asks to discard.

### 12.6 Capture and import

`/capture`: a large **Paste** button (reads the clipboard via the clipboard adapter), a text box fallback, then the preview in §10.5. For rec lists the preview shows the list's name and the shelf option. `/import`: file picker, detected type, preview, apply, summary.

### 12.7 Shelves and series

- Shelves tab: Up Next pinned first, then the user's shelves (manual and smart, with counts). Create, rename, delete (Undo), reorder shelves. Shows the suggested **To buy** shelf when relevant (§7.7).
- Shelf screen: items in order; reorder with **Move up / Move down** actions (accessible, no drag library); remove from shelf; smart shelves show their filters and an **Edit filters** action.
- Series screen: parts in order with state, next part highlighted, missing parts linked to AO3.

### 12.8 Picker

Criteria chips (kind, length, complete only, only books I own, fandom, shelf), one large card with the pick and its reason, two smaller alternates, and actions: **Start reading** (status → reading), **Add to Up Next**, **Not now** (skip for this session), **Another**.

### 12.9 Stats

Year selector; works finished (books, fanfic), words read, pages read, re-reads, DNFs; finishes per month (bar chart built from plain Views); top fandoms; longest work; **Authors who made your year**, each with their finished works and a **Thank them on AO3** link that opens their most recently finished work. A line under the numbers: "Calculated on this device. Never shared."

### 12.10 Settings

Appearance (theme, list density) · Library (default sort, default status on add) · Content (hidden warnings, hidden ratings) · Covers (display, find missing covers, storage used, remove all) · Privacy (Android: app lock, lock delay, hide content in recent apps and screenshots) · Sync & backup · Import & export · Capture tool (install page link, installed tool version from the last payload) · Updates (check scope, check limit, author feedback prompt) · About (version, "Bookmark is not affiliated with, endorsed or sponsored by Archive of Our Own or the Organization for Transformative Works", privacy policy, open-source licences) · Send feedback · Support Bookmark (§12.12) · Bookshop links (show or hide, region).

**Feedback** (`/feedback`): a "Your idea" field (RHF + Zod, non-empty) and **Send by email**, which opens a `mailto:` built by `buildFeedbackMailto` with the app version and platform in a visible footer. If no mail app opens, show the address as selectable text.

**Support:** see §12.12.

### 12.11 Onboarding

Three short screens, then an optional import: (1) your library lives only on your devices — back it up or sync with a file; (2) Bookmark is not affiliated with AO3, never asks for your AO3 password, and is gentle on AO3; (3) web on iPhone: add to Home Screen (shown only there). Ends with **Import a file**, **Add your first read**, or **Skip**.

### 12.12 Support and funding

**Rules:** nothing is ever sold, unlocked or gated; every mention is optional, honest and easy to dismiss; costs and income are published. Never monetise fanfic or AO3 content.

**Tips**

| Platform | How | Copy beside the tip options |
|---|---|---|
| Android | Consumable tip products through Google Play billing, in three sizes set in Play Console. **Only when `ANDROID_TIPS_ENABLED` is set in the Play build profile; off by default** (see the address note below). | "Tips are processed by Google Play, which keeps 15%. The rest goes to Bookmark's running costs. Tips unlock nothing — every feature is free." |
| Web | **Support Bookmark** opens the Ko-fi page from `KOFI_URL` (must start with `https://ko-fi.com/`). | "Ko-fi takes no fee; card processing takes about 3%. Tips unlock nothing — every feature is free." |
| iOS (Phase 6) | Apple in-app purchase tips, which App Review Guideline 3.1.1 allows. | Same wording, adjusted for Apple's commission. |

- **Android never mentions or links Ko-fi or any other way to pay**, in the app or its Play listing. Google Play's payments policy forbids leading users to payment methods other than Play billing. The cost comparison and "Ko-fi is the cheapest way to support" live only on the website.
- **Address note:** Google Play shows the full address from the payments profile publicly for accounts that sell in-app products. Enable Android tips only after deciding that is acceptable (or using a business address); spike S14.
- **Where tips appear:** Settings → Support Bookmark, plus at most one dismissible card on Home after 30 days of use (`shouldShowTipCard`, §7.13). It never returns once dismissed or after a tip. No pop-ups, no repeated reminders, no guilt.
- **After a tip:** a thank-you message only. Nothing in the app changes, and no purchase record is stored or sent anywhere.

**Bookshop links**
- Shown only by `bookshopLinkFor` (§7.13): books the reader has marked **not owned**, still to read or being read, with an ISBN, in a region with a Bookshop.org storefront.
- Label: **Find at an independent bookshop**, followed by the disclosure "Affiliate link: if you buy, Bookmark earns 10% and a matching 10% goes to independent bookshops." The wording must match each storefront's terms (spike S13).
- Opens in the browser through `expo-linking`; the app sends nothing else. Hidden entirely when `show_bookshop_links` is off. Never on fanfic.

**Costs page (website)**
- Yearly costs (Google Play registration; Apple's fee once the iOS app exists) and income by source (Play tips after Google's cut, Ko-fi, bookshop commission), updated at least yearly.
- The **iOS fund**: progress towards a year of Apple's $99 developer fee. The native iOS app (Phase 6) starts when it is covered. Any surplus carries forward and is reported.
- The Android app does not link to this page until spike S8 confirms that is allowed.

**Revisit** if the UK's proposed steering rules for app stores take effect.

### 12.13 Author feedback prompt

- Shown when `shouldPromptAuthorFeedback` is true (§7.14), right after the status change, as a small bottom-anchored card that never blocks the screen and needs no gestures.
- Copy after finishing: "Finished *Title*. Authors love hearing from readers — leave kudos or a comment on AO3?" After catching up on a WIP: "You're caught up on *Title*. A comment on the latest chapter means a lot to WIP authors."
- Actions: **Open on AO3** (opens the work in the browser, where the reader's own AO3 login applies) · **Not now** · **Don't ask again** (sets `author_feedback_prompt` to `off`; reversible in Settings).
- No counts, streaks or follow-up reminders. The app never posts anything.

### 12.14 Shared components

Location: `src/shared/components/`. Feature UI is composed from these; screens never style raw React Native components ad hoc for something a shared component covers.

| Group | Components |
|---|---|
| Actions | Button (filled, tonal, text), IconButton, LinkRow |
| Display | Text styles, Card, SectionHeader, EmptyState, Banner, Badge, Chip, LibraryRow, CoverImage (thumb/full, initials placeholder), ProgressBar, BarChart |
| Inputs | TextField, NumberField, SearchBar, DateField, ChipInput, TagChip (include → exclude → off), SegmentedControl, Stepper, Switch, Checkbox |
| Layout | Screen (safe areas and keyboard behaviour), Collapsible, ListDetailSplit, TabBar, NavRail |
| Primitive-backed | AlertDialog, DropdownMenu, Select (all on `@rn-primitives`), Snackbar (our own queue, mounted through the Portal) |
| Feature-specific | AuthorFeedbackPanel (§12.13) |

---

## 13. Privacy and Safety

### 13.1 Network allowlist

All network access goes through `httpClient` (`src/shared/http/httpClient.ts`), which refuses any host not on this list:

| Host | Used for | Platforms |
|---|---|---|
| `archiveofourown.org` | Work-page fetches (via `politeFetch`) | Android |
| `www.googleapis.com` | Google Books search | Android; web if spike S5 passes |
| `covers.openlibrary.org` | Book covers by ISBN | Android; web if spike S9 passes |
| `books.google.com` (and the image host it redirects to, confirmed in spike S9) | Google Books cover thumbnails | Android; web if spikes S5 and S9 pass |
| A reader-chosen image address | One cover download the reader asked for (§10.9) | Android only |
| The app's own website origin | Static assets, service worker | Web |

The reader-chosen image address is the only exception to a fixed host list: one user-initiated download that must return an image, never a web page.

`Linking.openURL` (opening AO3, the privacy policy, Ko-fi on web, bookshop links, `mailto:`) hands off to another app and is not app network access. There are no analytics, crash-reporting or font CDNs; fonts are bundled.

### 13.2 Device-level protection

- **App lock (Android):** `expo-local-authentication` with biometric or device credential. Locks on launch and after `lock_after_seconds` in the background. If the device has no lock set up, the option explains why it is unavailable.
- **Screen privacy (Android):** `expo-screen-capture` hides app content in recent apps and blocks screenshots when `screen_privacy` is on.
- **Photo access (Android):** covers use the system photo picker, which needs no permission. Remove the broad media permissions `expo-image-picker` adds (`READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`) with `android.blockedPermissions`; Google Play allows broad photo access only for apps whose core purpose needs it. Keep `CAMERA` for barcode scanning.
- **On iOS (Phase 6)**, the database is excluded from iCloud and computer backups for the same reason (§2.4).
- **Android Auto Backup is disabled** (`android.allowBackup: false`) so library data never leaves the device without the user choosing to export it. The `.bookmark` file is the backup (§22, provisional).
- **Web:** call `navigator.storage.persist()` where supported and show the result in Settings → Sync & backup ("Storage: protected" / "Storage: may be cleared by the browser").

### 13.3 Untrusted input

Capture payloads, pasted text, imported CSV and `.bookmark` files are untrusted. Validate with Zod, cap sizes, never evaluate or render them as HTML, and show a preview before writing. AO3 HTML is parsed as text and never rendered. Images are decoded and re-encoded before storage; originals are never kept.

---

## 14. Theming, Accessibility and Language

- **Theme:** `global.css` at the project root imports Tailwind and Uniwind and defines semantic tokens (surface, on-surface, primary, warning, and so on) as CSS variables for the light, dark and black (true black for OLED) themes. `src/app/theme/` owns theme selection: it reads the `theme` setting, follows the system scheme when it is `system`, and switches the Uniwind theme. Components use semantic token classes only; nothing outside `global.css` and `src/app/theme/` names a raw colour.
- Theme colours are chosen to meet WCAG 2.2 AA contrast for text and essential UI in every theme; contrast is checked when tokens change.
- Warnings, ratings and states are never shown by colour alone: always an icon plus text.
- Touch targets at least 48 dp. Every interactive element has an accessible label and role (tabs use `tablist` / `tab`, dialogs trap focus, menus support arrow keys and Escape on web). Layouts survive 200% font scale without clipping. Respect reduced motion. Visible focus rings on web.
- Safe areas: headers handle the top inset; bottom-pinned elements use `useSafeAreaInsets().bottom`; never hard-code inset padding.
- All user-facing strings go through `t('key')` from `src/shared/i18n/` (English only at launch). Dates and numbers use `Intl` with the device locale (`"100,432 words"`, `"13 Oct 2026"`).

---

## 15. Errors

```ts
// src/shared/types/errors.ts
export type AppErrorCode =
  | 'db' | 'network' | 'parse' | 'validation' | 'not_found'
  | 'rate_limited' | 'restricted' | 'unsupported_version' | 'wrong_passphrase' | 'storage_full';
export interface AppError { code: AppErrorCode; message: string; retryAfterMs?: number }
```

Repositories, services and parsers map raw errors to `AppError`; users never see SQL, stack traces or raw HTTP text. Form validation shows inline field errors; transient results show a snackbar; initial loads show a screen-level state with **Try again**; each route has an error boundary for unexpected failures; database failures use the screen in §8.5.

---

## 16. Testing and Quality

- **Domain (Jest):** `applyProgressChange`, `planAo3Update`, `applyFilters` and search, `countActiveFilters`, `selectWipCheckTargets`, `pickNextRead` (seeded `random`), `computeStats`, `seriesOverview`, `stripAo3OwnedFields`, `summarizeChanges`, `coverVisibility`, `coverCandidatesFromSnapshot`, `selectCoverFetchTargets`, `validateImageInput`, `bookshopLinkFor`, `shouldShowTipCard`, `shouldPromptAuthorFeedback`, fractional indexing, HLC, `mergeRows`.
- **Sync properties (`fast-check`):** for random operation sequences on up to three simulated devices, merge is commutative, associative and idempotent, and all devices converge after exchanging files in any order. Aliases resolve to the same canonical ids everywhere. A file exported without covers never removes covers.
- **Parsers:** saved fixtures for work pages (complete, WIP with `?`, single chapter, multi-author, anonymous, orphaned, series with unknown total, adult interstitial, restricted, challenge/error page, images in notes and chapter text including http-only and more than 10) and for listing pages, copied text and capture payloads (valid, oversized, malformed, wrong version, with and without `listSource`). Refresh fixtures during spike S2 and whenever a parser test fails against a live page reported by a user. Tests never contact AO3.
- **Repositories and migrations:** run against `createTestDb` (`better-sqlite3`). Every migration path from each released schema to the latest is tested.
- **Shared components:** Testing Library tests for roles, labels, disabled and selected states, and keyboard behaviour of the primitive-backed components on web.
- **Architecture lint:** ESLint enforces the §5.2 rules that a lint rule can express, using `no-restricted-syntax`, `no-restricted-imports` and `no-restricted-globals` with file-path overrides:
  - no `Platform.OS` outside `src/platform/`;
  - no `fetch` outside `src/shared/http/`;
  - no `AsyncStorage` or `localStorage`;
  - no raw colours (hex, `rgb(`, named) outside `global.css` and `src/app/theme/`;
  - no imports of `react-native-paper`, blur or chart libraries;
  - no Ko-fi references in native code or shared code reachable from it;
  - no `any`, and no `@ts-ignore`;
  - no `DELETE FROM` on a synced table outside repository files (`src/features/*/data/*Repository.ts`). Review confirms each one is inside `purgeTombstonesOlderThan` (§8.6).

  Rules that lint cannot express are covered by repository tests and review: every synced write ticks the HLC and stamps `field_clocks`; synced rows are tombstoned and hard-deleted only by the tombstone purge (§8.6); AO3-owned fields are written only by AO3 updates (`applyAo3Fields` with a `planAo3Update` patch) and user patches pass through `stripAo3OwnedFields`; user-facing text goes through `t()`.
- **E2E:** Maestro flows on Android (add by link against a local fixture server, +1 progress, capture paste, export and re-import); Playwright on the web build (install banner, capture paste, sync file import, offline reload, tab bar switching to nav rail at 900 px).
- **Performance budgets:** cold start to interactive under 2 s with 2,000 readables on a mid-range Android phone; filtering under 100 ms with 5,000.
- **CI:** typecheck, lint (including the architecture rules), unit tests and the web build on every push (GitHub Actions; free for public repositories).

---

## 17. Naming and Folder Structure

| Kind | Convention | Example |
|---|---|---|
| Route files | Expo Router conventions, lowercase | `app/readable/[id]/index.tsx` |
| Components, screens | PascalCase | `ReadableDetailScreen.tsx` |
| Hooks | `use` prefix | `useReadables.ts` |
| Repositories / services / parsers / mappers | suffix | `readableRepository.ts`, `wipCheckService.ts`, `ao3WorkParser.ts`, `readableMapper.ts` |
| Pure rules | descriptive camelCase | `progressRules.ts`, `ao3Update.ts` |
| Platform splits | `.native.ts(x)` / `.web.ts(x)`, in `src/platform/` only | `files.native.ts`, `dateInput.web.tsx` |
| Key factories | `queryKeys.ts` per module | — |

UK spelling for identifiers that match user-facing words (`isFavourite`, `favouritesOnly`). Avoid vague names (`helpers`, `manager`, `temp`) inside features.

```
CLAUDE.md                     Claude Code instructions; points to this spec
CHANGELOG.md                  history of spec and stack changes
docs/                         BOOKMARK_SPEC.md (this file), VISION.md
.claude/                      agents/ (explorer, implementer, reviewer), settings.json, skills/
global.css                    Tailwind + Uniwind imports and theme tokens (Uniwind scans from here)
app/                          routes only (§12.1)
src/
  app/                        theme/ (theme selection), providers/, i18n setup
  db/                         Db.ts, createExpoDb.ts, createTestDb.ts, writeQueue.ts,
                              DatabaseProvider.tsx, useDb.ts, migrations/
  platform/                   capabilities, files, clipboard, share, lock, keepAwake,
                              persistStorage, dateInput (.native / .web)
  features/
    readables/  notes/  shelves/  series/  ao3/  books/  covers/  updates/
    discovery/  stats/  sync/  settings/  support/  privacy/  onboarding/
      (each: domain/ data/ services/ hooks/ ui/ index.ts — only the folders it needs)
  shared/
    components/  hooks/  i18n/  types/ (errors.ts)
    http/ (httpClient.ts, politeFetch.ts)
    utils/ (clock.ts, json.ts, ids.ts, fractionalIndex.ts, normaliseText.ts)
  uniwind-types.d.ts          generated by Uniwind
tools/
  capture-bookmarklet/        source, build script, install page template
web/
  public/                     _headers, manifest.webmanifest, icons, privacy.html, capture.html
  workbox.config.js
```

`.gitignore` also excludes personal and local files: `CLAUDE.local.md`, `.claude/settings.local.json`, and generated tool output such as `graphify-out/`.

Circular type dependencies are extracted to `src/shared/types/` and flagged.

---

## 18. Release and Hosting

### 18.1 Google Play checklist

Confirm each item against the current Play Console help before each release.

- **Account:** personal accounts created after 13 November 2023 need a closed test with at least 12 testers opted in for 14 continuous days before production access. Check the current registration fee when creating the account.
- **Build:** Android App Bundle via EAS.
- **Privacy policy and Data safety:** every app completes the Data safety form and links a privacy policy, even when it collects nothing. Host the policy on the app's website (§18.2). It states: data stays on the device; the app contacts AO3 (work URLs you add or check), Google Books (your searches), Open Library (ISBNs of books you want covers for) and any image address you choose for a cover; images you pick from your photos stay on your device; no analytics, ads or accounts; Android Auto Backup is off; feedback is sent only when you send an email.
- **Payments policy:** tips only through Google Play billing; no mention of or link to Ko-fi or any other payment method anywhere in the Android app or its store listing. `canShowSupportLink` is false in Play builds and `KOFI_URL` is not set in the Play build profile.
- **If Android tips are enabled:** set up a Google payments profile (merchant account) and tax details; enrol in the 15% service-fee programme; accept that **the payments profile's full address is shown publicly on Google Play** (spike S14). Data safety: purchases are handled by Google Play; the app stores no purchase records and sends nothing.
- **Bookshop links:** they sell physical books outside the app, which Play billing does not cover; confirm before release (spike S13).
- **Affiliation:** the listing and About screen carry the not-affiliated statement (§12.10); no AO3 branding.
- **Photo and video permissions:** the app uses the system photo picker and declares no broad media permissions (§13.2).
- **API key:** Google Books key restricted to the package name and signing certificate.
- **Content rating questionnaire:** answer honestly; the app shows AO3 ratings and warnings chosen by users but hosts no works.

### 18.2 Web hosting checklist

- `expo export --platform web` (static output) plus the Workbox service worker and `manifest.webmanifest` (`display: standalone`, name, icons, theme colour).
- Free static host with custom headers (spike S6). The `_headers` file applies to every route:
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: require-corp` (Safari does not support `credentialless`)
  - a strict `Content-Security-Policy` for the app's own pages: `img-src 'self' blob: data:`; `connect-src 'self'` plus Google Books and Open Library only if spikes S5 and S9 pass
- Because of `require-corp`, everything the page loads must be same-origin or send CORP/CORS headers: bundle fonts and icons, use no third-party embeds. Uniwind's compiled CSS is part of the bundle.
- The same site hosts `privacy.html`, `capture.html` (bookmarklet install instructions per browser), `costs.html` (the public costs page and iOS fund) and the Ko-fi link.
- Google Books key restricted by HTTP referrer to the site's origin.

### 18.3 Versions and compatibility

- App: semantic version, shown in About and in feedback emails.
- `schemaVersion` (database), `bookmark-sync` file version, `bookmark-capture` payload version and capture `toolVersion` are versioned separately.
- An app reads sync files of its own and older schema versions and refuses newer ones (§9.4). Android and web (and iOS from Phase 6) are released together from the same commit so their schema versions match.

### 18.4 App Store checklist (Phase 6)

Confirm each item against Apple's current guidelines and App Store Connect help before release.

- **Membership:** Apple Developer Program, $99 a year (or the local equivalent). Individuals are not eligible for fee waivers. Paid from the iOS fund (§12.12).
- **Builds:** EAS builds and submits iOS apps on cloud Macs, so no Mac is strictly required. Use a Mac (or a borrowed one) for the iOS simulator. TestFlight for testers.
- **Privacy:** App Privacy details declare no data collected (re-check every release); privacy policy URL on the website, updated to mention iOS and iCloud backup exclusion.
- **Age rating:** answer the questionnaire honestly. Summaries, tags and warnings shown for Mature/Explicit works mean a high age rating is likely.
- **Name and branding:** no "AO3" or "Archive of Our Own" in the app name, subtitle or icon; the not-affiliated statement in the description and About.
- **Review notes:** explain that the app tracks the reader's own reading, fetches public AO3 work pages only when the reader asks, stores no work text, needs no account, and give test steps.
- **Payments:** tips only through Apple in-app purchase; no links or calls to action for Ko-fi or other payment methods in the app or its metadata. Enrol in the Small Business Program (15%) and complete the Paid Applications Agreement, banking and tax only if tips are enabled.
- **EU trader status:** declare it for EU distribution. Accepting tips probably makes the developer a trader, and traders' contact details are shown on EU storefronts. Decide before enabling tips (spike S15).
- **Bookshop links:** links to buy physical books are outside in-app purchase rules; confirm (spike S15).
- **Encryption:** answer App Store Connect's export compliance question. The app encrypts the user's own sync files with standard algorithms, which is commonly exempt; confirm (spike S15).
- **Permissions:** usage descriptions present for every permission the app requests (§2.4).

---

## 19. Roadmap

Each phase ends with its tests passing and a usable build.

| Phase | Contents | Exit criteria |
|---|---|---|
| **0. Spikes and setup** | Spikes S1–S8 and S17 (§21; S17 first, because it can change the stack; S9–S12 before Phase 4); repository, CI, architecture lint rules (§16), Expo Router skeleton with JS tabs and nav rail, `Db` port, migrations, Uniwind theme (light, dark, black) and the shared components in §12.14; **start recruiting 12 Play testers** | Every spike has a written go/no-go; skeleton runs on Android and web with the same design |
| **1. Android core** | Readables (books and fanfic), add (manual, AO3 link, Google Books), detail, progress/status/re-read rules and events, notes journal, favourites, library search/filter/sort with content preferences, book ownership, Up Next, Home (continue reading, new chapters, Up Next), update check and inbox, author feedback prompt, settings, `.bookmark` export and merge import (sync-ready from the first row), onboarding, privacy policy page | Closed test running on Play |
| **2. Capture and web** | Capture tool and install page, pasted-text parser, `/capture`, Android share intent, web build and PWA, hosting with headers, iPhone install guidance, responsive layout | An iPhone user can install the web app, capture a work from Safari and see it in the library |
| **3. Sync** | Passphrase encryption, device labels, merge summary, alias handling, backup reminders, sync log | Property tests pass; Android ↔ iPhone round trip by file works |
| **4. Discovery and organisation** | Manual and smart shelves, rec-list import to shelves, series screen, picker, stats with authors who made your year, bulk actions, covers (all sources, bulk book covers, credit, display settings, covers in sync files) | — |
| **5. Imports and extras** | AO3 link-list import queue, Goodreads CSV import, CSV export, barcode scan, app lock and screen privacy, bookshop links, Ko-fi on web, costs page, Android tips (only if enabled) | Production release on Play |
| **6. iOS and research** | Native iOS app (§2.4, §18.4): `ios` target and capabilities, share extension, backup exclusion, screen-privacy overlay, permission text, web-to-native migration step, Apple tips (only if enabled), App Review. Same Uniwind design and JS tabs as the other platforms. Starts once the iOS fund covers a year; spikes S15–S16 first. Research live device-to-device sync and an Android widget | iOS: approved on the App Store and a web-to-native sync round trip works. Research: decide whether to build |

Phase 1 includes `.bookmark` export because it is the only backup; everything else about sync waits for Phase 3. Phases 1–5 follow the iOS-ready habits in §2.4, which keep the Phase 6 port to an estimated 4–6 part-time weeks.

---

## 20. Decisions Made in v4

| # | Decision | Why |
|---|---|---|
| 1 | Android (Play) plus a web PWA from one Expo codebase | Reaches iPhone users with no App Store fee; the web app can do everything except fetch AO3 |
| 2 | Expo Router replaces hand-written React Navigation | Real URLs, static web export, deep links, typed routes |
| 3 | `Db` port with a write queue on both platforms | Non-exclusive transactions on web; long check runs must not interleave with taps; testable in Node |
| 4 | Database and settings providers sit outside the theme provider | The saved theme is known on the first frame |
| 5 | Sync-ready schema (HLC field clocks, tombstones) from the first migration | Retrofitting means migrating every row later |
| 6 | Sync and backup are one merge-only `.bookmark` file; no server | Data stays on the user's devices; zero cost |
| 7 | Capture tool and pasted text instead of fetching on web; preferred for bulk updates everywhere | No proxy, no extra AO3 requests, works for restricted works |
| 8 | AO3-owned fields are read-only on AO3 works; user tags separate from AO3 tags | Updates can never overwrite the reader's own data |
| 9 | Change detection compares fields, not the AO3 date | Catches warning changes; no null-date edge cases |
| 10 | Status reverts when chapters posted exceed progress | Works for `?` totals, which most WIPs have |
| 11 | Fanfic progress is capped by chapters posted; WIPs never auto-complete | You cannot read a chapter that isn't posted |
| 12 | Notes become a dated journal | Richer for readers; merges without conflicts |
| 13 | Delete is a tombstone with Undo instead of a confirmation | Faster, reversible, needed for sync |
| 14 | Authors, characters and categories added; relationship, character and warning-exclusion filters added | Readers choose fic by these; warning exclusion is a safety need |
| 15 | Search covers notes and summaries | Readers remember what they wrote or what it was about |
| 16 | Local picker, Home and stats added | Delivers the project goal of suggesting the next read without other people's data |
| 17 | Re-reads, start/finish/last-read dates and status events | Fanfic readers re-read a lot; stats need history |
| 18 | Books track pages, percent or minutes | Ebooks and audiobooks |
| 19 | Android tips only through Google Play billing (off until enabled); Ko-fi only on the website and web app; Android never mentions other ways to pay | Google Play payments policy; selling in-app makes the developer's address public |
| 20 | No background AO3 checks | AO3 etiquette; AO3 already sends subscription emails |
| 21 | Covers are stored on the device as image data, never hot-linked | Works offline, survives expiring image links, and works under the web app's cross-origin isolation |
| 22 | `foreign_keys` pragma removed | There are no foreign keys, by design (§8.2) |
| 23 | Book covers come from Open Library (ISBN) or Google Books, never Goodreads | Goodreads retired its API in December 2020; Open Library offers a covers API meant for display |
| 24 | Fan art is always chosen by the reader, credited, and kept on their devices | Fandom etiquette around reposting art |
| 25 | Social sites are never fetched; the reader saves the image and picks it | Instagram's terms forbid unauthorised automated collection; the reader's own action is respectful |
| 26 | Funding is optional tips plus labelled bookshop links; no ads, subscriptions, paid features or paid iOS app | Fair to readers and acceptable to fandom; nothing is ever unlocked |
| 27 | Book ownership is owned / not owned / not set, with no borrowed option | The target readers rarely borrow; a value people won't maintain adds noise |
| 28 | Bookshop links appear only on books the reader marked not owned, are labelled, and never appear on fanfic | Relevant, transparent and opt-in by the reader's own marking |
| 29 | Costs and income are published, with an iOS fund that gates the native iOS app | Transparency; pays Apple's fee before committing to it |
| 30 | Prompt readers to leave kudos or a comment on AO3 after finishing | Sends feedback to authors where it belongs, instead of in-app reviews |
| 31 | "Authors who made your year" ranks by works finished, never by ratings | Celebrates authors without scoring them |
| 32 | Rec lists import the works and the list's name only, never other users' bookmark notes | Others' notes are their own commentary; the list is credited by name and link |
| 33 | The native iOS app is the same codebase with an `ios` target, planned for from Phase 1 | Most code carries over; iPhone users gain AO3 fetching, which the web app can't offer |
| 34 | Expo SDK 58 baseline; Uniwind with Tailwind CSS v4 replaces React Native Paper | One styling system across Android and web; tokens as CSS variables keep theming (and a future theme generator) simple |
| 35 | Our own components, with `@rn-primitives` only for dialogs, menus, selects and portals | Full control of design and accessibility; avoids re-solving focus, portals and dismissal |
| 36 | Expo Router headless JS tabs on every platform, including iOS; no native tabs | Native tabs limit styling to a few props and would need a separate web layout for the nav rail; one consistent design matters more |
| 37 | Date input through a `dateInput` platform adapter: the community date picker on native, `<input type="date">` on web | System pickers on each platform; the split stays in `src/platform/` |
| 38 | Discreet mode and all blur removed | Not needed for now; content preferences still hide works entirely, and no blur library is required |
| 39 | Architecture rules that lint can express are enforced by ESLint in CI, not only by review | A rule in prose is followed most of the time; a failing lint check is followed every time |
| 40 | Development instructions live in `CLAUDE.md` and `.claude/agents/`, which point to this spec rather than repeating it; "full files only" is replaced by "complete code only" | One source of truth; instructions loaded on every turn stay short; partial edits are allowed but placeholder code is not |

---

## 21. Spikes (verify before building on them)

| ID | Question | Blocks | If it fails |
|---|---|---|---|
| S1 | Does `expo-sqlite` web work in an iPhone home-screen web app with `require-corp`, and does data survive closing the app and rebooting? What is the storage quota? | Phase 2 | Swap the web `Db` implementation for `sql.js` with IndexedDB persistence behind the same port |
| S2 | How does AO3 respond to an anonymous fetch with `view_adult=true` for Mature/Explicit works, for restricted works, and when rate limiting? Capture fixtures. | Phase 1 AO3 | Adjust `politeFetch` result mapping |
| S3 | Does the bookmarklet run on AO3 in iOS Safari, Android Chrome and desktop browsers (AO3's Content Security Policy), and can it write to the clipboard on iPhone? | Phase 2 capture | Show the payload for manual copy; rely on pasted text |
| S4 | Which AO3 pages render work blurbs (bookmarks, history, Marked for Later, subscriptions, series, author works, search, collections, other users' bookmarks), and where does each page show its list name? | Phase 2 bulk updates; Phase 4 rec lists | Document the supported pages only |
| S5 | Can the web app call the Google Books API from the browser, and does an HTTP-referrer key restriction work with it? | Web book search | Hide book search on web; manual entry and Android search remain |
| S6 | Does the chosen free host apply `_headers` (COOP/COEP) on the free plan, with a single-page-app fallback? | Phase 2 hosting | Try another free host with custom headers |
| S7 | Does AO3 allow cross-origin reads from a browser? (Informational; the design does not depend on it.) | — | — |
| S8 | Is a link from the Android app to the project website (which also hosts the Ko-fi link) acceptable on Play? | Phase 1 About screen | Link only to the privacy policy page, which carries no donation link |
| S9 | Can the web app download images from `covers.openlibrary.org` and the Google Books thumbnail host (CORS)? | Automatic covers on web | Web uses photos only; Android finds covers and sync files carry them to the web app |
| S10 | Do `expo-sqlite` BLOBs work on web, and how do 1,000 covers (about 80 MB) affect storage, startup and importing a large sync file on a mid-range Android phone and an iPhone? | Phase 4 covers | Store web cover images in IndexedDB behind `coverRepository` |
| S11 | Does `expo-image-picker` work in an iPhone home-screen web app, and are HEIC photos converted or decodable on Android and web? | Phase 4 covers | Ask the reader to choose a JPEG or PNG, or a screenshot |
| S12 | Do image hosts common on AO3 (Tumblr, Imgur, Discord, Google Drive) serve images to a plain app download? | AO3 page covers on Android | Fall back to the save-to-photos route |
| S13 | Bookshop.org affiliate details: link format by ISBN, which storefronts exist, terms for use in an app, required disclosure wording; and confirmation that Google Play allows links to buy physical books | Bookshop links | Hide links in regions or cases that don't fit |
| S14 | Selling tips on Google Play as an individual: payments profile and tax setup, and whether a business or PO-box address is accepted for the public address | Android tips | Keep Android tips off; Ko-fi on web only |
| S15 | Apple specifics for an individual developer: what EU trader status means when accepting tips; whether links to buy physical books are acceptable; the encryption export-compliance answer; the likely age rating | Phase 6 release | Keep iOS tips off; drop bookshop links on iOS; adjust the listing |
| S16 | iOS technical: `expo-share-intent` share extension with an App Group in a development build; excluding the `expo-sqlite` database from iCloud backup via a config plugin; the screen-privacy overlay on app switch | Phase 6 build | Ship without share-from-Safari at first (capture and paste still work); find another way to exclude the database from backup before release |
| S17 | On SDK 58 / React Native 0.88: do Uniwind and `@rn-primitives` (AlertDialog, DropdownMenu, Select, Portal) work on Android and in the static web export under `require-corp`, with correct roles, focus trapping and keyboard support on web; and does runtime theme switching (light, dark, black) apply on the first frame? | Phase 0 | Build the four primitive-backed components ourselves on React Native `Modal` with focus handling; keep Uniwind |

---

## 22. Provisional Decisions (confirm or change)

1. Android Auto Backup is disabled; the `.bookmark` file is the only backup. Alternative: enable it and disclose that Google stores an encrypted copy in the user's account.
2. Notes are a dated journal rather than a single text field.
3. Single deletes use Undo with no confirmation; bulk deletes confirm.
4. Tombstones are purged after 180 days, through each synced repository's `purgeTombstonesOlderThan`; `id_aliases` rows are never purged.
5. Statuses stay at four; "waiting for the author" is the derived caught-up state, not a status.
6. A check run fetches at most 60 works.
7. Settings are per device, except content preferences, which sync.
8. The updates inbox is per device and not synced.
9. Web hosting on Cloudflare Pages (or another free host with custom headers) using its default subdomain.
10. Book progress units are pages, percent and minutes.
11. The Ko-fi link appears only on the website and web app; Android tips are off until the owner enables them.
12. Identifiers use UK spelling to match user-facing copy.
13. Picker weights as in §7.9.
14. Stats have no goals or streaks.
15. Up Next uses the fixed id `shelf_up_next` on every device.
16. Read inbox entries are purged after 90 days.
17. Covers are stored as JPEG at 600 px (full) and 160 px (thumbnail), quality 0.8.
18. `cover_display` defaults to Everywhere.
19. Sync files include covers by default; only the full-size image travels and thumbnails are regenerated on import.
20. The bulk cover job handles at most 200 books per run, one request every 3.5 s.
21. Artist credit is prompted but not required.
22. Images from AO3 work pages are marked as fan art by default.
23. Books with no ISBN get no bookshop link.
24. Bookshop links are shown by default (they only appear on books marked not owned); a setting hides them.
25. Ownership starts unset; a scanned book defaults to owned; a Goodreads import leaves it unset unless Owned Copies is above 0.
26. The Home tip card appears at most once, after 30 days of use.
27. Three tip sizes, priced in Play Console.
28. The author feedback prompt defaults to after finishing only; the caught-up prompt for WIPs is opt-in.
29. The prompt appears at most once per read of a work (and once per new chapter count when caught up).
30. Authors who made your year shows up to 10 authors.
31. Rec-list imports include works already in the library by default.
32. iOS excludes the database from iCloud and computer backups, matching Android's disabled Auto Backup.
33. The Ko-fi link never appears in the iOS app, in any storefront (simpler than per-storefront rules).
34. iOS tips sit behind `IOS_TIPS_ENABLED`, off by default.
35. The iOS app uses the same Uniwind design and JS tabs as Android and web.
36. Discreet mode is removed for now; it may return later as a hide-until-tapped cover rather than a blur.
37. The tab bar switches to a navigation rail at 900 px wide.
38. The date picker starts on `@react-native-community/datetimepicker`; Expo UI's drop-in replacement can be adopted later with an import change.
39. The Up Next seed uses fixed values and `GENESIS_HLC` on every device (§7.7, §9.2), and `hlc_last` starts unseeded.

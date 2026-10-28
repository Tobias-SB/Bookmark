# Bookmark
 
Local-first reading tracker for books and AO3 fanfic. One Expo codebase builds an Android app (Google Play) and a web PWA.
 
- **Spec:** `docs/BOOKMARK_SPEC.md` is the source of truth. Read it by § number, never in full.
  - The architecture rules are in spec §5.2. The principles are in spec §1.
- **Vision:** `docs/VISION.md` is aspirational and never overrides the spec.
- **History** goes in `CHANGELOG.md`, never in code comments.
# Commands
 
Subagents run exactly these.
 
| Purpose | Command |
|---|---|
| Type-check | `npm run typecheck` |
| Lint | `npm run lint` |
| Unit tests | `npm test` |
| Single test file | `npm test -- <path>` |
| Web export | `npm run export:web` |
| Uncompressed output (bypass RTK) | `rtk proxy <cmd>` |

Jest runs `*.test.ts` in Node and `*.test.tsx` in the React Native preset. Test files live in `__tests__/` under `src/`, never under `app/`, where they would become routes.
 
# Decisions
 
- **Before feature work,** read spec §1, spec §5.2 and the section for the feature.
  - If a request conflicts with a principle, say so first.
- **If code and spec disagree,** flag it, then follow the code unless told to realign.
- **If the spec is silent,** say so, take the simplest consistent option, and mark it provisional.
- **Stop and ask instead of choosing** for any of these:
  - a database column or settings key
  - a `.bookmark` sync-file field or capture-payload field
  - `AO3_OWNED_FIELDS` membership
  - anything hard to undo
- **Pre-release schema changes** edit `001_initial.ts` in place. Development installs must clear app data.
# Gotchas
 
- **React Native Paper and discreet mode/blur were removed in v4.5.** Older notes still mention them.
  - Styling is Uniwind semantic token classes.
  - Components are our own, in `src/shared/components/`.
  - `@rn-primitives` is only for AlertDialog, DropdownMenu, Select and Portal.
- **Installed package versions win over the spec's baseline** (SDK 58 and so on).
  - Confirm APIs in the installed `.d.ts`, never from memory.
- **Spec-mandated items are requirements, not YAGNI.** Ponytail's minimalism does not apply to: HLC field clocks, tombstones, the write queue, Zod validation, accessibility and tests.
- **This machine is Windows.** Run shell commands through Bash, not PowerShell, or RTK won't compress them.
- **Graphify:**
  - `graphify-out/` is git-ignored.
  - Only the main session runs `graphify update .`, and only after merging.
  - For a TypeScript symbol, use the LSP first.
  - For cross-cutting questions, run `graphify query`, `graphify path` or `graphify explain` before broad grep.
# Skills (agent-skills plugin)
 
The decision rules in this file override the plugin's `using-agent-skills` defaults. In particular, a minor spec gap gets a provisional choice, not a full stop.
 
**Use:**
- `planning-and-task-breakdown`: for plans.
- `incremental-implementation` and `test-driven-development`: for building.
- `code-review-and-quality`: for the reviewer. The checklist in `.claude/agents/reviewer.md` comes first.
- `source-driven-development`: when it conflicts with official docs, the installed `.d.ts` wins.
- `security-and-hardening`: for parsers, capture, imports and sync files.
- `debugging-and-error-recovery`, `git-workflow-and-versioning` and `ci-cd-and-automation`.
**Don't use:**
- `spec-driven-development`, `interview-me`, `idea-refine`: the spec exists. Spec changes are edits to `docs/BOOKMARK_SPEC.md`.
- `observability-and-instrumentation`: no telemetry, analytics or remote logging (spec §1, principle 2).
- `documentation-and-adrs` for ADR files: decisions go in spec §20, and history goes in `CHANGELOG.md`.
- `code-simplification` and `/simplify`: ponytail and the reviewer cover simplicity.
- `browser-testing-with-devtools`: web E2E is Playwright (spec §16).
**Use only when the hub asks:**
- `doubt-driven-development`: for HLC and merge, or AO3 parsers.
- `shipping-and-launch`: monitoring means Google Play's Android vitals only.
# Contract files
 
Only the main session edits these. A subagent that needs a change here stops and reports the exact change.
 
- `src/shared/types/`
- `src/db/` (including `migrations/`)
- `global.css`, `src/app/theme/`
- `src/platform/capabilities.ts`
- `package.json`, the lockfile, `app.config.ts`, Metro and Babel config
- `CLAUDE.md`, `docs/`, `CHANGELOG.md`, `.claude/`
# Red flags
 
Each hit is a defect unless it is in the allowed location or explicitly justified. ESLint enforces these once scaffolded; until then, reviewers grep for them.
 
- `Platform.OS` outside `src/platform/`
- `fetch(` outside `src/shared/http/`
- `AsyncStorage` or `localStorage`, anywhere
- `DELETE FROM` on a synced table (`readables`, `notes`, `shelves`, `shelf_items`, `reading_events`, `covers`, `id_aliases`). The only exception is a repository's `purgeTombstonesOlderThan`, which deletes only tombstones older than the cutoff (spec §8.6).
- A write to a synced table that doesn't tick the HLC and stamp `field_clocks`. `id_aliases` has no field clocks; it records `created_hlc` instead.
- Raw colours (hex, `rgb(`, named) outside `global.css` and `src/app/theme/`
- `react-native-paper`, or any blur or chart library
- `ko-fi` or `KOFI_URL` reachable from native code
- `any`, an `as` cast used to silence an error, or `@ts-ignore`
- JSX text not wrapped in `t()`
- A stored rating, review, score, kudos count or hit count
- An AO3-owned field written other than by an AO3 update (`applyAo3Fields` with a `planAo3Update` patch), or a user patch on an AO3 work that skips `stripAo3OwnedFields`
# Review standards
 
- **Async error handling** (CRITICAL when missing). Every async failure maps to `AppError` (spec §15). Users never see raw errors.
- **Duplication** (WARNING). Logic repeated more than twice should be extracted.
- **Function length** (WARNING). A function over about 30 lines should be split. Exempt: a function that implements a single spec rule table, or a field-by-field parser.
# Subagents
 
`explorer`, `implementer` and `reviewer` are defined in `.claude/agents/`. The main session is the hub: it owns the plan, the contract files and merges.
 
- **No parallel implementers** until the Phase 0 foundation is merged.
  - The hub builds the foundation on a `phase-0/foundation` branch, one commit per step. The reviewer reviews each step with the previous step's commit as the base (`main` for the first step).
  - After that, run them only on disjoint folders, each in its own worktree.
- **Every brief contains:**
  - the goal
  - the spec sections (§ numbers)
  - the files the spoke may change
  - the acceptance criteria
  - the check commands
  - the worktree path or branch, and the base branch to diff against
- **Models:**
  - Explorer: Haiku.
  - Implementer and reviewer: Sonnet by default.
  - Opus for HLC and merge, AO3 parsers, `planAo3Update` and migrations.
  - A reviewer is never a weaker model than the implementer it reviews.
- **Spikes** (spec §21) that need a device, a live AO3 page or a store console go to the owner as manual steps. Never mark one passed without that evidence.
 
# Change Log

## 0.7.1

Code-review fixes over 0.7.0.

### Fixed
- Overlapping `_onEvent` runs (async terminal lookups) could send duplicate
  or out-of-order heartbeats; overlapping calls now collapse into one
  trailing rerun.
- Basic Auth credentials with special characters were double-encoded in the
  server URL; URL building moved to a unit-tested `src/server.ts`.
- Unbounded PID→cwd cache is now capped.

### Added
- Windsurf mapping for distinct editor buckets.
- All terminal cwd lookups resolve concurrently (one hung lookup no longer
  stalls the rest).

### Changed
- `repository` / `bugs` URLs point at ActivityWatch/aw-watcher-vscode
  (the 0.7 line is now upstream; see Contributors in the README).
- `enabled` / `serverUrl` setting descriptions note the Reload requirement.

## 0.7.0

Roll-up release merging all pending community contributions, adapted to the
v0.6.0 fetch-based stack.

### Added
- Terminal tracking: active terminal name + cwd (shellIntegration with `lsof`
  PID fallback), same-name disambiguation, all-terminal labels, terminal_count
  (PR #48, supersedes PR #44; fixes #43).
- Editor enrichment: cursor position, Git dirty count + remote URL, debug
  session state, open editors, relative file path, window focus state,
  multi-root workspace folders (PR #48).
- `editor` heartbeat field with the dynamic app name (PR #39).
- `workspace` heartbeat field from the `.code-workspace` name (PR #36).
- Distinct client/bucket names for Cursor, VSCodium, Antigravity (PR #50).
- `authUser` / `authPassword` settings for HTTP Basic Auth behind an nginx
  reverse proxy (PR #51, adapted: credentials ride in the server URL since
  the fetch-based client has no axios instance).
- `untrustedWorkspaces` support declaration (PR #40).
- README: editor-vs-total-time explanation (PR #54), WSL port-forwarding
  notes (PR #37), compatible-editor buckets (PR #50).

### Fixed
- `maxHeartbeatsPerSec` ignored at any rate: `_lastBranch` was never stored,
  so every event sent a heartbeat; fractional values like `0.5` now work
  (PR #53, fixes #49).
- Extension Host debug-console spam: logging moved to an `ActivityWatch`
  Output channel (PR #53, fixes #30).
- Heartbeat failures no longer raise a modal per failure and no longer log
  `undefined` (proper `FetchError` message extraction; #12, #13).
- `serverUrl` / `enabled` settings were declared but never read; they are
  now honoured (with client recreation on Reload), covering custom ports
  (#27) and remote setups.
- Only the focused window sends heartbeats, preserving pulse merging with
  multiple windows open (#38); Git branch resolves per-file repo (#41).
- Missing `vscode.git` extension no longer throws during init.

### Obsolete / not merged
- PR #44 terminal tracking: superseded by the richer PR #48.
- PR #31 remote-dev hack: 3-arg `AWClient` no longer exists; covered by #18.
- Dependabot axios/nanoid/mocha bumps (#28, #32–#34): axios removed in 0.6.0.

## 0.6.0

### Changed
- **Node 18+ required** (for global `fetch` support in `aw-client-js`).
- Bumped `engines.vscode` from `^1.23.0` to `^1.85.0` (matches current stable VS Code).
- Bumped `typescript` from `4.1.x` to `5.6.x`; compiled output target is now `es2022`.
- Replaced deprecated `tslint` with `eslint` + `@typescript-eslint`.
- Added `@vscode/test-cli` / `@vscode/test-electron` and a `.vscode-test.js` config in place of the deprecated `vscode-test` runner.
- Tightened `activationEvents` from `["*"]` to `["onStartupFinished"]` so the extension does not run on every VS Code start.
- Updated the nested `aw-client-js` submodule to its current master (`6093fbb`) — the new client uses global `fetch` instead of `axios`, so `axios` is no longer a dependency.
- Updated the nested `media` submodule to its current master (`a45151`).

### Added
- New settings `aw-watcher-vscode.enabled` and `aw-watcher-vscode.serverUrl` to disable the watcher or point it at a custom AW server.
- `.eslintrc.json` / `.prettierrc.json` / `.eslintignore` for linting and formatting.
- GitHub Actions CI workflow (`.github/workflows/ci.yml`) that lints, compiles, tests, and builds a `.vsix`.
- `npm run package` script using `@vscode/vsce`.

### Fixed
- Heartbeat catch handler no longer relies on `{ err }` destructuring (the new `aw-client-js` throws `FetchError`, not `{ err, httpResponse, data }`).
- `_onEvent` catch no longer uses `any`; the error message is extracted via `instanceof Error`.
- `git init` no longer crashes when the built-in Git extension isn't installed.
- `vscode.git` extension lookup is now null-safe.

### Security
- Removed `axios ^0.21.1` (CVE-2021-3749, CVE-2023-45857). The new `aw-client-js` uses native `fetch`.

## 0.5.0

### Changed
- Updated publisherId to `activitywatch`.
- Added support for VSCodium.
- Added support for VSCode remote.

## 0.4.1

Updated aw-client-js, media and npm dependencies.

## 0.4.0

Updated submodules aw-client-js and media to latest

fix the extension to work with the latest aw-client:
- AppEditorActivityHeartbeat --> AppEditorEvent
- createBucket --> ensureBucket
- options object in AWClient constructor
- timestamp should be a Date not a string

## 0.3.3

Fixed security vulnerability of an outdated dependency.

## 0.3.2

Added `maxHeartbeatsPerSec` configuration.

## 0.3.0

Refined error handling and heartbeat logic.

## 0.2.0

Refined error handling and README.

## 0.1.0

Initial release of aw-watcher-vscode.

<!--- https://keepachangelog.com/en/1.0.0/ -->

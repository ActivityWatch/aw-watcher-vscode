# Change Log

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

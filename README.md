# aw-watcher-vscode

This extension allows [ActivityWatch](https://activitywatch.net), the free and open-source time tracker, to keep track of the projects and programming languages you use in VS Code.

The extension is published on [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=activitywatch.aw-watcher-vscode) and [Open VSX](https://open-vsx.org/extension/ActivityWatch/aw-watcher-vscode).

The source code is available at https://github.com/ActivityWatch/aw-watcher-vscode

## Features

Sends following data to ActivityWatch:
- current project name and file name (plus path relative to the project root)
- programming language
- current Git branch, uncommitted change count, and remote URL
- workspace name (from the `.code-workspace` file)
- editor name (VS Code, Cursor, VSCodium, …)
- active terminal name and working directory
- cursor position, debug session state, and open editors

Currently VS Code extensions don't support getting file/project names for non-editable files, therefore this results in the value "unknown" for those properties. (For instance when opening logo.png this happens)

## Editor activity and total VS Code time

This watcher records editor activity when the active text editor or its selection
changes. Keeping VS Code focused does not continuously send editor heartbeats.
Typing in the integrated terminal or interacting with a sidebar can therefore be
missing from the editor bucket. That bucket is not a total of all VS Code usage.

For total application usage, keep your window watcher and `aw-watcher-afk` running.
In ActivityWatch's **Activity** view, select the correct host and date, then look
for VS Code in **Top Applications** (for example, `code` on Linux/X11). Leave AFK
filtering enabled to exclude idle periods according to your AFK timeout. This
includes active use of terminals and sidebars while the VS Code window is active,
but does not identify the pane, terminal command, file, or project used.

Application names vary across platforms and VS Code variants. Window tracking
requires a watcher compatible with your desktop; see the
[window watcher list](https://docs.activitywatch.net/en/latest/watchers.html#window-watchers),
including the alternatives for Wayland.

## Requirements

This extension requires ActivityWatch to be running on your machine.

## VS Code-compatible editors

When this extension runs in VS Code-compatible editors, it uses a distinct
ActivityWatch client and bucket name for each known editor so their activity
streams do not overlap:

- VS Code: `aw-watcher-vscode`
- VSCodium: `aw-watcher-vscodium`
- Cursor: `aw-watcher-cursor`
- Windsurf: `aw-watcher-windsurf`
- Antigravity: `aw-watcher-antigravity`

## Install Instructions

To install this extension, search for aw-watcher-vscode in the Extensions sidebar in VS Code, and install the one with ActivityWatch as the publisher name. And that's it, if Activity Watch was running, it should detect this vs-code watcher automatically. Give it some time to have some data to display and it should show in the ActivityWatch Timeline and Activity sections soon.

## Commands

#### Reload ActivityWatch

Use this in case VS Code has been started before the AW server.

## Extension Settings

This extension adds the following settings:

- `aw-watcher-vscode.maxHeartbeatsPerSec`: Controls the maximum number of heartbeats sent per second. Fractional values are allowed (e.g. `0.5` sends one heartbeat every 2 seconds).
- `aw-watcher-vscode.enabled`: Enable or disable the ActivityWatch editor watcher (default: `true`).
- `aw-watcher-vscode.serverUrl`: Optional ActivityWatch server URL. Leave empty to use the default (`http://127.0.0.1:5600`).
- `aw-watcher-vscode.authUser` / `aw-watcher-vscode.authPassword`: Optional HTTP Basic Auth credentials, for servers behind an nginx reverse proxy with `auth_basic`. Change takes effect after the **Reload ActivityWatch** command (or a window reload).

## Requirements

- VS Code `1.85.0` or later.
- Node `18` or later (only needed if you build the extension from source).
- A running ActivityWatch server (the extension connects to `http://127.0.0.1:5600` by default).

## Development

```sh
git clone https://github.com/ActivityWatch/aw-watcher-vscode
cd aw-watcher-vscode
git -c core.symlinks=false submodule update --init --recursive
npm install
npm run lint
npm run compile
npm run test:mocha        # unit tests (no extension host)
npm test                  # integration tests via @vscode/test-cli
npm run package           # produces a .vsix
```

On Windows you may need to run `git -c core.symlinks=false submodule update ...` to avoid symref errors.

## Error reporting

If you run into any errors or have feature requests, please [open an issue](https://github.com/ActivityWatch/aw-watcher-vscode).

<!--
## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.
-->

## Notes on use with Windows Subsystem for Linux (WSL)

#### Problem
If you are running ActivityWatch on your Windows machine but work in VS Code inside a WSL remote window, aw-watcher-vscode will attempt to connect to the aw-server via localhost:5600, but since WSL runs on a different subnet than your Windows machine, port-forwarding IS required.

#### Temporary Solution
This can be accomplished by locating the "PORTS" view under `View > Open View > Ports` and selecting `Add Port`, then typing in `5600` (no quotes). This auto-forwards the WSL subnet's localhost port 5600 to your Windows machine's `localhost:5600`.

#### Permanent Solution
With the solution above it is necessary to repeat the step for each VS Code workspace you open. To permanently forward port `5600` to localhost instead:

1. Open PowerShell on your Windows machine with admin privileges and run:
    - `netsh interface portproxy add v4tov4 listenport=5600 connectport=5600 connectaddress=*`

    - <b>NOTE:</b> If `connectaddress` is set to the WSL IP address rather than `*`, aw-server may fail to start because the port is already bound.

## Contributors

The 0.6/0.7 modernization and the roll-up of long-pending community pull requests
were done by [@ComfyChloe](https://github.com/ComfyChloe) in her maintained fork and
upstreamed here with her authorship preserved. The rolled-up changes originate from:

- [@liv10let](https://github.com/liv10let): HTTP Basic Auth ([#51](https://github.com/ActivityWatch/aw-watcher-vscode/pull/51))
- [@johnyoonh](https://github.com/johnyoonh): distinct buckets for VS Code-compatible editors ([#50](https://github.com/ActivityWatch/aw-watcher-vscode/pull/50))
- [@kepptic](https://github.com/kepptic): terminal context, editor enrichment, multi-window fix ([#48](https://github.com/ActivityWatch/aw-watcher-vscode/pull/48))
- [@blsmth](https://github.com/blsmth): terminal tracking ([#44](https://github.com/ActivityWatch/aw-watcher-vscode/pull/44))
- [@ishanarora](https://github.com/ishanarora): untrusted workspace support ([#40](https://github.com/ActivityWatch/aw-watcher-vscode/pull/40))
- [@kristof-ringleff](https://github.com/kristof-ringleff): editor label in event data ([#39](https://github.com/ActivityWatch/aw-watcher-vscode/pull/39))
- [@gignsky](https://github.com/gignsky): WSL port-forwarding notes ([#37](https://github.com/ActivityWatch/aw-watcher-vscode/pull/37))
- [@Thopiax](https://github.com/Thopiax): workspace name ([#36](https://github.com/ActivityWatch/aw-watcher-vscode/pull/36))
- [#53](https://github.com/ActivityWatch/aw-watcher-vscode/pull/53) and [#54](https://github.com/ActivityWatch/aw-watcher-vscode/pull/54): heartbeat rate limit and editor-time docs

## Release Notes

See [`CHANGELOG.md`](CHANGELOG.md) for the full release history. Highlights:

### 0.7.0

 - Terminal tracking: active terminal name and working directory (with `lsof` fallback), all-terminal labels.
 - Editor enrichment: cursor position, Git dirty count + remote, debug state, open editors, relative paths, focus state.
 - Only the focused window sends heartbeats (fixes multi-window pulse merging).
 - `maxHeartbeatsPerSec` is now honoured, including fractional values; logging moved to an Output channel.
 - Distinct buckets for Cursor / VSCodium / Antigravity; dynamic `editor` field; `workspace` field.
 - `serverUrl` / `enabled` settings now take effect, plus Basic Auth support for nginx-proxied servers.

### 0.6.0

 - **Node 18+ required** (uses global `fetch` from the new `aw-client-js`).
 - Bumped `engines.vscode` to `^1.85.0` and `typescript` to `5.6.x`.
 - Replaced `tslint` with `eslint`; added `prettier` and a GitHub Actions CI workflow.
 - Updated `aw-client-js` to its current master (drops `axios`).
 - Added `aw-watcher-vscode.enabled` and `aw-watcher-vscode.serverUrl` settings.
 - Tightened `activationEvents` from `["*"]` to `["onStartupFinished"]`.

### 0.5.0

 - Updated publisherId to `activitywatch`.
 - Added support for VSCodium.
 - Added support for VSCode remote.

### 0.4.1

Updated aw-client-js, media and npm dependencies.

### 0.4.0

Updated submodules aw-client-js and media to latest

fixed the extension to work with the latest aw-client:
- AppEditorActivityHeartbeat --> IAppEditorEvent
- createBucket --> ensureBucket
- options object in AWClient constructor
- timestamp should be a Date not a string

### 0.3.3

Fixed security vulnerability of an outdated dependency.

### 0.3.2

Added `maxHeartbeatsPerSec` configuration.

### 0.3.0

Refined error handling and heartbeat logic.

### 0.2.0

Refined error handling and README.

### 0.1.0

Initial release of aw-watcher-vscode.

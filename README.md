# aw-watcher-vscode

This extension allows [ActivityWatch](https://activitywatch.net), the free and open-source time tracker, to keep track of the projects and programming languages you use in VS Code.

The extension is published on [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=activitywatch.aw-watcher-vscode) and [Open VSX](https://open-vsx.org/extension/ActivityWatch/aw-watcher-vscode).

The source code is available at https://github.com/ActivityWatch/aw-watcher-vscode

## Features

Sends following data to ActivityWatch:
- current project name
- programming language
- current file name
- current Git branch

Currently VS Code extensions don't support getting file/project names for non-editable files, therefore this results in the value "unknown" for those properties. (For instance when opening logo.png this happens)

## Requirements

This extension requires ActivityWatch to be running on your machine.

## Install Instructions

To install this extension, search for aw-watcher-vscode in the Extensions sidebar in VS Code, and install the one with ActivityWatch as the publisher name. And that's it, if Activity Watch was running, it should detect this vs-code watcher automatically. Give it some time to have some data to display and it should show in the ActivityWatch Timeline and Activity sections soon.

## Commands

#### Reload ActivityWatch

Use this in case VS Code has been started before the AW server.

## Extension Settings

This extension adds the following settings:

- `aw-watcher-vscode.maxHeartbeatsPerSec`: Controls the maximum number of heartbeats sent per second.
<!--
TODO:
* `aw-watcher-vscode.enable`: enable/disable this extension
-->

## Error reporting

If you run into any errors or have feature requests, please [open an issue](https://github.com/ActivityWatch/aw-watcher-vscode).

<!--
## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.
-->

## Notes on use with Windows Subsystem for Linux (WSL)

#### Problem
If you are running Activity Watcher on your windows machine but work in vscode inside a WSL remote window aw-watcher-vscode will attempt to connect to the aw-server via localhost:5600 but since WSL runs on a different subnet than your windows machine port-forwarding IS required.

#### Temporary Solution
This can be accomplished by locating the "PORTS" view under `View > Open View > Ports` and selecting `Add Port` then typing in `5600` (no quotes), this should auto-forward the WSL subnet's localhost port of 5600 to your Windows machines `localhost:5600` and show an origin of `User Forwarded`.

#### Permanent Solution
With the above described solution it is necessary to do so on each and every vscode workspace you open. If you would like to avoid having to manually forward the port each time you can follow the two simple steps listed below to permanently forward port `5600` to localhost.

1. In your WSL shell run the command `ip a` and take note of WSL's IP Address, this will most likely be one of two IPs that appears, the 127.0.0.1 address is the loopback address and should NOT be used, take note of the other IP as it will be used in step two.
2. Open powershell on your windows machine with admin privileges and run the following command, while remembering to replace `WSL_IP` with the IP address noted in step 1.
    - `netsh interface portproxy add v4tov4 listenport=5600 connectport=5600 connectaddress=[WSL_IP]`

## Release Notes

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

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

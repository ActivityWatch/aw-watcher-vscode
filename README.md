# aw-watcher-vscode [WIP]

This extension allows the open source tracking tool [ActivityWatch](http://activitywatch.net/) to keep track of the projects and coding languages you use in Visual Code.

The source code is visible at https://github.com/ActivityWatch/aw-watcher-vscode

## Features

Sends following data to ActivityWatch:
- current project name
- coding language
- current file name

Currently VS Code extensions don't support getting file/project names for non-editable files, therefore this results in the value "unknown" for those properties. (For instance when opening logo.png this happens)

## Requirements

To run this extension you will need to have a running ActivityWatch Server.

## Commands
#### Reload ActivityWatch
Use this in case VS Code has been started before the AW server.


## Error reporting
If you run into any errors or have feature requests, please open an issue at the [git repository](https://github.com/ActivityWatch/aw-watcher-vscode).

<!---
## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: enable/disable this extension
* `myExtension.thing`: set to `blah` to do something
## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.
-->
-----------------------------------------------------------------------------------------------------------

## Release Notes

### 0.1.0

Initial release of aw-watcher-vscode.

### 0.2.0

Refined error handling and README.

### 0.3.0

Refined error handling and heartbeat logic.

#### 0.3.2

Added maxHeartbeatsPerSec configuration

#### 0.3.3

Fixed security vulnerability of an outdated dependency

#### 0.4.0

update submodules aw-client-js and media to latest

fix the extension to work with the latest aw-client:
- AppEditorActivityHeartbeat --> AppEditorEvent
- createBucket --> ensureBucket
- options object in AWClient constructor
- timestamp should be a Date not a string

<!---

-----------------------------------------------------------------------------------------------------------

## Working with Markdown

**Note:** You can author your README using Visual Studio Code.  Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux)
* Toggle preview (`Shift+CMD+V` on macOS or `Shift+Ctrl+V` on Windows and Linux)
* Press `Ctrl+Space` (Windows, Linux) or `Cmd+Space` (macOS) to see a list of Markdown snippets

### For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**

-->

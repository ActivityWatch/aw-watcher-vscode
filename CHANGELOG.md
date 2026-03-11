# Change Log

### 0.7.0

Rich terminal and editor context tracking:

- **Terminal context**: Track active terminal name, working directory, and project
- **Terminal switch detection**: Detect switches between terminals (including multiple terminals with the same name)
- **PID-based cwd resolution**: Resolve terminal working directories via `lsof` when `shellIntegration` is unavailable
- **All terminal enumeration**: Report all open terminal sessions with their project names
- **Git enrichment**: Report `git_dirty_count` and `git_remote` URL
- **Debug session tracking**: Report active debug sessions with debug type
- **Open editor tracking**: Report open file count and filenames
- **Cursor position**: Report cursor line/column and file line count
- **Relative file paths**: Report file path relative to workspace root
- **Window focus state**: Report whether VS Code window is focused
- **Multi-root workspace**: Report workspace folder names for multi-root setups

### 0.6.0

Enhanced editor context (git branch, project, language, file tracking).

### 0.5.0

Internal improvements and dependency updates.

### 0.1.0

Initial release of aw-watcher-vscode.

### 0.2.0

Refined error handling and README

### 0.3.0

Refined error handling and heartbeat logic

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

<!--- https://keepachangelog.com/en/1.0.0/ -->

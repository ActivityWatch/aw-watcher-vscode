# Change Log
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

import {
  Disposable,
  ExtensionContext,
  commands,
  window,
  workspace,
  debug,
  Uri,
  Extension,
  extensions,
} from "vscode";
import { AWClient, IAppEditorEvent } from "../aw-client-js/src/aw-client";
import { hostname } from "os";
import { API, GitExtension, Repository } from "./git";
import { basename, relative } from "path";
import * as vscode from "vscode";

// The vscode type declarations in this project are old (1.x).
// Terminal APIs (activeTerminal, terminals, onDidChangeActiveTerminal, onDidOpenTerminal)
// exist at runtime in VS Code 1.37+. We cast through `any` where needed.
const win = window as any;

export function activate(context: ExtensionContext) {
  console.log("[ActivityWatch] Extension activated");
  const controller = new ActivityWatch();
  controller.init();
  context.subscriptions.push(controller);

  const reloadCommand = commands.registerCommand("extension.reload", () =>
    controller.init()
  );
  context.subscriptions.push(reloadCommand);
}

class ActivityWatch {
  private _disposable: Disposable;
  private _client: AWClient;
  private _git: API | undefined;

  private _bucket: {
    id: string;
    hostName: string;
    clientName: string;
    eventType: string;
  };
  private _bucketCreated: boolean = false;

  // Config
  private _pulseTime: number = 20;
  private _maxHeartbeatsPerSec: number = 1;

  // State tracking for change detection
  private _lastFilePath: string = "";
  private _lastHeartbeatTime: number = 0;
  private _lastBranch: string = "";
  private _lastTerminalName: string = "";
  private _isDebugging: boolean = false;

  // Cache PID -> cwd for terminals without shellIntegration
  private _pidCwdCache: Map<number, { cwd: string; time: number }> = new Map();
  private _heartbeatTimer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    this._bucket = {
      id: "",
      hostName: hostname(),
      clientName: "aw-watcher-vscode",
      eventType: "app.editor.activity",
    };
    this._bucket.id = `${this._bucket.clientName}_${this._bucket.hostName}`;
    this._client = new AWClient(this._bucket.clientName, { testing: false });

    // Subscribe to all relevant VS Code events
    const subscriptions: Disposable[] = [];

    // Editor events
    window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);
    window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);

    // Terminal events (APIs exist in VS Code 1.37+, types are old)
    if (win.onDidChangeActiveTerminal) {
      win.onDidChangeActiveTerminal(this._onTerminalEvent, this, subscriptions);
    }
    if (win.onDidOpenTerminal) {
      win.onDidOpenTerminal(this._onTerminalEvent, this, subscriptions);
    }
    window.onDidCloseTerminal(this._onTerminalEvent, this, subscriptions);

    // Debug events
    debug.onDidStartDebugSession(
      () => {
        this._isDebugging = true;
        this._onEvent();
      },
      this,
      subscriptions
    );
    debug.onDidTerminateDebugSession(
      () => {
        this._isDebugging = false;
        this._onEvent();
      },
      this,
      subscriptions
    );

    // Window focus events
    window.onDidChangeWindowState(this._onEvent, this, subscriptions);

    // Periodic heartbeat every 5s to build event duration via pulse merge.
    // Without this, events stay at 0 duration when the user isn't actively
    // typing or switching editors.
    this._heartbeatTimer = setInterval(() => {
      if (window.state.focused) {
        this._onEvent();
      }
    }, 5000);

    this._disposable = Disposable.from(...subscriptions);
  }

  public init() {
    this._client
      .ensureBucket(
        this._bucket.id,
        this._bucket.eventType,
        this._bucket.hostName
      )
      .then((res) => {
        console.log(
          res.alreadyExist
            ? "[ActivityWatch] Bucket already exists"
            : "[ActivityWatch] Created bucket"
        );
        this._bucketCreated = true;
      })
      .catch((err) => {
        this._handleError(
          "Couldn't create Bucket. Is the ActivityWatch server running?",
          true
        );
        this._bucketCreated = false;
        console.error(err);
      });

    this.initGit().then((res) => (this._git = res));
    this.loadConfigurations();
  }

  private async initGit() {
    try {
      const extension = extensions.getExtension(
        "vscode.git"
      ) as Extension<GitExtension>;
      if (!extension) {
        return undefined;
      }
      const gitExtension = extension.isActive
        ? extension.exports
        : await extension.activate();
      return gitExtension.getAPI(1);
    } catch (_err) {
      console.warn("[ActivityWatch] Git extension not available");
      return undefined;
    }
  }

  public loadConfigurations() {
    const config = workspace.getConfiguration("aw-watcher-vscode");
    const maxHeartbeatsPerSec = config.get<number>("maxHeartbeatsPerSec");
    if (maxHeartbeatsPerSec) {
      this._maxHeartbeatsPerSec = maxHeartbeatsPerSec;
    }
  }

  public dispose() {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this._disposable.dispose();
  }

  /// Resolve cwd for a terminal PID via lsof.
  /// The terminal's processId is its shell PID — lsof on it gives the cwd directly.
  /// Returns cached result if fresh enough (10s TTL).
  private _getTerminalCwd(pid: number): string {
    const cached = this._pidCwdCache.get(pid);
    const now = Date.now();
    if (cached && (now - cached.time) < 10000) {
      return cached.cwd;
    }

    try {
      const { execFileSync } = require("child_process");
      const lsofOut: string = execFileSync("lsof", ["-p", String(pid), "-Fn"], {
        timeout: 2000, encoding: "utf-8"
      });
      const lines = lsofOut.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i] === "fcwd" && i + 1 < lines.length && lines[i+1].startsWith("n")) {
          const cwd = lines[i+1].substring(1);
          if (cwd && cwd !== "/" && !cwd.startsWith("/dev")) {
            this._pidCwdCache.set(pid, { cwd, time: now });
            return cwd;
          }
        }
      }
    } catch (_) {}

    return "";
  }

  private _onTerminalEvent() {
    if (!this._bucketCreated) {
      return;
    }

    const terminal = win.activeTerminal;
    if (!terminal) return;

    // Use terminal object identity via index in terminals array to
    // distinguish between terminals with the same name (e.g., multiple "2.1.69")
    const terminals = win.terminals || [];
    const termIndex = Array.prototype.indexOf.call(terminals, terminal);
    const termKey = `${terminal.name || ""}|${termIndex}`;

    if (termKey !== this._lastTerminalName) {
      this._lastTerminalName = termKey;
      this._onEvent();
    }
  }

  private async _onEvent() {
    if (!this._bucketCreated) {
      return;
    }

    // Only send heartbeats from the focused VS Code window.
    // Multiple windows share the same bucket — unfocused windows
    // interleave different project data and break pulse merging.
    // Exception: onDidChangeWindowState fires on blur, so we allow
    // one heartbeat when focus is lost to close the current event.
    const isFocused = window.state.focused;
    if (!isFocused && this._lastHeartbeatTime > 0) {
      // Already sent at least one heartbeat — skip unfocused events
      // unless this is the blur transition itself (detected by
      // checking if we were recently focused)
      const timeSinceLast = new Date().getTime() - this._lastHeartbeatTime;
      if (timeSinceLast > 2000) {
        return;
      }
    }

    try {
      const heartbeat = await this._createHeartbeat();
      const filePath = heartbeat.data.file || "";
      const curTime = new Date().getTime();
      const branch = heartbeat.data.branch || "";

      if (
        filePath !== this._lastFilePath ||
        branch !== this._lastBranch ||
        this._lastHeartbeatTime + 1000 / this._maxHeartbeatsPerSec < curTime
      ) {
        this._lastFilePath = filePath;
        this._lastBranch = branch;
        this._lastHeartbeatTime = curTime;
        this._sendHeartbeat(heartbeat);
      }
    } catch (err: any) {
      this._handleError(err);
    }
  }

  private _sendHeartbeat(event: IAppEditorEvent) {
    return this._client
      .heartbeat(this._bucket.id, this._pulseTime, event)
      .then(() => console.log("[ActivityWatch] Heartbeat:", event.data.file))
      .catch(({ err }: { err: any }) => {
        console.error("[ActivityWatch] Heartbeat error:", err);
      });
  }

  private async _createHeartbeat(): Promise<IAppEditorEvent> {
    const editor = window.activeTextEditor;
    const projectName = this._getProjectName();
    const projectPath = this._getProjectFolder();
    const filePath = this._getFilePath();
    const branch = this._getCurrentBranch() || "unknown";

    // When terminal is focused (no active editor), fall back to project info
    const isTerminal = !editor && win.activeTerminal;
    const data: { [k: string]: any } = {
      language: this._getFileLanguage() || (isTerminal ? "terminal" : "unknown"),
      project: projectName || "unknown",
      file: filePath || (projectName ? `${projectName} (terminal)` : "unknown"),
      branch: branch,
      // Editor identification (PR #39 — dynamic, supports Cursor/Windsurf/forks)
      editor: (vscode as any).env?.appName || "VS Code",
    };

    // Workspace name from .code-workspace file (PR #36)
    if (workspace.name) {
      data.workspace = workspace.name;
    }

    // Relative file path (cleaner than absolute)
    if (filePath && projectPath) {
      const relPath = relative(projectPath, filePath);
      if (relPath && !relPath.startsWith("..")) {
        data.relative_path = relPath;
      }
    }

    // Cursor position
    if (editor && editor.selection) {
      data.cursor_line = editor.selection.active.line + 1;
      data.cursor_col = editor.selection.active.character + 1;
      data.lines_in_file = editor.document.lineCount;
    }

    // Git status
    const gitInfo = this._getGitInfo();
    if (gitInfo) {
      if (gitInfo.dirty_count !== undefined) {
        data.git_dirty_count = gitInfo.dirty_count;
      }
      if (gitInfo.remote_url) {
        data.git_remote = gitInfo.remote_url;
      }
    }

    // Debugging state
    if (this._isDebugging || debug.activeDebugSession) {
      data.is_debugging = true;
      const session = debug.activeDebugSession;
      if (session) {
        data.debug_type = session.type;
      }
    }

    // Open editors (just filenames for context)
    const openEditors = this._getOpenEditorFiles();
    if (openEditors.length > 0) {
      data.open_files = openEditors.join(";");
      data.open_file_count = openEditors.length;
    }

    // Active terminal info
    const terminal = win.activeTerminal;
    if (terminal) {
      data.active_terminal = terminal.name;

      // Resolve cwd: try shellIntegration first, then PID-based lsof fallback
      let termCwd = "";
      try {
        if (terminal.shellIntegration && terminal.shellIntegration.cwd) {
          const cwd = terminal.shellIntegration.cwd;
          termCwd = typeof cwd === 'string' ? cwd : (cwd.fsPath || cwd.path || "");
        }
      } catch (_) {}

      // Fallback: resolve cwd from terminal PID via lsof
      if (!termCwd && terminal.processId) {
        try {
          const pid = await Promise.race([
            terminal.processId,
            new Promise<undefined>(r => setTimeout(r, 500))
          ]);
          if (pid) {
            termCwd = this._getTerminalCwd(pid);
          }
        } catch (_) {}
      }

      if (termCwd) {
        data.terminal_cwd = termCwd;
        const desc = termCwd.split("/").pop() || termCwd.split("\\").pop() || "";
        if (desc) {
          data.terminal_description = desc;
          data.active_terminal_label = `${terminal.name} ${desc}`;
        }
      }
    }
    data.terminal_count = win.terminals?.length || 0;

    // All terminal labels (name + cwd project) for context
    if (win.terminals && win.terminals.length > 0) {
      const termLabels: string[] = [];
      for (const t of win.terminals) {
        const name = t.name || "";
        let label = name;
        // Try shellIntegration cwd, then PID fallback
        let cwdStr = "";
        try {
          if (t.shellIntegration && t.shellIntegration.cwd) {
            const cwd = t.shellIntegration.cwd;
            cwdStr = typeof cwd === 'string' ? cwd : (cwd.fsPath || cwd.path || "");
          }
        } catch (_) {}
        if (!cwdStr && t.processId) {
          try {
            const pid = await Promise.race([
              t.processId,
              new Promise<undefined>(r => setTimeout(r, 500))
            ]);
            if (pid) {
              cwdStr = this._getTerminalCwd(pid);
            }
          } catch (_) {}
        }
        if (cwdStr) {
          const dirName = cwdStr.split("/").pop() || cwdStr.split("\\").pop() || "";
          if (dirName) label = `${name} ${dirName}`;
        }
        if (label) termLabels.push(label);
      }
      if (termLabels.length > 0) {
        data.terminal_names = termLabels.join(";");
      }
    }

    // Window focus state
    data.is_focused = window.state.focused;

    // Workspace folder count (multi-root)
    const folders = workspace.workspaceFolders;
    if (folders && folders.length > 1) {
      data.workspace_folders = folders.map((f: any) => f.name).join(";");
    }

    return {
      timestamp: new Date(),
      duration: 0,
      data: data as any,
    };
  }

  private _getProjectName(): string | undefined {
    const fileUri = this._getActiveFileUri();
    if (!fileUri) {
      // Fall back to first workspace folder
      const folders = workspace.workspaceFolders;
      if (folders && folders.length > 0) {
        return folders[0].name;
      }
      return undefined;
    }

    const workspaceFolder = workspace.getWorkspaceFolder(fileUri);
    if (!workspaceFolder) {
      return undefined;
    }

    // Return just the folder name, not the full path
    return workspaceFolder.name;
  }

  private _getProjectFolder(): string | undefined {
    const fileUri = this._getActiveFileUri();
    if (!fileUri) {
      const folders = workspace.workspaceFolders;
      if (folders && folders.length > 0) {
        return folders[0].uri.fsPath;
      }
      return undefined;
    }
    const workspaceFolder = workspace.getWorkspaceFolder(fileUri);
    if (!workspaceFolder) {
      return undefined;
    }
    return workspaceFolder.uri.fsPath;
  }

  private _getActiveFileUri(): Uri | undefined {
    const editor = window.activeTextEditor;
    if (!editor) {
      return undefined;
    }
    return editor.document.uri;
  }

  private _getFilePath(): string | undefined {
    const editor = window.activeTextEditor;
    if (!editor) {
      return undefined;
    }
    return editor.document.fileName;
  }

  private _getFileLanguage(): string | undefined {
    const editor = window.activeTextEditor;
    if (!editor) {
      return undefined;
    }
    return editor.document.languageId;
  }

  private _getCurrentBranch(): string | undefined {
    if (!this._git) {
      return undefined;
    }

    // Find the repository for the active file
    const fileUri = this._getActiveFileUri();
    if (fileUri && this._git.getRepository) {
      const repo = this._git.getRepository(fileUri);
      if (repo) {
        return repo.state.HEAD?.name;
      }
    }

    // Fall back to first repository
    return this._git.repositories[0]?.state?.HEAD?.name;
  }

  private _getGitInfo(): {
    dirty_count?: number;
    remote_url?: string;
  } | null {
    if (!this._git || !this._git.repositories.length) {
      return null;
    }

    let repo: Repository | undefined;
    const fileUri = this._getActiveFileUri();
    if (fileUri && this._git.getRepository) {
      repo = this._git.getRepository(fileUri) || undefined;
    }
    if (!repo) {
      repo = this._git.repositories[0];
    }

    if (!repo) {
      return null;
    }

    const result: { dirty_count?: number; remote_url?: string } = {};

    // Count dirty files
    const state = repo.state;
    result.dirty_count =
      (state.workingTreeChanges?.length || 0) +
      (state.indexChanges?.length || 0);

    // Get remote URL
    const origin = state.remotes?.find((r) => r.name === "origin");
    if (origin?.fetchUrl) {
      // Clean up the URL (remove credentials, simplify)
      let url = origin.fetchUrl;
      // Convert git@github.com:org/repo.git to github.com/org/repo
      const sshMatch = url.match(
        /git@([^:]+):(.+?)(?:\.git)?$/
      );
      if (sshMatch) {
        url = `${sshMatch[1]}/${sshMatch[2]}`;
      }
      result.remote_url = url;
    }

    return result;
  }

  private _getOpenEditorFiles(): string[] {
    const files: string[] = [];
    for (const editor of window.visibleTextEditors) {
      const path = editor.document.fileName;
      if (path) {
        files.push(basename(path));
      }
    }
    return files;
  }

  private _handleError(err: string, isCritical = false): undefined {
    if (isCritical) {
      console.error("[ActivityWatch]", err);
      window.showErrorMessage(`[ActivityWatch] ${err}`);
    } else {
      console.warn("[ActivityWatch]", err);
    }
    return;
  }
}

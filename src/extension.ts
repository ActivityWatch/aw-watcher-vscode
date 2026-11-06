// The module 'vscode' contains the VS Code extensibility API
// Import the necessary extensibility types to use in your code below
import {
    Disposable,
    ExtensionContext,
    commands,
    window,
    workspace,
    Uri,
    Extension,
    extensions,
    env,
    debug,
} from 'vscode';
import { AWClient, IAppEditorEvent } from '../aw-client-js/src/aw-client';
import { hostname } from 'os';
import { basename, relative } from 'path';
import { execFileSync } from 'child_process';
import { API, GitExtension, Repository } from './git';
import { DEFAULT_MAX_HEARTBEATS_PER_SEC, parseMaxHeartbeatsPerSec, shouldSendHeartbeat } from './throttle';
import { buildBaseUrl } from './server';

// The `vscode` npm type declarations in this project are old (1.x), while
// terminal runtimes (activeTerminal, terminals, shellIntegration) and
// window-state APIs exist at runtime in VS Code 1.37+/1.60+. Access them
// through a narrow structural interface instead of `any`.
interface RuntimeTerminal {
    readonly name: string;
    readonly processId?: Thenable<number | undefined>;
    readonly shellIntegration?: { readonly cwd?: unknown };
}
interface RuntimeWindow {
    readonly activeTerminal?: RuntimeTerminal;
    readonly terminals?: readonly RuntimeTerminal[];
    readonly state?: { readonly focused: boolean };
    onDidChangeActiveTerminal?: (listener: () => void, thisArgs?: unknown, disposables?: Disposable[]) => Disposable;
    onDidOpenTerminal?: (listener: () => void, thisArgs?: unknown, disposables?: Disposable[]) => Disposable;
    onDidCloseTerminal?: (listener: () => void, thisArgs?: unknown, disposables?: Disposable[]) => Disposable;
    onDidChangeWindowState?: (listener: () => void, thisArgs?: unknown, disposables?: Disposable[]) => Disposable;
}
const runtimeWindow: RuntimeWindow = window as unknown as RuntimeWindow;

// This method is called when your extension is activated. Activation is
// controlled by the activation events defined in package.json.
export function activate(context: ExtensionContext) {
    // Log to a dedicated Output channel instead of the console, so the
    // extension does not spam the Extension Host debug console (#30).
    const output = window.createOutputChannel('ActivityWatch');
    context.subscriptions.push(output);
    const log = (message: string) => output.appendLine(`[${new Date().toISOString()}] ${message}`);
    log('Extension activated');

    // Init ActivityWatch
    const controller = new ActivityWatch(log);
    controller.init();
    context.subscriptions.push(controller);

    // Command:Reload
    const reloadCommand = commands.registerCommand('extension.reload', () => controller.init());
    context.subscriptions.push(reloadCommand);
}

// Each VS Code-compatible editor gets a distinct client/bucket name so
// activity streams don't overlap when several are installed (PR #50).
// Default VS Code behavior is preserved via the fallback.
function activityWatchClientName(): string {
    const appName = env.appName.toLowerCase();

    if (appName.includes('cursor')) {
        return 'aw-watcher-cursor';
    }
    if (appName.includes('antigravity')) {
        return 'aw-watcher-antigravity';
    }
    if (appName.includes('codium')) {
        return 'aw-watcher-vscodium';
    }
    if (appName.includes('windsurf')) {
        return 'aw-watcher-windsurf';
    }

    return 'aw-watcher-vscode';
}

class ActivityWatch {
    private _disposable: Disposable;
    private _client!: AWClient;
    private _git: API | undefined;

    // Bucket info
    private _bucket: {
        id: string;
        hostName: string;
        clientName: string;
        eventType: string;
    };
    private _bucketCreated: boolean = false;

    // Heartbeat handling
    private _pulseTime: number = 20;
    private _maxHeartbeatsPerSec: number = DEFAULT_MAX_HEARTBEATS_PER_SEC;
    private _lastFilePath: string = '';
    private _lastHeartbeatTime: number = 0; // Date.getTime()
    private _lastBranch: string = '';
    private _lastTerminalKey: string = '';
    private _isDebugging: boolean = false;

    // Server configuration (loaded in init via loadConfigurations)
    private _enabled: boolean = true;
    private _serverUrl: string = '';
    private _authUser: string = '';
    private _authPassword: string = '';

    // Cache PID -> cwd for terminals without shellIntegration
    private _pidCwdCache: Map<number, { cwd: string; time: number }> = new Map();
    private _heartbeatTimer: ReturnType<typeof setInterval> | undefined;

    // _onEvent is async and awaits terminal lookups; overlapping VS Code
    // events must not run the send path concurrently (duplicate/out-of-order
    // heartbeats), so overlapping calls collapse into one trailing rerun.
    private _eventInFlight: boolean = false;
    private _eventQueued: boolean = false;

    constructor(private readonly _log: (message: string) => void) {
        this._bucket = {
            id: '',
            hostName: hostname(),
            clientName: activityWatchClientName(),
            eventType: 'app.editor.activity',
        };
        this._bucket.id = `${this._bucket.clientName}_${this._bucket.hostName}`;

        // NOTE: AWClient is (re)created in init() so the Reload command
        // picks up serverUrl/auth changes.

        // subscribe to VS Code Events
        const subscriptions: Disposable[] = [];
        window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);
        window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);

        // Terminal events (runtime APIs, guarded for older hosts)
        if (runtimeWindow.onDidChangeActiveTerminal) {
            runtimeWindow.onDidChangeActiveTerminal(this._onTerminalEvent, this, subscriptions);
        }
        if (runtimeWindow.onDidOpenTerminal) {
            runtimeWindow.onDidOpenTerminal(this._onTerminalEvent, this, subscriptions);
        }
        if (runtimeWindow.onDidCloseTerminal) {
            runtimeWindow.onDidCloseTerminal(this._onTerminalEvent, this, subscriptions);
        }

        // Debug session events
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

        // Window focus events (used to close the current event on blur)
        if (runtimeWindow.onDidChangeWindowState) {
            runtimeWindow.onDidChangeWindowState(this._onEvent, this, subscriptions);
        }

        // Periodic heartbeat so event durations keep building via pulse
        // merge while the user works without switching editors. Only the
        // focused window sends (see _onEvent focus guard).
        this._heartbeatTimer = setInterval(() => {
            if (this._isFocused()) {
                this._onEvent();
            }
        }, 5000);

        this._disposable = Disposable.from(...subscriptions);
    }

    public init() {
        this.loadConfigurations();

        if (!this._enabled) {
            this._log('Extension disabled via aw-watcher-vscode.enabled setting');
            this._bucketCreated = false;
            return;
        }

        // (Re)create client so serverUrl/auth changes apply on Reload
        this._client = new AWClient(this._bucket.clientName, {
            testing: false,
            baseURL: this._buildBaseUrl(),
        });

        // Create new Bucket (if not existing)
        this._client
            .ensureBucket(this._bucket.id, this._bucket.eventType, this._bucket.hostName)
            .then((res) => {
                if (res.alreadyExist) {
                    this._log(`Bucket ${this._bucket.id} already exists`);
                } else {
                    this._log(`Created bucket ${this._bucket.id}`);
                }
                this._bucketCreated = true;
            })
            .catch((err) => {
                this._handleError(
                    "Couldn't create Bucket. Please make sure the server is running properly and then run the [Reload ActivityWatch] command.",
                    true
                );
                this._bucketCreated = false;
                this._log(`Error creating bucket: ${err instanceof Error ? err.message : String(err)}`);
            });
        this.initGit().then((res) => (this._git = res));
    }

    private async initGit() {
        try {
            const extension = extensions.getExtension('vscode.git') as Extension<GitExtension> | undefined;
            if (!extension) {
                return undefined;
            }
            const gitExtension = extension.isActive ? extension.exports : await extension.activate();
            return gitExtension.getAPI(1);
        } catch {
            this._log('Git extension not available, branch info will be unknown');
            return undefined;
        }
    }

    public loadConfigurations() {
        const extConfigurations = workspace.getConfiguration('aw-watcher-vscode');
        this._maxHeartbeatsPerSec = parseMaxHeartbeatsPerSec(extConfigurations.get('maxHeartbeatsPerSec'));
        const enabled = extConfigurations.get('enabled');
        if (typeof enabled === 'boolean') {
            this._enabled = enabled;
        }
        const serverUrl = extConfigurations.get('serverUrl');
        if (typeof serverUrl === 'string') {
            this._serverUrl = serverUrl.trim().replace(/\/+$/, '');
        }
        const authUser = extConfigurations.get('authUser');
        if (typeof authUser === 'string') {
            this._authUser = authUser;
        }
        const authPassword = extConfigurations.get('authPassword');
        if (typeof authPassword === 'string') {
            this._authPassword = authPassword;
        }
    }

    // Resolve the AW server base URL (pure helper in server.ts, unit tested).
    // Custom host/port setups are covered by the serverUrl setting
    // (fixes #27). Basic Auth credentials are embedded in the URL since
    // the fetch-based aw-client-js has no axios instance for header
    // injection.
    private _buildBaseUrl(): string {
        return buildBaseUrl(this._serverUrl, this._authUser, this._authPassword);
    }

    public dispose() {
        if (this._heartbeatTimer) {
            clearInterval(this._heartbeatTimer);
        }
        this._disposable.dispose();
    }

    private _isFocused(): boolean {
        // Default to focused when the API is unavailable (older hosts).
        return runtimeWindow.state?.focused ?? true;
    }

    // Resolve cwd for a terminal PID via lsof. The terminal's processId is
    // its shell PID, so lsof on it gives the cwd directly. Results are
    // cached briefly (10s TTL). Unavailable on web/Windows: returns ''.
    private _getTerminalCwd(pid: number): string {
        const cached = this._pidCwdCache.get(pid);
        const now = Date.now();
        if (cached && now - cached.time < 10000) {
            return cached.cwd;
        }

        try {
            const lsofOut = execFileSync('lsof', ['-p', String(pid), '-Fn'], {
                timeout: 2000,
                encoding: 'utf-8',
            }) as string;
            const lines = lsofOut.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (lines[i] === 'fcwd' && i + 1 < lines.length && lines[i + 1].startsWith('n')) {
                    const cwd = lines[i + 1].substring(1);
                    if (cwd && cwd !== '/' && !cwd.startsWith('/dev')) {
                        // Bound the cache: PIDs churn, entries are TTL-checked.
                        if (this._pidCwdCache.size > 200) {
                            this._pidCwdCache.clear();
                        }
                        this._pidCwdCache.set(pid, { cwd, time: now });
                        return cwd;
                    }
                }
            }
        } catch {
            // lsof missing/denied (Windows, sandboxed env): no cwd.
        }

        return '';
    }

    private _onTerminalEvent() {
        if (!this._enabled || !this._bucketCreated) {
            return;
        }

        const terminal = runtimeWindow.activeTerminal;
        if (!terminal) {
            return;
        }

        // Distinguish terminals sharing a name (e.g. multiple "zsh") by
        // their index in the terminals array.
        const terminals = runtimeWindow.terminals || [];
        const termIndex = terminals.indexOf(terminal);
        const termKey = `${terminal.name || ''}|${termIndex}`;

        if (termKey !== this._lastTerminalKey) {
            this._lastTerminalKey = termKey;
            this._onEvent();
        }
    }

    private _onEvent() {
        if (this._eventInFlight) {
            this._eventQueued = true;
            return;
        }
        // Fire-and-forget: _runEvent never rejects (all paths handled).
        void this._runEvent();
    }

    private async _runEvent() {
        this._eventInFlight = true;
        try {
            do {
                this._eventQueued = false;
                await this._collectAndSendHeartbeat();
            } while (this._eventQueued);
        } finally {
            this._eventInFlight = false;
        }
    }

    private async _collectAndSendHeartbeat() {
        if (!this._enabled || !this._bucketCreated) {
            return;
        }

        // Only the focused window sends heartbeats. Multiple windows share
        // one bucket, so unfocused windows interleaving different project
        // data breaks the server's pulse merge (#38). Exception: allow one
        // heartbeat shortly after blur to close the current event.
        if (!this._isFocused()) {
            const timeSinceLast = new Date().getTime() - this._lastHeartbeatTime;
            if (this._lastHeartbeatTime > 0 && timeSinceLast > 2000) {
                return;
            }
        }

        // Create and send heartbeat
        try {
            const heartbeat = await this._createHeartbeat();
            const current = {
                file: heartbeat.data.file,
                branch: String(heartbeat.data.branch),
                time: heartbeat.timestamp.getTime(),
            };
            const last = { file: this._lastFilePath, branch: this._lastBranch, time: this._lastHeartbeatTime };

            // Send heartbeat if file changed, branch changed or enough time passed
            if (shouldSendHeartbeat(last, current, this._maxHeartbeatsPerSec)) {
                this._lastFilePath = current.file;
                this._lastBranch = current.branch;
                this._lastHeartbeatTime = current.time;
                this._sendHeartbeat(heartbeat);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this._handleError(message);
        }
    }

    private _sendHeartbeat(event: IAppEditorEvent) {
        return this._client.heartbeat(this._bucket.id, this._pulseTime, event).catch((err: unknown) => {
            // Log-only: heartbeat failures are transient (server restart,
            // network blip) and a modal on every failure spams the user
            // (#12, #13). Bucket-creation failure still raises a toast.
            const message = err instanceof Error ? err.message : String(err);
            this._log(`Error sending heartbeat: ${message}`);
        });
    }

    private async _createHeartbeat(): Promise<IAppEditorEvent> {
        const editor = window.activeTextEditor;
        const projectPath = this._getProjectFolder();
        const projectName = this._getProjectName();
        const filePath = this._getFilePath();
        const branch = this._getCurrentBranch() || 'unknown';

        // `project` stays a path (per IAppEditorEvent docs and pre-0.7.0
        // behavior); `relative_path` gives the cleaner short form.
        const isTerminal = !editor && runtimeWindow.activeTerminal;
        const data: Record<string, string | number | boolean> = {
            editor: env.appName || 'VS Code',
            language: this._getFileLanguage() || (isTerminal ? 'terminal' : 'unknown'),
            project: projectPath || 'unknown',
            file: filePath || (projectName ? `${projectName} (terminal)` : 'unknown'),
            branch: branch,
        };

        // Workspace name from the .code-workspace file (PR #36)
        if (workspace.name) {
            data.workspace = workspace.name;
        }

        // File path relative to the project root
        if (filePath && projectPath) {
            const relPath = relative(projectPath, filePath);
            if (relPath && !relPath.startsWith('..')) {
                data.relative_path = relPath;
            }
        }

        // Cursor position
        if (editor && editor.selection) {
            data.cursor_line = editor.selection.active.line + 1;
            data.cursor_col = editor.selection.active.character + 1;
            data.lines_in_file = editor.document.lineCount;
        }

        // Git status, resolved per-file so multi-repo windows report the
        // repo of the active file instead of repositories[0] (#41)
        const gitInfo = this._getGitInfo();
        if (gitInfo) {
            if (gitInfo.dirty_count !== undefined) {
                data.git_dirty_count = gitInfo.dirty_count;
            }
            if (gitInfo.remote_url) {
                data.git_remote = gitInfo.remote_url;
            }
        }

        // Debug session state
        if (this._isDebugging || debug.activeDebugSession) {
            data.is_debugging = true;
            const session = debug.activeDebugSession;
            if (session) {
                data.debug_type = session.type;
            }
        }

        // Open editors (filenames only, for context)
        const openEditors = this._getOpenEditorFiles();
        if (openEditors.length > 0) {
            data.open_files = openEditors.join(';');
            data.open_file_count = openEditors.length;
        }

        // Active terminal: name plus cwd resolved via shellIntegration,
        // with an lsof PID fallback for terminals lacking integration
        const terminal = runtimeWindow.activeTerminal;
        if (terminal) {
            data.active_terminal = terminal.name;

            const termCwd = await this._resolveTerminalCwd(terminal);
            if (termCwd) {
                data.terminal_cwd = termCwd;
                const desc = termCwd.split('/').pop() || termCwd.split('\\').pop() || '';
                if (desc) {
                    data.terminal_description = desc;
                    data.active_terminal_label = `${terminal.name} ${desc}`;
                }
            }
        }

        // All terminals, labelled with their cwd project for context.
        // Resolved concurrently so one hung lookup can't stall the rest.
        const terminals = runtimeWindow.terminals || [];
        data.terminal_count = terminals.length;
        if (terminals.length > 0) {
            const cwdList = await Promise.all(terminals.map((t) => this._resolveTerminalCwd(t)));
            const termLabels: string[] = [];
            for (let i = 0; i < terminals.length; i++) {
                const name = terminals[i].name || '';
                let label = name;
                const cwdStr = cwdList[i];
                if (cwdStr) {
                    const dirName = cwdStr.split('/').pop() || cwdStr.split('\\').pop() || '';
                    if (dirName) {
                        label = `${name} ${dirName}`;
                    }
                }
                if (label) {
                    termLabels.push(label);
                }
            }
            if (termLabels.length > 0) {
                data.terminal_names = termLabels.join(';');
            }
        }

        // Window focus state
        data.is_focused = this._isFocused();

        // Multi-root workspace folder names
        const folders = workspace.workspaceFolders;
        if (folders && folders.length > 1) {
            data.workspace_folders = folders.map((f) => f.name).join(';');
        }

        return {
            timestamp: new Date(),
            duration: 0,
            data: data as unknown as IAppEditorEvent['data'],
        };
    }

    // Resolve a terminal's cwd: shellIntegration first, then the lsof PID
    // fallback (capped at 500ms so a hung lookup can't stall heartbeats).
    private async _resolveTerminalCwd(terminal: RuntimeTerminal): Promise<string> {
        const direct = this._terminalCwd(terminal);
        if (direct) {
            return direct;
        }
        if (!terminal.processId) {
            return '';
        }
        try {
            const pid = await Promise.race([
                terminal.processId,
                new Promise<undefined>((r) => setTimeout(() => r(undefined), 500)),
            ]);
            if (pid !== undefined) {
                return this._getTerminalCwd(pid);
            }
        } catch {
            // processId lookup failed: continue without cwd
        }
        return '';
    }

    // shellIntegration cwd may be a string or a Uri-like object.
    private _terminalCwd(terminal: RuntimeTerminal): string {
        try {
            const cwd = terminal.shellIntegration?.cwd as unknown;
            if (typeof cwd === 'string') {
                return cwd;
            }
            if (cwd && typeof cwd === 'object') {
                const uriLike = cwd as { fsPath?: unknown; path?: unknown };
                if (typeof uriLike.fsPath === 'string') {
                    return uriLike.fsPath;
                }
                if (typeof uriLike.path === 'string') {
                    return uriLike.path;
                }
            }
        } catch {
            // shellIntegration access failed: no cwd
        }
        return '';
    }

    private _getProjectName(): string | undefined {
        const fileUri = this._getActiveFileUri();
        if (!fileUri) {
            // Fall back to the first workspace folder (e.g. terminal active)
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

        return workspaceFolder.name;
    }

    private _getProjectFolder(): string | undefined {
        const fileUri = this._getActiveFileUri();
        if (!fileUri) {
            // Fall back to the first workspace folder (e.g. terminal active)
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

        // Resolve the repository of the active file so multi-repo windows
        // report the right branch (#41)
        const fileUri = this._getActiveFileUri();
        if (fileUri && this._git.getRepository) {
            const repo = this._git.getRepository(fileUri);
            if (repo) {
                return repo.state.HEAD?.name;
            }
        }

        // Fall back to the first repository
        return this._git.repositories[0]?.state?.HEAD?.name;
    }

    private _getGitInfo(): { dirty_count?: number; remote_url?: string } | null {
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

        const state = repo.state;
        result.dirty_count = (state.workingTreeChanges?.length || 0) + (state.indexChanges?.length || 0);

        const origin = state.remotes?.find((r) => r.name === 'origin');
        if (origin?.fetchUrl) {
            let url = origin.fetchUrl;
            // Normalize scp-style SSH URLs: git@github.com:org/repo.git
            const sshMatch = url.match(/git@([^:]+):(.+?)(?:\.git)?$/);
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
            this._log(`Error: ${err}`);
            window.showErrorMessage(`[ActivityWatch] ${err}`);
        } else {
            this._log(`Warning: ${err}`);
        }
        return;
    }
}

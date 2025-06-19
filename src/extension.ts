// The module 'vscode' contains the VS Code extensibility API
// Import the necessary extensibility types to use in your code below
import { Disposable, ExtensionContext, commands, window, workspace, Uri, Extension, extensions, env } from 'vscode';
import { AWClient, IAppEditorEvent } from '../aw-client-js/src/aw-client';
import { hostname } from 'os';
import { API, GitExtension } from './git';

// This method is called when your extension is activated. Activation is
// controlled by the activation events defined in package.json.
export function activate(context: ExtensionContext) {
    console.log('Congratulations, your extension "ActivityWatch" is now active!');

    // Init ActivityWatch
    const controller = new ActivityWatch();
    controller.init();
    context.subscriptions.push(controller);

    // Command:Reload
    const reloadCommand = commands.registerCommand('extension.reload', () => controller.init());
    context.subscriptions.push(reloadCommand);
}

class ActivityWatch {
    private _disposable: Disposable;
    private _client: AWClient;
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
    private _maxHeartbeatsPerSec: number = 1;
    private _lastFilePath: string = '';
    private _lastHeartbeatTime: number = 0; // Date.getTime()
    private _lastBranch: string = '';

    // Terminal tracking
    private _lastTerminalName: string = '';
    private _lastTerminalPid: string = '';
    private _isTerminalActive: boolean = false;

    constructor() {
        this._bucket = {
            id: '',
            hostName: hostname(),
            clientName: 'aw-watcher-vscode',
            eventType: 'app.editor.activity'
        };
        this._bucket.id = `${this._bucket.clientName}_${this._bucket.hostName}`;

        // Create AWClient
        this._client = new AWClient(this._bucket.clientName, { testing: false });

        // subscribe to VS Code Events
        let subscriptions: Disposable[] = [];
        window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);
        window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);
        // Add terminal tracking
        window.onDidChangeActiveTerminal(this._onTerminalEvent, this, subscriptions);
        window.onDidOpenTerminal(this._onTerminalEvent, this, subscriptions);
        this._disposable = Disposable.from(...subscriptions);
    }

    public init() {
        // Create new Bucket (if not existing)
        this._client.ensureBucket(this._bucket.id, this._bucket.eventType, this._bucket.hostName)
            .then((res) => {
                if (res.alreadyExist) {
                    console.log('Bucket already exists');
                } else {
                    console.log('Created Bucket');
                }
                this._bucketCreated = true;
            })
            .catch(err => {
                this._handleError("Couldn't create Bucket. Please make sure the server is running properly and then run the [Reload ActivityWatch] command.", true);
                this._bucketCreated = false;
                console.error(err);
            });
        this.initGit().then((res) => this._git = res);
        this.loadConfigurations();
    }

    private async initGit() {
        const extension = extensions.getExtension('vscode.git') as Extension<GitExtension>;
        const gitExtension = extension.isActive ? extension.exports : await extension.activate();
        return gitExtension.getAPI(1);
    }

    public loadConfigurations() {
        const extConfigurations = workspace.getConfiguration('aw-watcher-vscode');
        const maxHeartbeatsPerSec = extConfigurations.get('maxHeartbeatsPerSec');
        if (maxHeartbeatsPerSec) {
            this._maxHeartbeatsPerSec = maxHeartbeatsPerSec as number;
        }
    }

    public dispose() {
        this._disposable.dispose();
    }

    private _onEvent() {
        if (!this._bucketCreated) {
            return;
        }

        // Create and send heartbeat
        try {
            const heartbeat = this._createHeartbeat();
            const filePath = this._getFilePath();
            const curTime = new Date().getTime();
            const branch = this._getCurrentBranch();

            // Send heartbeat if file changed, branch changed or enough time passed
            if (filePath !== this._lastFilePath ||
                    branch !== this._lastBranch ||
                    this._lastHeartbeatTime + (1000 / (this._maxHeartbeatsPerSec)) < curTime) {
                this._lastFilePath = filePath || 'unknown';
                this._lastHeartbeatTime = curTime;
                this._sendHeartbeat(heartbeat);
            }
        }
        catch (err: any) {
            this._handleError(err);
        }
    }

    private _onTerminalEvent() {
        if (!this._bucketCreated) {
            return;
        }

        try {
            const activeTerminal = window.activeTerminal;
            const heartbeat = this._createHeartbeat();
            const curTime = new Date().getTime();
            const branch = this._getCurrentBranch();
            
            // Update terminal state
            const isTerminalActive = activeTerminal !== undefined;
            const terminalName = activeTerminal?.name || '';
            const terminalPid = activeTerminal?.processId?.toString() || '';

            // Send heartbeat if terminal state changed, branch changed, or enough time passed
            if (isTerminalActive !== this._isTerminalActive ||
                    terminalName !== this._lastTerminalName ||
                    terminalPid !== this._lastTerminalPid ||
                    branch !== this._lastBranch ||
                    this._lastHeartbeatTime + (1000 / (this._maxHeartbeatsPerSec)) < curTime) {
                
                this._isTerminalActive = isTerminalActive;
                this._lastTerminalName = terminalName;
                this._lastTerminalPid = terminalPid;
                this._lastBranch = branch || '';
                this._lastHeartbeatTime = curTime;
                this._sendHeartbeat(heartbeat);
            }
        }
        catch (err: any) {
            this._handleError(err);
        }
    }

    private _sendHeartbeat(event: IAppEditorEvent) {
        return this._client.heartbeat(this._bucket.id, this._pulseTime, event)
            .then(() => console.log('Sent heartbeat', event))
            .catch(({ err }) => {
                console.error('sendHeartbeat error: ', err);
                this._handleError('Error while sending heartbeat', true);
            });
    }

    private _createHeartbeat(): IAppEditorEvent {
        const activeTerminal = window.activeTerminal;
        const activeEditor = window.activeTextEditor;
        
        // Determine if we're in terminal or editor context
        if (activeTerminal && !activeEditor) {
            // Terminal is active, no editor
            const cleanTerminalName = this._getCleanTerminalName(activeTerminal);
            return {
                timestamp: new Date(),
                duration: 0,
                data: {
                    language: 'terminal',
                    project: this._getProjectFolder() || 'unknown',
                    file: cleanTerminalName,
                    branch: this._getCurrentBranch() || 'unknown',
                    terminal_name: activeTerminal.name,
                    terminal_pid: activeTerminal.processId?.toString() || 'unknown'
                }
            };
        } else {
            // Editor context (existing behavior)
            return {
                timestamp: new Date(),
                duration: 0,
                data: {
                    language: this._getFileLanguage() || 'unknown',
                    project: this._getProjectFolder() || 'unknown',
                    file: this._getFilePath() || 'unknown',
                    branch: this._getCurrentBranch() || 'unknown'
                }
            };
        }
    }

    private _getCleanTerminalName(terminal: any): string {
        try {
            const projectName = this._getProjectName();
            const editorName = this._getEditorName();
            
            // Format: "Cursor/VSCode - Terminal - [project]"
            return `${editorName} - Terminal - [${projectName}]`;
        } catch (err) {
            console.error('[ActivityWatch] Error creating clean terminal name:', err);
            return `terminal:${terminal.name || 'unknown'}`;
        }
    }

    private _getProjectName(): string {
        try {
            // Try to get project name from workspace folder
            if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
                const workspaceFolder = workspace.workspaceFolders[0];
                // Extract just the folder name, not the full path
                const pathParts = workspaceFolder.uri.path.split('/');
                const projectName = pathParts[pathParts.length - 1];
                return projectName && projectName.length > 0 ? projectName : 'unknown';
            }
        } catch (err) {
            console.error('[ActivityWatch] Error getting project name:', err);
        }
        return 'unknown';
    }

    private _getEditorName(): string {
        try {
            // Use VS Code API to detect the application name
            const appName = env.appName || '';
            const appRoot = env.appRoot || '';
            
            console.log('[ActivityWatch] App detection - appName:', appName, 'appRoot:', appRoot);
            
            // Check if running in Cursor based on app name or path
            if (appName.toLowerCase().includes('cursor') || 
                appRoot.toLowerCase().includes('cursor')) {
                return 'Cursor';
            }
            
            // Fallback to process environment checks
            const processEnv = process.env || {};
            if (processEnv.CURSOR_VERSION || 
                (processEnv.TERM_PROGRAM && processEnv.TERM_PROGRAM.toLowerCase().includes('cursor'))) {
                return 'Cursor';
            }
            
            return 'VSCode';
        } catch (err) {
            console.error('[ActivityWatch] Error detecting editor name:', err);
            return 'VSCode';
        }
    }

    private _getProjectFolder(): string | undefined {
        // Try to get from active editor first
        const fileUri = this._getActiveFileUri();
        if (fileUri) {
            const workspaceFolder = workspace.getWorkspaceFolder(fileUri);
            if (workspaceFolder) {
                return workspaceFolder.uri.path;
            }
        }
        
        // Fall back to first workspace folder if terminal is active
        const activeTerminal = window.activeTerminal;
        if (activeTerminal && workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
            return workspace.workspaceFolders[0].uri.path;
        }
        
        return undefined;
    }

    private _getActiveFileUri(): Uri | undefined {
        const editor = window.activeTextEditor;
        if (!editor) {
            return;
        }

        return editor.document.uri;
    }

    private _getFilePath(): string | undefined {
        const editor = window.activeTextEditor;
        if (!editor) {
            return;
        }

        return editor.document.fileName;
    }

    private _getFileLanguage(): string | undefined {
        const editor = window.activeTextEditor;
        if (!editor) {
            return;
        }

        return editor.document.languageId;
    }

    private _getCurrentBranch(): string | undefined {
        if (this._git === undefined) {
            return;
        }
        return this._git.repositories[0]?.state?.HEAD?.name;
    }

    private _handleError(err: string, isCritical = false): undefined {
        if (isCritical) {
            console.error('[ActivityWatch][handleError]', err);
            window.showErrorMessage(`[ActivityWatch] ${err}`);
        }
        else {
            console.warn('[AcitivtyWatch][handleError]', err);
        }
        return;
    }
}

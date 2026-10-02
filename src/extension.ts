// The module 'vscode' contains the VS Code extensibility API
// Import the necessary extensibility types to use in your code below
import { Disposable, ExtensionContext, commands, window, workspace, Uri, Extension, extensions } from 'vscode';
import { AWClient, IAppEditorEvent } from '../aw-client-js/src/aw-client';
import { hostname } from 'os';
import { API, GitExtension } from './git';
import { DEFAULT_MAX_HEARTBEATS_PER_SEC, parseMaxHeartbeatsPerSec, shouldSendHeartbeat } from './throttle';

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
    private _maxHeartbeatsPerSec: number = DEFAULT_MAX_HEARTBEATS_PER_SEC;
    private _lastFilePath: string = '';
    private _lastHeartbeatTime: number = 0; // Date.getTime()
    private _lastBranch: string = '';

    constructor(private readonly _log: (message: string) => void) {
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
        const subscriptions: Disposable[] = [];
        window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);
        window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);
        this._disposable = Disposable.from(...subscriptions);
    }

    public init() {
        // Create new Bucket (if not existing)
        this._client.ensureBucket(this._bucket.id, this._bucket.eventType, this._bucket.hostName)
            .then((res) => {
                if (res.alreadyExist) {
                    this._log(`Bucket ${this._bucket.id} already exists`);
                } else {
                    this._log(`Created bucket ${this._bucket.id}`);
                }
                this._bucketCreated = true;
            })
            .catch(err => {
                this._handleError("Couldn't create Bucket. Please make sure the server is running properly and then run the [Reload ActivityWatch] command.", true);
                this._bucketCreated = false;
                this._log(`Error creating bucket: ${err}`);
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
        this._maxHeartbeatsPerSec = parseMaxHeartbeatsPerSec(extConfigurations.get('maxHeartbeatsPerSec'));
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
            const current = {
                file: heartbeat.data.file,
                branch: String(heartbeat.data.branch),
                time: heartbeat.timestamp.getTime()
            };
            const last = { file: this._lastFilePath, branch: this._lastBranch, time: this._lastHeartbeatTime };

            // Send heartbeat if file changed, branch changed or enough time passed
            if (shouldSendHeartbeat(last, current, this._maxHeartbeatsPerSec)) {
                this._lastFilePath = current.file;
                this._lastBranch = current.branch;
                this._lastHeartbeatTime = current.time;
                this._sendHeartbeat(heartbeat);
            }
        }
        catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this._handleError(message);
        }
    }

    private _sendHeartbeat(event: IAppEditorEvent) {
        return this._client.heartbeat(this._bucket.id, this._pulseTime, event)
            .catch(({ err }) => {
                this._log(`Error sending heartbeat: ${err}`);
                this._handleError('Error while sending heartbeat', true);
            });
    }

    private _createHeartbeat(): IAppEditorEvent {
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

    private _getProjectFolder(): string | undefined {
        const fileUri = this._getActiveFileUri();
        if (!fileUri) {
            return;
        }
        const workspaceFolder = workspace.getWorkspaceFolder(fileUri);
        if (!workspaceFolder) {
            return;
        }

        return workspaceFolder.uri.path;
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
            this._log(`Error: ${err}`);
            window.showErrorMessage(`[ActivityWatch] ${err}`);
        }
        else {
            this._log(`Warning: ${err}`);
        }
        return;
    }
}

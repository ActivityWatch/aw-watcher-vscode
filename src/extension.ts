// The module 'vscode' contains the VS Code extensibility API
// Import the necessary extensibility types to use in your code below
import { Disposable, ExtensionContext, commands, window, workspace, Uri, env } from 'vscode';
import { AWClient, Event } from './resources/aw-client';
import { hostname } from 'os';
// This method is called when your extension is activated. Activation is

// controlled by the activation events defined in package.json.
export function activate(context: ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error).
    // This line of code will only be executed once when your extension is activated.
    console.log('Congratulations, your extension "ActivityWatch" is now active!');

    // Init ActivityWatch
    let controller = new ActivityWatch();
    controller.init();
    context.subscriptions.push(controller);

    // Command:Reload
    const reloadCommand = commands.registerCommand('extension.reload', () => controller.init());
    context.subscriptions.push(reloadCommand);
}

interface VSCodeEvent extends Event {
    data: {
        editor: string;
        project: string;
        language: string;
        file: string;
    };
}

class ActivityWatch {
    private _disposable: Disposable;
    private _client: AWClient;

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
    private _lastHeartbeatTime: number = 0; // in seconds

    constructor() {
        this._bucket = {
            id: '',
            hostName: hostname(),
            clientName: 'aw-watcher-vscode',
            eventType: 'coding.vscode'
        };
        this._bucket.id = `${this._bucket.clientName}_${this._bucket.hostName}`;

        // Create AWClient
        this._client = new AWClient(this._bucket.clientName, false);

        // subscribe to selection change events
        let subscriptions: Disposable[] = [];
        window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);
        window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);
        this._disposable = Disposable.from(...subscriptions);
    }

    public init() {
        // Create new Bucket (if not existing)
        this._client.createBucket(this._bucket.id, this._bucket.eventType, this._bucket.hostName)
            .then(() => {
                console.log('Created Bucket');
                this._bucketCreated = true;
            })
            .catch(err => {
                this._handleError("Couldn't create Bucket. Please make sure the server is running properly and then run the [Reload ActivityWatch] command.", true);
                this._bucketCreated = false;
                console.error(err);
            });
    }

    public dispose() {
        this._disposable.dispose();
    }

    private _onEvent() {
        if (!this._bucketCreated) {
            return;
        }

        // Create and send VSCodeEvent
        try {
            const event = this._createEvent();
            const filePath = this._getFilePath();
            const curTime = new Date().getSeconds();
            
            // Send heartbeat if file changed or enough time passed
            if (filePath !== this._lastFilePath || this._lastHeartbeatTime + (1 / this._maxHeartbeatsPerSec) < curTime) {
                this._lastFilePath = filePath;
                this._lastHeartbeatTime = curTime;
                this._sendHeartbeat(event);
            }
        }
        catch (err) {
            this._handleError(err);
        }
    }

    private _sendHeartbeat(event: VSCodeEvent) {
        return this._client.heartbeat(this._bucket.id, this._pulseTime, event)
            .then(() => console.log('Sent heartbeat', event))    
            .catch(({ err }) => this._handleError('Error while sending heartbeat', true));
    }

    private _createEvent(): VSCodeEvent {
        return {
            timestamp: new Date().toISOString(),
            duration: 0,
            data: {
                editor: env.appName,
                language: this._getFileLanguage(),
                project: this._getProjectName(),
                file: this._getFileName()
            }
        };
    }

    private _getProjectName(): string {
        const filePath = this._getFilePath();
        const uri = Uri.file(filePath);
        const workspaceFolder = workspace.getWorkspaceFolder(uri);
        if (!workspaceFolder || !workspaceFolder.hasOwnProperty('name')) {
            throw new Error("Couldn't get project name");
        }

        return workspaceFolder.name;
    }

    private _getFilePath(): string {
        const editor = window.activeTextEditor;
        if (!editor) {
            throw new Error("Couldn't get current file path");
        }
        
        return editor.document.fileName;
    }

    private _getFileName(): string {
        const filePath = this._getFilePath();

        return filePath.substr(filePath.lastIndexOf('/') + 1);
    }

    private _getFileLanguage(): string {
        const editor = window.activeTextEditor;
        if (!editor) {
            throw new Error("Couldn't get current language");
        }

        return editor.document.languageId;
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

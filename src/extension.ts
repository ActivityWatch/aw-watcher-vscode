// The module 'vscode' contains the VS Code extensibility API
// Import the necessary extensibility types to use in your code below
import { Disposable, ExtensionContext, commands, window, workspace, env } from 'vscode';
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
    }
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
    private _pulseTime: number = 10;

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
        window.onDidChangeTextEditorSelection(() => console.log('onDidChangeTextEditorSelection'));
        this._disposable = Disposable.from(...subscriptions);
    }

    init() {
        // Create new Bucket (if not existing)
        this._client.createBucket(this._bucket.id, this._bucket.eventType, this._bucket.hostName)
            .then(() => {
                console.log('Created Bucket');
                this._bucketCreated = true;
            })
            .catch(err => {
                this._handleError("Couldn't create Bucket. Please make sure the server is running properly and then run the [Reload ActivityWatch] command.", true);
                console.error(err);
            });
    }

    dispose() {
        this._disposable.dispose();
    }

    private _onEvent() {
        if (!this._bucketCreated) {
            return;
        }

        // Create and send VSCodeEvent
        const event = this._createEvent();
        this._sendHeartbeat(event);
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
                language: this._getFileLanguage() || 'unknown',
                project: this._getProjectName() || 'unknown',
                file: this._getFileName() || 'unknown'
            }
        };
    }

    private _getProjectName(): string | undefined {
        const workspaceFolders = workspace.workspaceFolders;
        if (!workspaceFolders || !workspaceFolders.length) {
            return this._handleError("Couldn't get current project name");
        }
        else if (workspaceFolders.length === 1) {
            return workspaceFolders[0].name;
        }
        else {
            // Check if the current file path includes the name of any workspace
            const filePath = this._getFilePath();
            if (!filePath) {
                return this._handleError("Couldn't get current project name");
            }
            const possibleProjectFolders = workspaceFolders.filter(({ name }) => filePath.includes(name));

            if (possibleProjectFolders.length === 1) {
                return possibleProjectFolders[0].name;
            }
            else {
                return this._handleError("Couldn't get current project name");
            }
        }
    }

    private _getFilePath(): string | undefined {
        const editor = window.activeTextEditor;
        if (!editor) {
            return this._handleError("Couldn't get current file path");
        }
        
        return editor.document.fileName;
    }

    private _getFileName(): string | undefined {
        const filePath = this._getFilePath();
        if (!filePath) {
            return this._handleError("Couldn't get current file name");
        }

        return filePath.substr(filePath.lastIndexOf('/') + 1);
    }

    private _getFileLanguage(): string | undefined {
        const editor = window.activeTextEditor;
        if (!editor) {
            return this._handleError("Couldn't get current language");
        }

        return editor.document.languageId;
    }

    _handleError(err: string, isCritical = false): undefined {
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

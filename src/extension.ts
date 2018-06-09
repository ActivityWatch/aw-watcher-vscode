// The module 'vscode' contains the VS Code extensibility API
// Import the necessary extensibility types to use in your code below
import { Disposable, ExtensionContext, commands, window, workspace, env } from 'vscode';
import { AWClient, Event } from './resources/aw-client';
import { hostname } from 'os';
import { notDeepEqual } from 'assert';

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
    private _lastEvent: VSCodeEvent | undefined;
    private _pulseTime: number = 10;

    constructor() {
        this._bucket = {
            id: '',
            hostName: hostname(),
            clientName: 'aw-watcher-vscode',
            eventType: 'coding.vscode'
        };
        this._bucket.id = `${this._bucket.clientName}_${this._bucket.hostName}`;
        this._lastEvent = this._createEvent();

        this._client = new AWClient(this._bucket.clientName, false);

        // subscribe to selection change and editor activation events
        let subscriptions: Disposable[] = [];
        window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);

        // create a combined disposable from both event subscriptions
        this._disposable = Disposable.from(...subscriptions);
    }

    init() {
        // Create new Bucket (if not existing)
        this._client.createBucket(this._bucket.id, this._bucket.eventType, this._bucket.hostName)
            .then(() => {
                console.log('Created Bucket');
                this._bucketCreated = true;

                // Send heartbeat a bit more frequently than the pulse time 
                setInterval(this._sendLastEvent.bind(this), (this._pulseTime * 1000) * 0.8);
                this._sendLastEvent();
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

        // Create Event
        const event = this._createEvent();

        // If stored event differs send the stored event and then exchange it with the current event
        try {
            if (this._lastEvent) {
                notDeepEqual(event.data, this._lastEvent.data);
            }
            this._sendLastEvent();
            this._lastEvent = event;
        }
        catch {
            // Do nothing as an equal event is already stored
        }
    }

    private _sendLastEvent() {
        if (this._lastEvent) {
            return this._sendHeartbeat(this._lastEvent)
                .then(() => this._lastEvent = undefined);
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

        // TODO: Check if multiple workspaces can be loaded and if there is a way to determine the active workspace folder
        return workspaceFolders[0].name;
    }

    private _getFileName(): string | undefined {
        const editor = window.activeTextEditor;
        if (!editor) {
            return this._handleError("Couldn't get current file name");
        }
        const filePath = editor.document.fileName;
        const fileName = filePath.substr(filePath.lastIndexOf('/') + 1);

        return fileName;
    }

    private _getFileLanguage(): string | undefined {
        const editor = window.activeTextEditor;
        if (!editor) {
            return this._handleError('Couldn\'t get current language');
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
/*
    private get _bucketId() {
        return 'aw-watch-vscode';
    }

    private get _clientId() {
        return 'aw-watch-vscode';
    }

    private get _type() {
        return 'vscode.current.workspace';
    }
*/
}

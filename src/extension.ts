// The module 'vscode' contains the VS Code extensibility API
// Import the necessary extensibility types to use in your code below
import { Disposable, ExtensionContext, window, workspace } from 'vscode';
import { AWClient, Event } from './resources/aw-client';
import { hostname } from 'os';

// This method is called when your extension is activated. Activation is
// controlled by the activation events defined in package.json.
export function activate(context: ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error).
    // This line of code will only be executed once when your extension is activated.
    console.log('Congratulations, your extension "ActivityWatch" is now active!');

    // create a new word counter
    let controller = new ActivityWatch();

    // Add to a list of disposables which are disposed when this extension is deactivated.
    context.subscriptions.push(controller);
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

    constructor() {
        this._bucket = {
            id: '',
            hostName: hostname(),
            clientName: 'aw-watcher-vscode',
            eventType: 'coding.vscode'
        };
        this._bucket.id = `${this._bucket.clientName}_${this._bucket.hostName}`;

        this._client = new AWClient(this._bucket.clientName, false);


        // Create new Bucket (if not existing)
        this._client.createBucket(this._bucket.id, this._bucket.eventType, this._bucket.hostName)
            .then(() => {
                console.log('Created Bucket');
                this._bucketCreated = true;
            })
            .catch(err => {
                this._handleError("Couldn't create Bucket. Please make sure the server is running properly.", true);
                console.error(err);
            });
        
        // subscribe to selection change and editor activation events
        let subscriptions: Disposable[] = [];
        window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);
        window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);

        // create a combined disposable from both event subscriptions
        this._disposable = Disposable.from(...subscriptions);
    }

    dispose() {
        this._disposable.dispose();
    }

    private _onEvent() {
        if (!this._bucketCreated) {
            return;
        }

        const projectName = this._getProjectName();
        const codingLanguage = this._getFileLanguage();
        const fileName = this._getFileName();

        if (!projectName || !codingLanguage || !fileName) {
            return this._handleError('error while creating event');
        }

        const event: VSCodeEvent = {
            timestamp: new Date().toISOString(),
            duration: 10,
            data: {
                editor: 'vs-code',
                language: codingLanguage,
                project: projectName,
                file: fileName
            }
        };
        this._client.heartbeat(this._bucket.id, 10, event)
            .then(() => console.log('Sent heartbeat', event))    
            .catch(({ err }) => this._handleError('Error while sending heartbeat', true));
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

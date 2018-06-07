// The module 'vscode' contains the VS Code extensibility API
// Import the necessary extensibility types to use in your code below
import { Disposable, ExtensionContext, window, workspace } from 'vscode';
import { AWClient } from './resources/aw-client';
import Event from './resources_old/event';

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

class ActivityWatch {
    private _disposable: Disposable;
    private _client: AWClient;
    private _bucketId = 'aw-watcher-vscode_test';
    private _hostName = 'test';
    private _clientName = 'aw-watcher-vscode';
    private _eventType = 'coding.vscode';

    constructor() {
        this._client = new AWClient(this._clientName, true);
        this._client.createBucket(this._bucketId, this._eventType, this._hostName)
            .then(console.log)
            .catch(console.error);
        
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
        const projectName = this._getProjectName();
        if (!projectName) {
            return this._handleError('project name not found');
        }
        const codingLanguage = this._getFileLanguage();
        if (!codingLanguage) {
            return this._handleError('coding language not found');
        }

        const event: Event = {
            timestamp: new Date().toISOString(),
            duration: 10,
            data: {
                editor: 'vs-code',
                language: codingLanguage,
                project: projectName
            }
        };
        console.log('Sending Hearbeat', event);
        this._client.heartbeat(this._bucketId, 10, event)
            .then(() => console.log('Sent heartbeat', event))
            .catch(({ err }) => this._handleError('Error while sending heartbeat'));
    }

    private _getProjectName(): string | undefined {
        const workspaceFolders = workspace.workspaceFolders;
        if (!workspaceFolders || !workspaceFolders.length) {
            return;
        }

        // TODO: Check if multiple workspaces can be loaded and if there is a way to determine the active workspace folder
        return workspaceFolders[0].name;
    }

    private _getFileLanguage(): string | undefined {
        const editor = window.activeTextEditor;
        if (!editor) {
            return this._handleError('Couldn\'t get current language');
        }

        return editor.document.languageId;
    }

    _handleError(err: string): undefined {
        window.showErrorMessage(err);
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

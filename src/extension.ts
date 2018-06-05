// The module 'vscode' contains the VS Code extensibility API
// Import the necessary extensibility types to use in your code below
import { Disposable, ExtensionContext, window, workspace } from 'vscode';
import Bucket from './resources/bucket.js';

// This method is called when your extension is activated. Activation is
// controlled by the activation events defined in package.json.
export function activate(context: ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error).
    // This line of code will only be executed once when your extension is activated.
    console.log('Congratulations, your extension "ActivityWatch" is now active!');
    console.log('Workspace: ', workspace.workspaceFolders);

    // create a new word counter
    let controller = new ActivityWatch();

    // Add to a list of disposables which are disposed when this extension is deactivated.
    context.subscriptions.push(controller);
}

class ActivityWatch {
    private _disposable: Disposable;
    private _bucket: Bucket;

    constructor() {
        this._bucket = new Bucket();
        // this._bucket.getBucketList();
        this._bucket.initBucket('aw-watcher-coding', 'unknown', 'coding.editor.project')
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
        console.log('_onEvent');
        const projectName = this._getProjectName();
        if (!projectName) {
            return this._handleError('project name not found');
        }

        console.log(projectName);
    }

    private _getProjectName(): string | undefined {
        const workspaceFolders = workspace.workspaceFolders;
        if (!workspaceFolders || !workspaceFolders.length) {
            return;
        }

        // TODO: Check if multiple workspaces can be loaded and if there is a way to determine the active workspace folder
        return workspaceFolders[0].name;
    }

    _handleError(err: string) {
        window.showErrorMessage(err);
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

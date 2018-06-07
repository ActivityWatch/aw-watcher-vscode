"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// The module 'vscode' contains the VS Code extensibility API
// Import the necessary extensibility types to use in your code below
const vscode_1 = require("vscode");
const bucket_js_1 = require("./resources/bucket.js");
// This method is called when your extension is activated. Activation is
// controlled by the activation events defined in package.json.
function activate(context) {
    // Use the console to output diagnostic information (console.log) and errors (console.error).
    // This line of code will only be executed once when your extension is activated.
    console.log('Congratulations, your extension "ActivityWatch" is now active!');
    // create a new word counter
    let controller = new ActivityWatch();
    // Add to a list of disposables which are disposed when this extension is deactivated.
    context.subscriptions.push(controller);
}
exports.activate = activate;
class ActivityWatch {
    constructor() {
        this._bucket = new bucket_js_1.default();
        this._bucket.initBucket('aw-watcher-coding', 'unknown', 'coding.editor.project')
            .then(console.log)
            .catch(console.error);
        // subscribe to selection change and editor activation events
        let subscriptions = [];
        vscode_1.window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);
        vscode_1.window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);
        // create a combined disposable from both event subscriptions
        this._disposable = vscode_1.Disposable.from(...subscriptions);
    }
    dispose() {
        this._disposable.dispose();
    }
    _onEvent() {
        const projectName = this._getProjectName();
        if (!projectName) {
            return this._handleError('project name not found');
        }
        const codingLanguage = this._getFileLanguage();
        if (!codingLanguage) {
            return this._handleError('coding language not found');
        }
        const event = {
            timestamp: new Date().toISOString(),
            duration: 10,
            data: {
                editor: 'vs-code',
                language: codingLanguage,
                project: projectName
            }
        };
        console.log('Sending Hearbeat', event);
        this._bucket.sendHearbeat(undefined, event, 10)
            .then(() => console.log('Sent heartbeat', event))
            .catch(({ err }) => this._handleError('Error while sending heartbeat'));
    }
    _getProjectName() {
        const workspaceFolders = vscode_1.workspace.workspaceFolders;
        if (!workspaceFolders || !workspaceFolders.length) {
            return;
        }
        // TODO: Check if multiple workspaces can be loaded and if there is a way to determine the active workspace folder
        return workspaceFolders[0].name;
    }
    _getFileLanguage() {
        const editor = vscode_1.window.activeTextEditor;
        if (!editor) {
            return this._handleError('Couldn\'t get current language');
        }
        return editor.document.languageId;
    }
    _handleError(err) {
        vscode_1.window.showErrorMessage(err);
        return;
    }
}
//# sourceMappingURL=extension.js.map
// The module 'vscode' contains the VS Code extensibility API
// Import the necessary extensibility types to use in your code below
import * as vscode from 'vscode';
import { Disposable, Event, ExtensionContext, TextEditor, commands, window, workspace, Uri, Extension, extensions } from 'vscode';
import { AWClient, IAppEditorEvent } from '../aw-client-js/src/aw-client';
import { hostname } from 'os';
import { API, GitExtension } from './git';

// The tab API arrived in VS Code 1.67, after the engine version this extension targets,
// so the few parts used here are declared locally and checked for at runtime.
interface Tab {
    label: string;
    input: unknown;
}
interface TabGroups {
    activeTabGroup: { activeTab: Tab | undefined };
    onDidChangeTabs: Event<unknown>;
    onDidChangeTabGroups: Event<unknown>;
}

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
    private _inputTimeout: number = 180; // seconds, matching aw-watcher-afk
    private _maxHeartbeatsPerSec: number = 1;
    private _lastFilePath: string = '';
    private _lastHeartbeatTime: number = 0; // Date.getTime()
    private _lastBranch: string | undefined;
    private _lastEditorUri: Uri | undefined;
    private _lastEditorInput: number = 0; // Date.getTime()

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
        window.onDidChangeTextEditorSelection(this._onEditorInput, this, subscriptions);
        window.onDidChangeTextEditorVisibleRanges(this._onEditorInput, this, subscriptions);
        window.onDidChangeActiveTextEditor(this._onEditorInput, this, subscriptions);
        window.onDidChangeWindowState(this._onEvent, this, subscriptions);
        const tabGroups = this._getTabGroups();
        if (tabGroups) {
            tabGroups.onDidChangeTabs(this._onEvent, this, subscriptions);
            tabGroups.onDidChangeTabGroups(this._onEvent, this, subscriptions);
        }

        // Keep time accruing while the window has focus but nothing in it changes,
        // such as reading a file, watching a terminal or using a chat view.
        const focusedPulse = setInterval(() => this._onEvent(), this._pulseTime * 1000 / 2);
        subscriptions.push(new Disposable(() => clearInterval(focusedPulse)));

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

    private _onEditorInput() {
        this._lastEditorInput = new Date().getTime();
        this._onEvent();
    }

    private _onEvent() {
        if (!this._bucketCreated || !window.state.focused) {
            return;
        }

        // An editor left open while working elsewhere in the window, such as a chat sidebar, must not keep accruing.
        if (this._getActiveEditor() && this._lastEditorInput + this._inputTimeout * 1000 < new Date().getTime()) {
            return;
        }

        // Create and send heartbeat
        try {
            const heartbeat = this._createHeartbeat();
            if (!heartbeat) {
                return;
            }
            const filePath = heartbeat.data.file;
            const curTime = new Date().getTime();
            const branch = this._getCurrentBranch();

            // Send heartbeat if file changed, branch changed or enough time passed
            if (filePath !== this._lastFilePath ||
                    branch !== this._lastBranch ||
                    this._lastHeartbeatTime + (1000 / (this._maxHeartbeatsPerSec)) < curTime) {
                this._lastFilePath = filePath || 'unknown';
                this._lastBranch = branch;
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

    private _createHeartbeat(): IAppEditorEvent | undefined {
        // Without a text editor, describe the active tab instead (webviews, terminals, custom editors).
        const editor = this._getActiveEditor();
        if (!editor) {
            const tab = this._getActiveTab();
            const kind = tab && this._getTabKind(tab);
            // Sending nothing here keeps the previous event open; an 'unknown' heartbeat would split it in two.
            if (!tab || !kind || kind === 'unknown') {
                return;
            }
            return {
                timestamp: new Date(),
                duration: 0,
                data: {
                    language: kind,
                    project: this._getTabProject(tab) || 'unknown',
                    file: this._getTabFile(tab),
                    branch: this._getCurrentBranch() || 'unknown'
                }
            };
        }
        if (workspace.getWorkspaceFolder(editor.document.uri)) {
            this._lastEditorUri = editor.document.uri;
        }
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

    private _getActiveEditor(): TextEditor | undefined {
        // Buffers outside the workspace that are not files, such as an agent's tool output, have no project to report.
        const editor = window.activeTextEditor;
        const uri = editor?.document.uri;
        if (!editor || !uri || (!workspace.getWorkspaceFolder(uri) && uri.scheme !== 'file' && uri.scheme !== 'untitled')) {
            return;
        }
        return editor;
    }

    private _getTabGroups(): TabGroups | undefined {
        return (window as any).tabGroups;
    }

    private _getActiveTab(): Tab | undefined {
        const tabGroups = this._getTabGroups();
        return tabGroups?.activeTabGroup?.activeTab;
    }

    private _getTabKind(tab: Tab): string {
        const api = vscode as any;
        const input = tab.input as any;
        if (api.TabInputWebview && input instanceof api.TabInputWebview) {
            // Webview tabs report their view type with an internal prefix in front.
            return `webview:${input.viewType.replace(/^mainThreadWebview-/, '')}`;
        }
        if (api.TabInputTerminal && input instanceof api.TabInputTerminal) {
            return 'terminal';
        }
        if (api.TabInputCustom && input instanceof api.TabInputCustom) {
            return `custom:${input.viewType}`;
        }
        if (api.TabInputNotebook && input instanceof api.TabInputNotebook) {
            return `notebook:${input.notebookType}`;
        }
        return 'unknown';
    }

    private _getTabUri(tab: Tab): Uri | undefined {
        const input = tab.input as any;
        return input?.uri instanceof Uri ? input.uri : undefined;
    }

    private _getTabFile(tab: Tab): string {
        return this._getTabUri(tab)?.fsPath || tab.label;
    }

    private _getTabProject(tab: Tab): string | undefined {
        // Use the tab's own file, then the file last edited, and only guess when the window has a single folder.
        for (const uri of [this._getTabUri(tab), this._lastEditorUri]) {
            const folder = uri && workspace.getWorkspaceFolder(uri);
            if (folder) {
                return folder.uri.path;
            }
        }
        const folders = workspace.workspaceFolders;
        return folders && folders.length === 1 ? folders[0].uri.path : undefined;
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
            console.error('[ActivityWatch][handleError]', err);
            window.showErrorMessage(`[ActivityWatch] ${err}`);
        }
        else {
            console.warn('[AcitivtyWatch][handleError]', err);
        }
        return;
    }
}

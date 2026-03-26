import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class WorkspaceManagerPanel {
    public static currentPanel: WorkspaceManagerPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    // Tracks if we are currently loading workspaces to prevent loops
    public static readonly viewType = 'workspaceManager';

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (WorkspaceManagerPanel.currentPanel) {
            WorkspaceManagerPanel.currentPanel._panel.reveal(column);
            WorkspaceManagerPanel.currentPanel.refreshData();
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            WorkspaceManagerPanel.viewType,
            'Workspace Manager',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        WorkspaceManagerPanel.currentPanel = new WorkspaceManagerPanel(panel, extensionUri);
        WorkspaceManagerPanel.currentPanel.refreshData();
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Update the content based on view changes
        this._panel.onDidChangeViewState(
            e => {
                if (this._panel.visible) {
                    this._update();
                    this.refreshData();
                }
            },
            null,
            this._disposables
        );

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'setMainProject':
                        this.setMainProject();
                        return;
                    case 'createWorkspace':
                        this.createWorkspace();
                        return;
                    case 'copyPaths':
                        this.copyPaths(message.paths);
                        return;
                    case 'refresh':
                        this.refreshData();
                        return;
                    case 'loadWorkspace':
                        this.loadWorkspace(message.fileName);
                        return;
                    case 'ready':
                        this.refreshData();
                        return;
                    case 'showError':
                        vscode.window.showErrorMessage(message.text);
                        return;
                    case 'openSettings':
                        vscode.commands.executeCommand('workbench.action.openSettings', 'antigravityWorkspace');
                        return;
                    case 'saveCurrentTo':
                        this.saveCurrentTo(message.fileName);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    private async setMainProject() {
        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            title: 'Select Main Project Root'
        });

        if (uris && uris.length > 0) {
            const config = vscode.workspace.getConfiguration('antigravityWorkspace');
            await config.update('mainProjectRoot', uris[0].fsPath, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Main Project set to: ${uris[0].fsPath}`);
            this.refreshData();
        }
    }

    private async createWorkspace() {
        const config = vscode.workspace.getConfiguration('antigravityWorkspace');
        const mainProjectRoot = config.get<string>('mainProjectRoot');
        const defaultDirs = config.get<string[]>('defaultAttachedDirectories') || [];

        if (!mainProjectRoot) {
            vscode.window.showErrorMessage('Please set the Main Project Root first.');
            return;
        }

        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            title: 'Select Primary Sub-folder for New Workspace',
            defaultUri: vscode.Uri.file(mainProjectRoot)
        });

        if (!uris || uris.length === 0) {
            return;
        }

        const primaryPath = uris[0].fsPath;
        const workspaceNameInput = await vscode.window.showInputBox({
            prompt: 'Enter Workspace Name (e.g. workspace-name)',
            placeHolder: 'my-feature-workspace'
        });

        if (!workspaceNameInput) {
            return;
        }

        const workspaceName = workspaceNameInput.replace(/[^a-zA-Z0-9-_]/g, '-');
        
        const workspacesDir = path.join(mainProjectRoot, '.workspaces');
        if (!fs.existsSync(workspacesDir)) {
            fs.mkdirSync(workspacesDir, { recursive: true });
        }

        const workspaceFilePath = path.join(workspacesDir, `${workspaceName}.code-workspace`);

        // Resolve folders
        const folders: {path: string}[] = [];
        
        // Use relative paths if possible
        const addFolder = (fullPath: string) => {
             let relPath = fullPath;
             relPath = path.relative(path.dirname(workspaceFilePath), fullPath);
             folders.push({ path: relPath });
        };

        addFolder(primaryPath);

        // Add defaults
        for (const defaultDir of defaultDirs) {
            const defaultFullPath = path.join(mainProjectRoot, defaultDir);
            if (fs.existsSync(defaultFullPath)) {
                addFolder(defaultFullPath);
            }
        }

        const workspaceContent = {
            folders: folders,
            settings: {}
        };

        fs.writeFileSync(workspaceFilePath, JSON.stringify(workspaceContent, null, 2), 'utf8');
        vscode.window.showInformationMessage(`Workspace ${workspaceName} created successfully!`);
        this.refreshData();
    }

    private async copyPaths(pathsToCopy: string[]) {
        if (!pathsToCopy || pathsToCopy.length === 0) {
            vscode.window.showWarningMessage('No paths to copy.');
            return;
        }
        
        // Use Antigravity friendly format or standard newline separated paths.
        // Joining with newlines.
        const clipboardText = pathsToCopy.join('\n');
        
        await vscode.env.clipboard.writeText(clipboardText);
        vscode.window.showInformationMessage('Paths copied to clipboard! Ready to paste into Agent Manager.');
    }
    
    private loadWorkspace(fileName: string) {
        const config = vscode.workspace.getConfiguration('antigravityWorkspace');
        const mainProjectRoot = config.get<string>('mainProjectRoot');
        if (!mainProjectRoot) return;
        
        const absolutePath = path.join(mainProjectRoot, '.workspaces', fileName);
        if (fs.existsSync(absolutePath)) {
            vscode.commands.executeCommand('workspaceLoader.load', vscode.Uri.file(absolutePath));
        }
    }

    private refreshData() {
        if (!this._panel) return;

        const config = vscode.workspace.getConfiguration('antigravityWorkspace');
        const mainProjectRoot = config.get<string>('mainProjectRoot') || '';
        const defaultDirs = config.get<string[]>('defaultAttachedDirectories') || [];

        let workspaces: any[] = [];
        let status = 'No Project Set';

        if (mainProjectRoot) {
            if (fs.existsSync(mainProjectRoot)) {
                status = 'Project Found';
                const workspacesDir = path.join(mainProjectRoot, '.workspaces');
                if (fs.existsSync(workspacesDir)) {
                    const files = fs.readdirSync(workspacesDir).filter(f => f.endsWith('.code-workspace'));
                    for (const file of files) {
                        try {
                            const workspaceFilePath = path.join(workspacesDir, file);
                            const content = fs.readFileSync(workspaceFilePath, 'utf8');
                            
                            const data = require('jsonc-parser').parse(content);
                            if (data.folders) {
                                const absolutePaths = data.folders.map((f: any) => {
                                    if (!f.path) return '';
                                    if (path.isAbsolute(f.path)) return f.path;
                                    return path.resolve(workspacesDir, f.path);
                                }).filter((p: string) => p !== '');
                                
                                const copyPaths = absolutePaths.filter((p: string) => {
                                    return !defaultDirs.some(dir => {
                                        const defaultFullPath = path.resolve(mainProjectRoot, dir);
                                        return path.normalize(p).toLowerCase() === path.normalize(defaultFullPath).toLowerCase();
                                    });
                                });

                                workspaces.push({
                                    fileName: file,
                                    paths: absolutePaths,
                                    copyPaths: copyPaths
                                });
                            }
                        } catch (e) {
                            console.error('Error parsing workspace file:', e);
                        }
                    }
                }
            } else {
                status = 'Project Path Invalid';
            }
        }

        this._panel.webview.postMessage({
            command: 'setData',
            data: {
                mainProjectRoot,
                status,
                defaultDirs,
                workspaces
            }
        });
    }

    private async saveCurrentTo(fileName: string) {
        const config = vscode.workspace.getConfiguration('antigravityWorkspace');
        const mainProjectRoot = config.get<string>('mainProjectRoot');
        if (!mainProjectRoot) return;
        const workspacesDir = path.join(mainProjectRoot, '.workspaces');
        const targetPath = path.join(workspacesDir, fileName);
        
        const currentFolders = vscode.workspace.workspaceFolders;
        if (!currentFolders || currentFolders.length === 0) {
            void vscode.window.showInformationMessage('No folders currently open in workspace to save.');
            return;
        }

        const overwrite = await vscode.window.showWarningMessage(
            `Overwrite "${fileName}" with current open folders?`,
            { modal: true },
            'Yes'
        );
        if (overwrite !== 'Yes') return;

        const foldersData = currentFolders.map(f => {
            let folderPath = f.uri.fsPath;
            if (folderPath.startsWith(mainProjectRoot)) {
                folderPath = path.relative(mainProjectRoot, folderPath);
                folderPath = folderPath.replace(/\\/g, '/');
            }
            return { path: folderPath };
        });

        const workspaceJson = { folders: foldersData, settings: {} };
        fs.writeFileSync(targetPath, JSON.stringify(workspaceJson, null, 4));
        vscode.window.showInformationMessage(`Workspace saved successfully to ${fileName}`);
        this.refreshData();
    }



    public dispose() {
        WorkspaceManagerPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.title = "Workspace Manager";
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Simple HTML for the panel
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Workspace Manager</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-editor-foreground);
                        background-color: var(--vscode-editor-background);
                        padding: 20px;
                    }
                    .container {
                        max-width: 800px;
                        margin: 0 auto;
                    }
                    h1 { color: var(--vscode-editor-foreground); border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 10px; }
                    .card {
                        background: var(--vscode-editorWidget-background);
                        border: 1px solid var(--vscode-widget-border);
                        padding: 15px;
                        border-radius: 6px;
                        margin-bottom: 20px;
                    }
                    button {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 8px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 13px;
                    }
                    button:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                    .btn-secondary {
                        background: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                    }
                    .btn-secondary:hover {
                        background: var(--vscode-button-secondaryHoverBackground);
                    }
                    .flex { display: flex; align-items: center; gap: 10px; }
                    .justify-between { justify-content: space-between; }
                    .workspace-item {
                        border-left: 3px solid var(--vscode-button-background);
                        padding: 10px 15px;
                        margin-bottom: 10px;
                        background: var(--vscode-editor-inactiveSelectionBackground);
                    }
                    .path-list { font-size: 12px; opacity: 0.8; margin-top: 5px; }
                    .path-item { margin-top: 2px; }
                    code {
                        background: var(--vscode-textCodeBlock-background);
                        padding: 2px 4px;
                        border-radius: 3px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Antigravity Workspace Manager</h1>
                    
                    <div class="card">
                        <h3>Configuration</h3>
                        <div class="flex" style="margin-bottom: 10px;">
                            <strong>Main Project:</strong>
                            <span id="main-project-path">Loading...</span>
                        </div>
                        <div class="flex" style="margin-bottom: 15px;">
                            <strong>Default Dirs:</strong>
                            <span id="default-dirs">Loading...</span>
                        </div>
                        <div class="flex">
                            <button id="set-project-btn">Set Main Project</button>
                            <button id="open-settings-btn" class="btn-secondary">Edit Default Dirs (Settings)</button>
                            <button id="refresh-btn" class="btn-secondary">↻ Refresh</button>
                        </div>
                    </div>

                    <div class="card">
                        <div class="flex justify-between" style="margin-bottom: 15px;">
                            <h3>Saved Workspaces</h3>
                            <button id="create-ws-btn"><b>+</b> Create New Workspace</button>
                        </div>
                        <input type="text" id="search-box" placeholder="Search saved workspaces by name..." style="width: 100%; box-sizing: border-box; margin-bottom: 15px; padding: 8px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 4px;">
                        <div id="workspaces-list">
                            Loading workspaces...
                        </div>
                    </div>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();

                    document.getElementById('set-project-btn').addEventListener('click', () => {
                        vscode.postMessage({ command: 'setMainProject' });
                    });
                    document.getElementById('open-settings-btn').addEventListener('click', () => {
                        vscode.postMessage({ command: 'openSettings' });
                    });
                    document.getElementById('refresh-btn').addEventListener('click', () => {
                        vscode.postMessage({ command: 'refresh' });
                    });
                    document.getElementById('create-ws-btn').addEventListener('click', () => {
                        vscode.postMessage({ command: 'createWorkspace' });
                    });

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'setData':
                                renderData(message.data);
                                break;
                        }
                    });

                    function renderData(data) {
                        document.getElementById('main-project-path').innerHTML = data.mainProjectRoot ? 
                            '<code>' + data.mainProjectRoot + '</code> (' + data.status + ')' : 
                            '<em>Not set</em>';
                        
                        document.getElementById('default-dirs').innerHTML = data.defaultDirs.length > 0 ?
                            data.defaultDirs.map(d => '<code>' + d + '</code>').join(', ') :
                            '<em>None</em>';

                        const wsList = document.getElementById('workspaces-list');
                        if (!data.mainProjectRoot) {
                            wsList.innerHTML = '<em>Please set the Main Project to see workspaces.</em>';
                            return;
                        }
                        
                        if (data.workspaces.length === 0) {
                            wsList.innerHTML = '<em>No workspaces found in .workspaces/ directory.</em>';
                            return;
                        }

                        wsList.innerHTML = '';
                        data.workspaces.forEach(ws => {
                            const wsDiv = document.createElement('div');
                            wsDiv.className = 'workspace-item';
                            wsDiv.setAttribute('data-name', ws.fileName);
                            
                            const pathsHtml = ws.paths.map(p => '<div class="path-item">📁 ' + p + '</div>').join('');
                            
                            wsDiv.innerHTML = \`
                                <div class="flex justify-between">
                                    <strong>\${ws.fileName}</strong>
                                    <div class="flex">
                                        <button class="btn-secondary btn-load" data-file="\${ws.fileName}">Load in VSCode</button>
                                        <button class="btn-secondary btn-save" title="Save Current Open Workspace to this slot" data-file="\${ws.fileName}">Save</button>
                                        <button class="btn-copy">Copy \${ws.copyPaths.length} Project Paths</button>
                                    </div>
                                </div>
                                <div class="path-list">
                                    \${pathsHtml}
                                </div>
                            \`;
                            
                            wsDiv.querySelector('.btn-copy').addEventListener('click', () => {
                                vscode.postMessage({ command: 'copyPaths', paths: ws.copyPaths });
                            });
                            
                            wsDiv.querySelector('.btn-load').addEventListener('click', (e) => {
                                vscode.postMessage({ command: 'loadWorkspace', fileName: e.target.dataset.file });
                            });

                            wsDiv.querySelector('.btn-save').addEventListener('click', (e) => {
                                vscode.postMessage({ command: 'saveCurrentTo', fileName: e.target.dataset.file });
                            });

                            wsList.appendChild(wsDiv);
                        });

                        const searchBox = document.getElementById('search-box');
                        if (searchBox) {
                            searchBox.addEventListener('input', (e) => {
                                const term = e.target.value.toLowerCase();
                                document.querySelectorAll('.workspace-item').forEach(item => {
                                    const name = item.getAttribute('data-name').toLowerCase();
                                    item.style.display = name.includes(term) ? 'block' : 'none';
                                });
                            });
                        }
                    }

                    // Tell the extension we are ready to receive data
                    window.onload = () => {
                        vscode.postMessage({ command: 'ready' });
                    };
                </script>
            </body>
            </html>`;
    }
}

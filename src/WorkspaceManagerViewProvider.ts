import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { parse } from 'jsonc-parser';

export class WorkspaceManagerViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'workspaceLoader.managerView';
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this.getHtmlForWebview();

        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'setMainProject':
                    await this.setMainProject();
                    break;
                case 'createWorkspace':
                    vscode.commands.executeCommand('workspaceLoader.quickCreateWorkspace');
                    break;
                case 'copyPaths':
                    this.copyPaths(message.paths);
                    break;
                case 'refresh':
                case 'ready':
                    this.refreshData();
                    break;
                case 'loadWorkspace':
                    this.loadWorkspace(message.fileName);
                    break;
                case 'openSettings':
                    vscode.commands.executeCommand('workbench.action.openSettings', 'antigravityWorkspace');
                    break;
                case 'saveCurrentTo':
                    this.saveCurrentTo(message.fileName);
                    break;
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

    private async setMainProject() {
        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: false, canSelectFolders: true, canSelectMany: false, title: 'Select Main Project Root'
        });
        if (uris && uris.length > 0) {
            const config = vscode.workspace.getConfiguration('antigravityWorkspace');
            await config.update('mainProjectRoot', uris[0].fsPath, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Main Project set to: ${uris[0].fsPath}`);
            this.refreshData();
        }
    }

    private async copyPaths(pathsToCopy: string[]) {
        if (!pathsToCopy || pathsToCopy.length === 0) return;
        await vscode.env.clipboard.writeText(pathsToCopy.join('\n'));
        vscode.window.showInformationMessage('Paths copied to clipboard! Ready to paste into Agent Manager.');
    }

    private async loadWorkspace(fileName: string) {
        const config = vscode.workspace.getConfiguration('antigravityWorkspace');
        const mainProjectRoot = config.get<string>('mainProjectRoot');
        if (!mainProjectRoot) return;
        const absolutePath = path.join(mainProjectRoot, '.workspaces', fileName);
        if (fs.existsSync(absolutePath)) {
             vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(absolutePath), false);
        }
    }

    public refreshData() {
        if (!this._view) return;
        const config = vscode.workspace.getConfiguration('antigravityWorkspace');
        const mainProjectRoot = config.get<string>('mainProjectRoot') || '';
        const defaultDirs = config.get<string[]>('defaultAttachedDirectories') || [];
        let workspaces: any[] = [];
        let status = 'No Project Set';

        if (mainProjectRoot && fs.existsSync(mainProjectRoot)) {
            status = 'Project Found';
            const workspacesDir = path.join(mainProjectRoot, '.workspaces');
            if (fs.existsSync(workspacesDir)) {
                const files = fs.readdirSync(workspacesDir).filter(f => f.endsWith('.code-workspace'));
                for (const file of files) {
                    try {
                        const content = fs.readFileSync(path.join(workspacesDir, file), 'utf8');
                        const data = parse(content);
                        if (data.folders) {
                            const absolutePaths = data.folders.map((f: any) => 
                                (!f.path) ? '' : (path.isAbsolute(f.path) ? f.path : path.resolve(workspacesDir, f.path))
                            ).filter((p: string) => p !== '');

                            const copyPaths = absolutePaths.filter((p: string) => {
                                return !defaultDirs.some(dir => {
                                    const defaultFullPath = path.resolve(mainProjectRoot, dir);
                                    return path.normalize(p).toLowerCase() === path.normalize(defaultFullPath).toLowerCase();
                                });
                            });

                            workspaces.push({ fileName: file, paths: absolutePaths, copyPaths: copyPaths });
                        }
                    } catch (e) {}
                }
            }
        } else if (mainProjectRoot) {
            status = 'Project Path Invalid';
        }

        this._view.webview.postMessage({ command: 'setData', data: { mainProjectRoot, status, defaultDirs, workspaces } });
    }

    private getHtmlForWebview() {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Workspace Manager</title>
                <style>
                    body { font-family: var(--vscode-font-family); color: var(--vscode-editor-foreground); padding: 10px; }
                    .card { background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-widget-border); padding: 10px; margin-bottom: 10px; border-radius: 4px; }
                    button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 10px; border-radius: 2px; cursor: pointer; width: 100%; margin-top: 5px; }
                    button:hover { background: var(--vscode-button-hoverBackground); }
                    .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
                    .flex-col { display: flex; flex-direction: column; gap: 5px; }
                    .workspace-item { border-left: 3px solid var(--vscode-button-background); padding: 8px; margin-top: 10px; background: var(--vscode-editor-inactiveSelectionBackground); }
                    code { background: var(--vscode-textCodeBlock-background); padding: 2px; font-size: 0.9em; word-break: break-all; }
                </style>
            </head>
            <body>
                <div class="card flex-col">
                    <strong>Main Project:</strong>
                    <span id="main-project-path" style="font-size:0.9em;">Loading...</span>
                    <button id="set-project-btn">Set Main Project</button>
                    <button id="open-settings-btn" class="btn-secondary">Edit Default Dirs</button>
                    <button id="refresh-btn" class="btn-secondary">↻ Refresh</button>
                </div>
                <div class="card flex-col">
                    <button id="create-ws-btn"><b>+</b> Quick Create Workspace</button>
                    <input type="text" id="search-box" placeholder="Search workspaces..." style="width: 100%; box-sizing: border-box; margin-top: 5px; padding: 5px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 2px;">
                </div>
                <div id="workspaces-list">Loading...</div>

                <script>
                    const vscode = acquireVsCodeApi();
                    document.getElementById('set-project-btn').onclick = () => vscode.postMessage({ command: 'setMainProject' });
                    document.getElementById('open-settings-btn').onclick = () => vscode.postMessage({ command: 'openSettings' });
                    document.getElementById('refresh-btn').onclick = () => vscode.postMessage({ command: 'refresh' });
                    document.getElementById('create-ws-btn').onclick = () => vscode.postMessage({ command: 'createWorkspace' });

                    window.addEventListener('message', event => {
                        if (event.data.command === 'setData') renderData(event.data.data);
                    });

                    function renderData(data) {
                        document.getElementById('main-project-path').innerHTML = data.mainProjectRoot ? 
                            '<code>' + data.mainProjectRoot + '</code> (' + data.status + ')' : '<em>Not set</em>';
                        
                        const wsList = document.getElementById('workspaces-list');
                        if (!data.mainProjectRoot) { wsList.innerHTML = '<em>Set Main Project to view workspaces.</em>'; return; }
                        if (data.workspaces.length === 0) { wsList.innerHTML = '<em>No workspaces found.</em>'; return; }

                        wsList.innerHTML = '<h3>Workspaces</h3>';
                        data.workspaces.forEach(ws => {
                            const wsDiv = document.createElement('div');
                            wsDiv.className = 'workspace-item flex-col';
                            wsDiv.setAttribute('data-name', ws.fileName);
                            wsDiv.innerHTML = \`
                                <strong>\${ws.fileName}</strong>
                                <button class="btn-secondary btn-load" data-file="\${ws.fileName}">Load</button>
                                <button class="btn-secondary btn-save" title="Save Current Open Workspace to this slot" data-file="\${ws.fileName}">Save</button>
                                <button class="btn-copy">Copy \${ws.copyPaths.length} \${ws.copyPaths.length > 1 ? 'Paths' : 'Path'}</button>
                            \`;
                            wsDiv.querySelector('.btn-copy').onclick = () => vscode.postMessage({ command: 'copyPaths', paths: ws.copyPaths });
                            wsDiv.querySelector('.btn-load').onclick = (e) => vscode.postMessage({ command: 'loadWorkspace', fileName: e.target.dataset.file });
                            wsDiv.querySelector('.btn-save').onclick = (e) => vscode.postMessage({ command: 'saveCurrentTo', fileName: e.target.dataset.file });
                            wsList.appendChild(wsDiv);
                        });

                        const searchBox = document.getElementById('search-box');
                        if (searchBox) {
                            searchBox.addEventListener('input', (e) => {
                                const term = e.target.value.toLowerCase();
                                document.querySelectorAll('.workspace-item').forEach(item => {
                                    const name = item.getAttribute('data-name').toLowerCase();
                                    item.style.display = name.includes(term) ? 'flex' : 'none';
                                });
                            });
                        }
                    }

                    window.onload = () => vscode.postMessage({ command: 'ready' });
                </script>
            </body>
            </html>`;
    }
}

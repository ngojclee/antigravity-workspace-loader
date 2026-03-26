import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WorkspaceManagerPanel } from './WorkspaceManagerPanel';
import { WorkspaceManagerViewProvider } from './WorkspaceManagerViewProvider';

async function openWorkspaceFile(
    targetUri: vscode.Uri,
    output: vscode.LogOutputChannel,
    source: string
) {
    const workspacePath = path.resolve(targetUri.fsPath);

    if (!workspacePath.toLowerCase().endsWith('.code-workspace')) {
        throw new Error(`Expected a .code-workspace file but received "${workspacePath}".`);
    }

    if (!fs.existsSync(workspacePath)) {
        throw new Error(`Workspace file does not exist: ${workspacePath}`);
    }

    const workspaceUri = vscode.Uri.file(workspacePath);
    output.info(`[${source}] Opening workspace file: ${workspacePath}`);

    await vscode.commands.executeCommand('vscode.openFolder', workspaceUri, {
        forceReuseWindow: true
    });
}

export function activate(context: vscode.ExtensionContext) {
    const output = vscode.window.createOutputChannel('Antigravity Workspace Loader', { log: true });
    context.subscriptions.push(output);
    output.info('Activating extension.');

    try {
        const loadDisposable = vscode.commands.registerCommand('workspaceLoader.load', async (uri?: vscode.Uri) => {
            let targetUri = uri;

            if (!targetUri) {
                const uris = await vscode.window.showOpenDialog({
                    canSelectMany: false,
                    filters: { 'Workspaces': ['code-workspace'] },
                    title: 'Select a .code-workspace file'
                });
                if (uris && uris.length > 0) {
                    targetUri = uris[0];
                } else {
                    return;
                }
            }

            try {
                await openWorkspaceFile(targetUri, output, 'workspaceLoader.load');
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                output.error(`Failed to open workspace file: ${message}`);
                void vscode.window.showErrorMessage(`Error opening workspace file: ${message}`);
            }
        });

        const switchDisposable = vscode.commands.registerCommand('workspaceLoader.switchWorkspace', async () => {
            const config = vscode.workspace.getConfiguration('antigravityWorkspace');
            const mainProjectRoot = config.get<string>('mainProjectRoot');
            if (!mainProjectRoot || !fs.existsSync(mainProjectRoot)) {
                void vscode.window.showErrorMessage('Main Project Root is not configured or invalid. Please open Workspace Manager to set it.');
                return;
            }

            const workspacesDir = path.join(mainProjectRoot, '.workspaces');
            if (!fs.existsSync(workspacesDir)) {
                void vscode.window.showInformationMessage('No .workspaces directory found in Main Project. Create one via Workspace Manager.');
                return;
            }

            const files = fs.readdirSync(workspacesDir).filter(f => f.endsWith('.code-workspace'));
            if (files.length === 0) {
                void vscode.window.showInformationMessage('No workspace configs found in .workspaces/ directory.');
                return;
            }

            const selection = await vscode.window.showQuickPick(files, {
                placeHolder: 'Select a Workspace to Load'
            });

            if (selection) {
                try {
                    const absolutePath = path.join(workspacesDir, selection);
                    await openWorkspaceFile(vscode.Uri.file(absolutePath), output, 'workspaceLoader.switchWorkspace');
                } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : String(error);
                    output.error(`Failed to switch workspace: ${message}`);
                    void vscode.window.showErrorMessage(`Error switching workspace: ${message}`);
                }
            }
        });

        const managerDisposable = vscode.commands.registerCommand('workspaceLoader.openManager', () => {
            output.info('Opening Workspace Manager webview.');
            WorkspaceManagerPanel.createOrShow(context.extensionUri);
        });

        const saveCurrentWorkspaceDisposable = vscode.commands.registerCommand('workspaceLoader.saveCurrentWorkspace', async () => {
            const config = vscode.workspace.getConfiguration('antigravityWorkspace');
            const mainProjectRoot = config.get<string>('mainProjectRoot');
            if (!mainProjectRoot || !fs.existsSync(mainProjectRoot)) {
                void vscode.window.showErrorMessage('Main Project Root is not configured or invalid.');
                return;
            }

            const workspacesDir = path.join(mainProjectRoot, '.workspaces');
            if (!fs.existsSync(workspacesDir)) {
                fs.mkdirSync(workspacesDir, { recursive: true });
            }

            const currentFolders = vscode.workspace.workspaceFolders;
            if (!currentFolders || currentFolders.length === 0) {
                void vscode.window.showInformationMessage('No folders currently open in workspace to save.');
                return;
            }

            const defaultName = path.basename(currentFolders[0].uri.fsPath);
            const inputName = await vscode.window.showInputBox({
                prompt: 'Enter a name for the current workspace',
                value: defaultName
            });

            if (!inputName) return;

            const safeName = inputName.replace(/[^a-zA-Z0-9_-]/g, '_');
            const targetPath = path.join(workspacesDir, `${safeName}.code-workspace`);

            if (fs.existsSync(targetPath)) {
                const overwrite = await vscode.window.showWarningMessage(
                    `Workspace "${safeName}" already exists. Overwrite?`,
                    { modal: true },
                    'Yes'
                );
                if (overwrite !== 'Yes') return;
            }

            const foldersData = currentFolders.map(f => {
                let folderPath = f.uri.fsPath;
                if (folderPath.startsWith(mainProjectRoot)) {
                    folderPath = path.relative(mainProjectRoot, folderPath);
                    folderPath = folderPath.replace(/\\/g, '/');
                }
                return { path: folderPath };
            });

            const workspaceJson = { folders: foldersData };
            fs.writeFileSync(targetPath, JSON.stringify(workspaceJson, null, 4));

            void vscode.window.showInformationMessage(`Workspace saved successfully as ${safeName}.code-workspace`);
        });

        const quickCreateWorkspaceDisposable = vscode.commands.registerCommand('workspaceLoader.quickCreateWorkspace', async () => {
            const config = vscode.workspace.getConfiguration('antigravityWorkspace');
            const mainProjectRoot = config.get<string>('mainProjectRoot');
            const defaultDirs = config.get<string[]>('defaultAttachedDirectories') || [];

            if (!mainProjectRoot || !fs.existsSync(mainProjectRoot)) {
                void vscode.window.showErrorMessage('Main Project Root is not configured or invalid.');
                return;
            }

            const targetUris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                canSelectFolders: true,
                canSelectFiles: false,
                defaultUri: vscode.Uri.file(mainProjectRoot),
                title: 'Select a Main Folder for the New Workspace'
            });

            if (!targetUris || targetUris.length === 0) return;

            const selectedPath = targetUris[0].fsPath;
            if (!selectedPath.startsWith(mainProjectRoot)) {
                void vscode.window.showErrorMessage('Selected folder must be inside the Main Project Root.');
                return;
            }

            const workspaceNameInput = await vscode.window.showInputBox({
                prompt: 'Enter Workspace Name',
                value: path.basename(selectedPath)
            });

            if (!workspaceNameInput) return;

            const safeName = workspaceNameInput.replace(/[^a-zA-Z0-9_-]/g, '_');
            const relativeSelectedPath = path.relative(mainProjectRoot, selectedPath).replace(/\\/g, '/');

            const foldersData = [{ path: relativeSelectedPath }];
            
            for (const dir of defaultDirs) {
                if (dir.trim() !== '') {
                    foldersData.push({ path: dir.replace(/\\/g, '/') });
                }
            }

            const workspaceJson = { folders: foldersData, settings: {} };

            const workspacesDir = path.join(mainProjectRoot, '.workspaces');
            if (!fs.existsSync(workspacesDir)) {
                fs.mkdirSync(workspacesDir, { recursive: true });
            }

            const targetPath = path.join(workspacesDir, `${safeName}.code-workspace`);

            if (fs.existsSync(targetPath)) {
                const overwrite = await vscode.window.showWarningMessage(
                    `Workspace "${safeName}" already exists. Overwrite?`,
                    { modal: true },
                    'Yes'
                );
                if (overwrite !== 'Yes') return;
            }

            fs.writeFileSync(targetPath, JSON.stringify(workspaceJson, null, 4));

            const switchNow = await vscode.window.showInformationMessage(
                `Workspace "${safeName}" created. Switch to it now?`,
                'Yes', 'No'
            );

            if (switchNow === 'Yes') {
                await openWorkspaceFile(vscode.Uri.file(targetPath), output, 'workspaceLoader.quickCreateWorkspace');
            }
        });

        const provider = new WorkspaceManagerViewProvider(context.extensionUri);
        const viewProviderDisposable = vscode.window.registerWebviewViewProvider(
            WorkspaceManagerViewProvider.viewType,
            provider
        );

        const switcherStatusBarBtn = vscode.window.createStatusBarItem(
            'antigravityWorkspace.switchWorkspace',
            vscode.StatusBarAlignment.Left,
            100
        );
        switcherStatusBarBtn.name = 'Antigravity Switch Workspace';
        switcherStatusBarBtn.command = 'workspaceLoader.switchWorkspace';
        switcherStatusBarBtn.text = '$(repo) Switch Workspace';
        switcherStatusBarBtn.tooltip = 'Switch Antigravity Workspace';
        switcherStatusBarBtn.show();

        const managerStatusBarBtn = vscode.window.createStatusBarItem(
            'antigravityWorkspace.openManager',
            vscode.StatusBarAlignment.Left,
            99
        );
        managerStatusBarBtn.name = 'Antigravity Workspace Manager';
        managerStatusBarBtn.command = 'workspaceLoader.openManager';
        managerStatusBarBtn.text = '$(gear) Workspace Manager';
        managerStatusBarBtn.tooltip = 'Open Workspace Manager to setup configurations or copy paths';
        managerStatusBarBtn.show();

        output.info('Status bar items are registered and visible.');

        context.subscriptions.push(
            loadDisposable,
            managerDisposable,
            switchDisposable,
            saveCurrentWorkspaceDisposable,
            quickCreateWorkspaceDisposable,
            viewProviderDisposable,
            switcherStatusBarBtn,
            managerStatusBarBtn
        );
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        output.error(`Activation failed: ${message}`);
        void vscode.window.showErrorMessage(`Antigravity Workspace Loader failed to activate: ${message}`);
        throw error;
    }
}

export function deactivate() {}

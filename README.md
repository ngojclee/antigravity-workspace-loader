# Antigravity Workspace Code-Loader

Loads folders from `.code-workspace` files without breaking git worktrees, and provides a powerful Workspace Manager for interfacing with Antigravity Agent Manager.

## Features
- **Load workspaces via Context Menu**: Right-click any `.code-workspace` to quickly update the current VSCode folders.
- **Workspace Manager**: Visual management tool to configure sub-workspaces and default directories.
- **Quick Switcher (Status Bar)**: Rapidly switch between your saved workspaces via a responsive VSCode bottom status bar menu.

## Antigravity Workspace Manager Usage
The Workspace Manager is designed for cases where you have a large root project containing multiple domains/sub-workspaces, and you need to assign them distinctively into Antigravity Agent Manager.

1. **Open the Manager**: Run `Antigravity Workspace: Open Manager` from the Command Palette (`Ctrl+Shift+P`).
2. **Set Main Project Root**: Choose the root of your large repository. This creates a `.workspaces` directory to store configurations.
3. **Configure Default Dirs**: Go to Extension Settings (`antigravityWorkspace.defaultAttachedDirectories`) to list folder names you always want attached (e.g. `docs`, `config`).
4. **Create Workspaces**: In the panel, click "Create New Workspace". Select a sub-folder. The extension unites the sub-folder and default directories into a `.code-workspace` configuration dynamically.
5. **Switch Workspaces On-The-Fly**: Look for the **`$(repo) Switch Workspace`** button in the VSCode status bar at the bottom. Clicking it will display a Quick Pick menu of all your saved workspaces. 
6. **Copy Paths for Antigravity**: Click `Copy Paths` in the manager to grab a newline-separated list of directories for the given workspace, which can be easily pasted into the Antigravity Agent Manager configuration.

### Settings
- `antigravityWorkspace.mainProjectRoot`: The primary project path.
- `antigravityWorkspace.defaultAttachedDirectories`: Folder paths appended by default (relative to main project root).

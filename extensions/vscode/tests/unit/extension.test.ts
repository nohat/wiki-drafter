import * as vscode from "vscode";
import { activate, deactivate } from "../../src/extension";

// Create a minimal ExtensionContext mock
/**
 *
 */
function createContext(): vscode.ExtensionContext {
  const subscriptions: { dispose(): any }[] = [];
  return {
    subscriptions,
    workspaceState: {} as any,
    globalState: {} as any,
    secrets: {} as any,
    extensionPath: "/test/path",
    asAbsolutePath: (p: string) => p,
    storagePath: undefined,
    globalStoragePath: "/tmp",
    logPath: "/tmp",
    extensionUri: { fsPath: "/test/path" } as any,
    environmentVariableCollection: {} as any,
    extensionMode: 1 as any,
    extension: {} as any,
    storageUri: undefined,
    globalStorageUri: { fsPath: "/tmp" } as any,
    logUri: { fsPath: "/tmp" } as any,
  } as unknown as vscode.ExtensionContext;
}

describe("extension activate/deactivate", () => {
  let ctx: vscode.ExtensionContext;

  beforeEach(() => {
    ctx = createContext();
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    // Ensure VS Code APIs exist
    (vscode.window as any).registerWebviewViewProvider = jest.fn();
    (vscode.workspace as any).onDidChangeTextDocument = jest.fn();
    (vscode.window as any).onDidChangeActiveTextEditor = jest.fn();
    (vscode.commands as any).registerCommand = jest.fn();
  });

  it("activates and registers webviews, commands, and listeners", () => {
    activate(ctx);

    // Webviews registered
    expect((vscode.window as any).registerWebviewViewProvider).toHaveBeenCalledTimes(2);

    // Commands registered (at least a few command IDs)
    expect((vscode.commands as any).registerCommand).toHaveBeenCalled();

    // Listeners registered
    expect((vscode.workspace as any).onDidChangeTextDocument).toHaveBeenCalled();
    expect((vscode.window as any).onDidChangeActiveTextEditor).toHaveBeenCalled();

    // Subscriptions captured
    expect(ctx.subscriptions.length).toBeGreaterThan(0);
  });

  it("deactivates without error", () => {
    expect(() => deactivate()).not.toThrow();
  });
});

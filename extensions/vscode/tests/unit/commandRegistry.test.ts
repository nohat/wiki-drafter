import * as vscode from "vscode";
import { registerCommands } from "../../src/commands/commandRegistry";
import { PreviewProvider } from "../../src/webviews/preview/previewProvider";
import { ClaimsGridProvider } from "../../src/webviews/claims-grid/claimsGridProvider";

describe("commandRegistry", () => {
  let ctx: vscode.ExtensionContext;
  let preview: PreviewProvider;
  let claims: ClaimsGridProvider;

  beforeEach(() => {
    const subscriptions: { dispose(): any }[] = [];
    ctx = { subscriptions } as any;
    preview = new PreviewProvider({ fsPath: "/test" } as any);
    claims = new ClaimsGridProvider({ fsPath: "/test" } as any);

    // Mocks for VS Code
    (vscode.window as any).activeTextEditor = undefined;
    (vscode.window as any).showInformationMessage = jest.fn();
    (vscode.window as any).showWarningMessage = jest.fn().mockResolvedValue("No");
    (vscode.window as any).createQuickPick = jest.fn(() => ({
      placeholder: "",
      canSelectMany: false,
      items: [],
      onDidChangeValue: jest.fn(),
      onDidAccept: jest.fn(),
      selectedItems: [],
      show: jest.fn(),
      hide: jest.fn(),
    }));
    (vscode.commands as any).executeCommand = jest.fn();
    (vscode.commands as any).registerCommand = jest.fn(
      (_id: string, fn: (...args: any[]) => unknown) => ({ dispose: () => {} }),
    );
  });

  it("registers commands and stores disposables in context", () => {
    registerCommands(ctx, preview, claims);
    expect(ctx.subscriptions.length).toBeGreaterThan(0);
  });

  it("filterUnsupported triggers executeCommand to set filter", () => {
    registerCommands(ctx, preview, claims);
    const calls = (vscode.commands as any).registerCommand.mock.calls as any[];
    const entry = calls.find((c) => c[0] === "wiki-drafter.filterUnsupported");
    expect(entry).toBeTruthy();

    const handler = entry[1] as (...args: any[]) => unknown;
    handler();

    expect((vscode.commands as any).executeCommand).toHaveBeenCalledWith(
      "workbench.view.extension.wiki-drafter",
    );
    expect((vscode.commands as any).executeCommand).toHaveBeenCalledWith(
      "wiki-drafter.setClaimsFilter",
      { status: "unsupported" },
    );
  });
});

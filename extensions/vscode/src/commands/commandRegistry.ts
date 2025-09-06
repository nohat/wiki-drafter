import * as vscode from "vscode";
import type { PreviewProvider } from "../webviews/preview/previewProvider";
import type { ClaimsGridProvider } from "../webviews/claims-grid/claimsGridProvider";
/**
 * Register all Wiki-Drafter commands and internal message routing.
 * @param {vscode.ExtensionContext} context VS Code extension context used for subscriptions
 * @param {PreviewProvider} previewProvider Preview webview provider instance
 * @param {ClaimsGridProvider} claimsGridProvider Claims Grid webview provider instance
 * @returns {void}
 */
export const registerCommands = (
  context: vscode.ExtensionContext,
  previewProvider: PreviewProvider,
  claimsGridProvider: ClaimsGridProvider,
) => {
  // Insert Citation (;)
  context.subscriptions.push(
    vscode.commands.registerCommand("wiki-drafter.insertCitation", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== "wikitext") {
        return;
      }

      const position = editor.selection.active;
      const quickPick = vscode.window.createQuickPick();
      quickPick.placeholder = "Enter URL, DOI, or ISBN to cite...";
      quickPick.canSelectMany = false;

      quickPick.onDidChangeValue(async (value) => {
        if (value.length > 3) {
          // Mock citation suggestions - in real implementation, this would call Citoid
          quickPick.items = [
            {
              label: "$(book) Academic Source",
              description: "Journal article or book",
              detail: "High quality academic source",
            },
            {
              label: "$(globe) Web Source",
              description: "News article or website",
              detail: "General web source",
            },
          ];
        }
      });

      quickPick.onDidAccept(() => {
        const selected = quickPick.selectedItems[0];
        if (selected) {
          editor.edit((editBuilder) => {
            editBuilder.insert(position, '<ref name="example">Example citation</ref>');
          });
        }
        quickPick.hide();
      });

      quickPick.show();
    }),
  );

  // Accept All Low-Risk Autos (Cmd+.)
  context.subscriptions.push(
    vscode.commands.registerCommand("wiki-drafter.acceptAllAutos", () => {
      vscode.window.showInformationMessage("Accepting all low-risk automatic suggestions...");
      // Implementation would accept all pending low-risk suggestions
    }),
  );

  // Filter Unsupported Claims (Cmd+U)
  context.subscriptions.push(
    vscode.commands.registerCommand("wiki-drafter.filterUnsupported", () => {
      vscode.commands.executeCommand("workbench.view.extension.wiki-drafter");
      // Send filter command to claims grid
      vscode.commands.executeCommand("wiki-drafter.setClaimsFilter", { status: "unsupported" });
    }),
  );

  // Archive Pending Links (A)
  context.subscriptions.push(
    vscode.commands.registerCommand("wiki-drafter.archivePendingLinks", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== "wikitext") {
        return;
      }

      vscode.window.showInformationMessage("Archiving pending links...");
      // Implementation would find all external links and submit them for archiving
    }),
  );

  // Toggle Quote (Q)
  context.subscriptions.push(
    vscode.commands.registerCommand("wiki-drafter.toggleQuote", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== "wikitext") {
        return;
      }

      const selection = editor.selection;
      const text = editor.document.getText(selection);

      editor.edit((editBuilder) => {
        if (text.startsWith("{{quote|")) {
          // Remove quote template
          const unquoted = text.replace(/^\{\{quote\|(.+)\}\}$/, "$1");
          editBuilder.replace(selection, unquoted);
        } else {
          // Add quote template
          editBuilder.replace(selection, `{{quote|${text}}}`);
        }
      });
    }),
  );

  // Fix "As of" Phrasing (F)
  context.subscriptions.push(
    vscode.commands.registerCommand("wiki-drafter.fixAsOf", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== "wikitext") {
        return;
      }

      // Implementation would detect and fix "as of" phrasing issues
      vscode.window.showInformationMessage('Checking "as of" phrasing...');
    }),
  );

  // BLP Focus Mode (Shift+B)
  context.subscriptions.push(
    vscode.commands.registerCommand("wiki-drafter.blpFocus", () => {
      vscode.commands.executeCommand("workbench.view.extension.wiki-drafter");
      vscode.commands.executeCommand("wiki-drafter.setClaimsFilter", { type: "BLP" });
      vscode.window.showInformationMessage("BLP Focus Mode activated");
    }),
  );

  // Publish to Sandbox (Cmd+Enter)
  context.subscriptions.push(
    vscode.commands.registerCommand("wiki-drafter.publishToSandbox", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== "wikitext") {
        return;
      }

      const result = await vscode.window.showWarningMessage(
        "Publish to Wikipedia sandbox?",
        { modal: true },
        "Yes",
        "No",
      );

      if (result === "Yes") {
        vscode.window.showInformationMessage("Publishing to sandbox...");
        // Implementation would publish via MediaWiki API
      }
    }),
  );

  // Export Patch (Alt+Cmd+Enter)
  context.subscriptions.push(
    vscode.commands.registerCommand("wiki-drafter.exportPatch", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== "wikitext") {
        return;
      }

      vscode.window.showInformationMessage("Exporting patch...");
      // Implementation would generate and show diff
    }),
  );

  // Open Preview
  context.subscriptions.push(
    vscode.commands.registerCommand("wiki-drafter.openPreview", () => {
      vscode.commands.executeCommand("workbench.view.extension.wiki-drafter");
    }),
  );

  // Open Claims Grid
  context.subscriptions.push(
    vscode.commands.registerCommand("wiki-drafter.openClaimsGrid", () => {
      vscode.commands.executeCommand("workbench.view.extension.wiki-drafter");
    }),
  );

  // Internal commands for webview communication
  context.subscriptions.push(
    vscode.commands.registerCommand("wiki-drafter.highlightClaim", (claimId: string) => {
      claimsGridProvider.highlightClaim(claimId);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("wiki-drafter.setClaimsFilter", (filter: any) => {
      // This would be handled by the claims grid provider
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("wiki-drafter.highlightInPreview", (claimId: string) => {
      // This would highlight the claim in the preview webview
    }),
  );
};

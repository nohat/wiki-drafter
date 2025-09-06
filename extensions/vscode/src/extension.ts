import * as vscode from 'vscode';
import { WikitextDiagnostics } from './editor/diagnostics';
import { PreviewProvider } from './webviews/preview/previewProvider';
import { ClaimsGridProvider } from './webviews/claims-grid/claimsGridProvider';
import { registerCommands } from './commands/commandRegistry';

export function activate(context: vscode.ExtensionContext) {
    console.log('Wiki-Drafter extension activated');

    // Initialize diagnostics
    const diagnostics = new WikitextDiagnostics();
    context.subscriptions.push(diagnostics);

    // Register webview providers
    const previewProvider = new PreviewProvider(context.extensionUri);
    const claimsGridProvider = new ClaimsGridProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('wiki-drafter.preview', previewProvider),
        vscode.window.registerWebviewViewProvider('wiki-drafter.claimsGrid', claimsGridProvider)
    );

    // Register commands
    registerCommands(context, previewProvider, claimsGridProvider);

    // Set up event listeners
    vscode.workspace.onDidChangeTextDocument(event => {
        if (event.document.languageId === 'wikitext') {
            diagnostics.updateDiagnostics(event.document);
            previewProvider.updatePreview(event.document);
            claimsGridProvider.updateClaims(event.document);
        }
    });

    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && editor.document.languageId === 'wikitext') {
            diagnostics.updateDiagnostics(editor.document);
            previewProvider.updatePreview(editor.document);
            claimsGridProvider.updateClaims(editor.document);
        }
    });
}

export function deactivate() {
    console.log('Wiki-Drafter extension deactivated');
}
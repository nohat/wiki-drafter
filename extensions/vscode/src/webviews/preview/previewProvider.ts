import * as vscode from 'vscode';
import axios from 'axios';

export class PreviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'wiki-drafter.preview';
    
    private _view?: vscode.WebviewView;
    private _currentDocument?: vscode.TextDocument;
    private _debounceTimer?: NodeJS.Timeout;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'footnoteClicked':
                    this._handleFootnoteClick(data.claimId);
                    break;
                case 'ready':
                    console.log('PreviewProvider: Webview ready, current document:', this._currentDocument?.fileName);
                    // Webview is ready, render current content if available
                    if (this._currentDocument) {
                        console.log('PreviewProvider: Rendering current document on webview ready');
                        this.updatePreview(this._currentDocument);
                    } else {
                        // Try to get the active document
                        const activeEditor = vscode.window.activeTextEditor;
                        if (activeEditor && activeEditor.document.languageId === 'wikitext') {
                            console.log('PreviewProvider: Found active wikitext document, rendering');
                            this.updatePreview(activeEditor.document);
                        }
                    }
                    break;
            }
        });
    }

    public updatePreview(document: vscode.TextDocument) {
        this._currentDocument = document;
        
        if (!this._view) {
            return;
        }

        // Debounce updates to avoid excessive API calls
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }

        this._debounceTimer = setTimeout(async () => {
            await this._renderPreview(document);
        }, 200);
    }

    private async _renderPreview(document: vscode.TextDocument) {
        if (!this._view) {
            console.log('PreviewProvider: No view available for rendering');
            return;
        }

        console.log('PreviewProvider: Starting render for document:', document.fileName);

        try {
            const config = vscode.workspace.getConfiguration('wiki-drafter');
            const companionEndpoint = config.get<string>('companionService.endpoint', 'http://localhost:8000');
            
            const wikitext = document.getText();
            console.log('PreviewProvider: Attempting to render via companion service:', companionEndpoint);
            
            // Determine current section if possible
            const cursorPosition = vscode.window.activeTextEditor?.selection.active;
            const currentSection = this._getCurrentSection(wikitext, cursorPosition);

            const response = await axios.post(`${companionEndpoint}/render`, {
                wikitext: wikitext,
                section: currentSection
            }, { timeout: 5000 });

            const { html, dsr_map } = response.data;

            console.log('PreviewProvider: Companion service rendered successfully');
            // Send rendered HTML to webview
            this._view.webview.postMessage({
                type: 'updatePreview',
                html: html,
                dsrMap: dsr_map
            });

        } catch (error) {
            console.error('PreviewProvider: Failed to render via companion service:', error);
            
            // Fallback to basic HTML rendering
            const basicHtml = this._getBasicHtmlPreview(document.getText());
            console.log('PreviewProvider: Using fallback renderer, generated HTML length:', basicHtml.length);
            
            this._view.webview.postMessage({
                type: 'updatePreview',
                html: basicHtml,
                dsrMap: null
            });
        }
    }

    private _getCurrentSection(wikitext: string, position?: vscode.Position): string | undefined {
        if (!position) {
            return undefined;
        }

        const lines = wikitext.split('\n');
        let currentSection = '';
        
        for (let i = 0; i <= position.line && i < lines.length; i++) {
            const line = lines[i];
            const sectionMatch = line.match(/^(={2,6})\s*(.+?)\s*\1/);
            if (sectionMatch) {
                currentSection = sectionMatch[2].trim();
            }
        }
        
        return currentSection || undefined;
    }

    private _getBasicHtmlPreview(wikitext: string): string {
        // Very basic wikitext to HTML conversion for fallback
        let html = wikitext
            // Convert line breaks to HTML
            .replace(/\n\n+/g, '</p><p>')
            .replace(/\n/g, '<br>')
            // Bold and italic
            .replace(/'''(.*?)'''/g, '<strong>$1</strong>')
            .replace(/''(.*?)''/g, '<em>$1</em>')
            // Wikilinks: [[Article]] or [[Article|Display text]]
            .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '<a href="#" class="wikilink">$2</a>')
            .replace(/\[\[([^\]]+)\]\]/g, '<a href="#" class="wikilink">$1</a>')
            // External links: [URL Display text]
            .replace(/\[([^\s]+)\s+([^\]]+)\]/g, '<a href="$1" class="external">$2</a>')
            // Headers: == Title ==
            .replace(/^(={2,6})\s*(.+?)\s*\1$/gm, (match, level, title) => {
                const headerLevel = level.length;
                return `<h${headerLevel}>${title.trim()}</h${headerLevel}>`;
            })
            // Simple ref tags: <ref name="name">content</ref>
            .replace(/<ref[^>]*name\s*=\s*["']([^"']+)["'][^>]*>(.*?)<\/ref>/g, '<sup class="reference"><a href="#ref-$1">[$1]</a></sup>')
            .replace(/<ref[^>]*>(.*?)<\/ref>/g, '<sup class="reference">[ref]</sup>')
            // Infobox placeholder
            .replace(/\{\{[Ii]nfobox[^}]*\}\}/g, '<div class="infobox-placeholder">[Infobox]</div>');

        // Wrap in paragraphs
        html = `<p>${html}</p>`;
        
        return `<div class="wiki-content">${html}</div>`;
    }

    private _handleFootnoteClick(claimId: string) {
        // Communicate with Claims Grid to highlight the relevant claim
        vscode.commands.executeCommand('wiki-drafter.highlightClaim', claimId);
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'preview.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'preview.css'));

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUri}" rel="stylesheet">
                <title>Wiki Preview</title>
            </head>
            <body>
                <div id="loading">Loading preview...</div>
                <div id="content" style="display: none;"></div>
                <script src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}
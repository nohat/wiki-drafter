import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

import type { Claim, ClaimsDocument } from "../../types";

export class ClaimsGridProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "wiki-drafter.claimsGrid";

  private _view?: vscode.WebviewView;
  private _currentDocument?: vscode.TextDocument;
  private _claims: Claim[] = [];
  private _currentRev = 0;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage((data) => {
      switch (data.type) {
        case "claimSelected":
          this._handleClaimSelection(data.claimId);
          break;
        case "filterChanged":
          this._handleFilterChange(data.filter);
          break;
        case "ready": {
          // If we already have a document context, send claims immediately.
          if (this._currentDocument) {
            this._sendClaimsToWebview();
            break;
          }
          // Otherwise try to initialize from the active editor so the grid
          // isn't empty on first open.
          const activeEditor = vscode.window.activeTextEditor;
          if (activeEditor && activeEditor.document.languageId === "wikitext") {
            this.updateClaims(activeEditor.document);
          } else {
            this._sendClaimsToWebview();
          }
          break;
        }
      }
    });
  }

  public updateClaims(document: vscode.TextDocument) {
    console.log("ClaimsGridProvider: updateClaims called for document:", document.uri.fsPath);
    this._currentDocument = document;
    this._currentRev++;

    // Load existing claims file or extract new claims
    this._loadOrExtractClaims(document);

    console.log("ClaimsGridProvider: Claims extracted/loaded, count:", this._claims.length);
    if (this._view) {
      console.log("ClaimsGridProvider: Sending claims to webview");
      this._sendClaimsToWebview();
    } else {
      console.log("ClaimsGridProvider: No webview available to send claims to");
    }
  }

  public highlightClaim(claimId: string) {
    const claim = this._claims.find((c) => c.id === claimId);
    if (claim && vscode.window.activeTextEditor) {
      // Prefer the current document if available; otherwise, fall back to simple positions
      let startPos: vscode.Position;
      let endPos: vscode.Position;

      if (this._currentDocument) {
        startPos = this._currentDocument.positionAt(claim.start);
        endPos = this._currentDocument.positionAt(claim.end);
      } else {
        startPos = new vscode.Position(0, claim.start);
        endPos = new vscode.Position(0, claim.end);
      }

      const range = new vscode.Range(startPos, endPos);
      vscode.window.activeTextEditor.selection = new vscode.Selection(startPos, endPos);
      vscode.window.activeTextEditor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    }
  }

  private async _loadOrExtractClaims(document: vscode.TextDocument) {
    const claimsFilePath = this._getClaimsFilePath(document.uri);

    try {
      if (fs.existsSync(claimsFilePath)) {
        const claimsData = fs.readFileSync(claimsFilePath, "utf-8");
        const claimsDoc: ClaimsDocument = JSON.parse(claimsData);

        // Update claims with current document state
        this._claims = claimsDoc.claims;
        this._adjustClaimOffsets(document);
      } else {
        // Extract claims from document
        await this._extractClaims(document);
      }
    } catch (error) {
      console.error("Failed to load claims:", error);
      await this._extractClaims(document);
    }
  }

  private async _extractClaims(document: vscode.TextDocument) {
    console.log("ClaimsGridProvider: Extracting claims from document");
    // Basic claim extraction - in real implementation this would use LLM
    const text = document.getText();
    console.log("ClaimsGridProvider: Document text length:", text.length);
    const sentences = this._extractSentences(text);
    console.log("ClaimsGridProvider: Extracted sentences count:", sentences.length);

    this._claims = sentences.map((sentence, index) => ({
      id: `c_${index + 1}`,
      section: this._getSectionForOffset(text, sentence.start),
      start: sentence.start,
      end: sentence.end,
      text: sentence.text,
      type: this._classifyClaimType(sentence.text),
      risk: this._assessRisk(sentence.text),
      requires_inline: this._requiresInlineCitation(sentence.text),
      existing_refs: this._findExistingRefs(text, sentence.start, sentence.end),
      status: "unsupported",
      sources: [],
    }));

    console.log("ClaimsGridProvider: Created claims count:", this._claims.length);
    // Save claims to file
    await this._saveClaimsFile(document.uri);
  }

  private _extractSentences(text: string): Array<{ text: string; start: number; end: number }> {
    const sentences = [];
    const sentenceRegex = /[.!?]+\s*/g;
    let lastEnd = 0;
    let match;

    while ((match = sentenceRegex.exec(text)) !== null) {
      const sentence = text.substring(lastEnd, match.index + match[0].length).trim();
      if (sentence.length > 20) {
        // Filter out very short sentences
        sentences.push({
          text: sentence,
          start: lastEnd,
          end: match.index + match[0].length,
        });
      }
      lastEnd = match.index + match[0].length;
    }

    return sentences;
  }

  private _getSectionForOffset(text: string, offset: number): string {
    const beforeOffset = text.substring(0, offset);
    const sections = beforeOffset.match(/^(={2,6})\s*(.+?)\s*\1$/gm);

    if (sections && sections.length > 0) {
      const lastSection = sections[sections.length - 1];
      const match = lastSection.match(/^={2,6}\s*(.+?)\s*={2,6}$/);
      return match ? match[1].trim() : "Introduction";
    }

    return "Introduction";
  }

  private _classifyClaimType(text: string): Claim["type"] {
    const lowerText = text.toLowerCase();

    if (lowerText.includes("born") || lowerText.includes("died") || lowerText.includes("married")) {
      return "BLP";
    }
    if (lowerText.match(/\d{4}|\d+%|\$\d+|million|billion/)) {
      return "statistic";
    }
    if (lowerText.includes('"') || lowerText.includes("'")) {
      return "quote";
    }
    if (
      lowerText.includes("controversial") ||
      lowerText.includes("alleged") ||
      lowerText.includes("disputed")
    ) {
      return "contentious";
    }

    return "general";
  }

  private _assessRisk(text: string): Claim["risk"] {
    const lowerText = text.toLowerCase();

    if (
      lowerText.includes("alleged") ||
      lowerText.includes("controversial") ||
      lowerText.includes("disputed")
    ) {
      return "high";
    }
    if (lowerText.match(/\d{4}|\d+%/) || lowerText.includes("according to")) {
      return "medium";
    }

    return "low";
  }

  private _requiresInlineCitation(text: string): boolean {
    const type = this._classifyClaimType(text);
    return type === "BLP" || type === "quote" || type === "statistic" || type === "contentious";
  }

  private _findExistingRefs(text: string, start: number, end: number): string[] {
    const claimText = text.substring(start, end);
    const refMatches = claimText.match(/<ref[^>]*name\s*=\s*["']([^"']+)["'][^>]*>/g);

    if (refMatches) {
      return refMatches
        .map((match) => {
          const nameMatch = match.match(/name\s*=\s*["']([^"']+)["']/);
          return nameMatch ? nameMatch[1] : "";
        })
        .filter((name) => name);
    }

    return [];
  }

  private _adjustClaimOffsets(document: vscode.TextDocument) {
    // In a real implementation, this would use an interval tree to efficiently
    // adjust claim offsets when the document changes
    // For now, we'll keep it simple and just validate ranges
    const text = document.getText();

    this._claims = this._claims.filter((claim) => {
      return claim.start >= 0 && claim.end <= text.length && claim.start < claim.end;
    });
  }

  private async _saveClaimsFile(documentUri: vscode.Uri) {
    const claimsFilePath = this._getClaimsFilePath(documentUri);
    const claimsDoc: ClaimsDocument = {
      article: path.basename(documentUri.fsPath, path.extname(documentUri.fsPath)),
      rev: this._currentRev,
      claims: this._claims,
    };

    try {
      fs.writeFileSync(claimsFilePath, JSON.stringify(claimsDoc, null, 2));
    } catch (error) {
      console.error("Failed to save claims file:", error);
    }
  }

  private _getClaimsFilePath(documentUri: vscode.Uri): string {
    const dir = path.dirname(documentUri.fsPath);
    const basename = path.basename(documentUri.fsPath, path.extname(documentUri.fsPath));
    // If the target directory doesn't exist (e.g., unit tests with synthetic paths),
    // fallback to the system temp directory to avoid ENOENT.
    if (!fs.existsSync(dir)) {
      return path.join(os.tmpdir(), `${basename}.claims.json`);
    }
    return path.join(dir, `${basename}.claims.json`);
  }

  private _sendClaimsToWebview() {
    if (this._view) {
      console.log(
        "ClaimsGridProvider: Posting message to webview with claims count:",
        this._claims.length,
      );
      this._view.webview.postMessage({
        type: "updateClaims",
        claims: this._claims,
      });
    }
  }

  private _handleClaimSelection(claimId: string) {
    this.highlightClaim(claimId);

    // Also notify preview to highlight
    vscode.commands.executeCommand("wiki-drafter.highlightInPreview", claimId);
  }

  private _handleFilterChange(filter: any) {
    // Apply filter to claims and update view
    const filteredClaims = this._claims.filter((claim) => {
      if (filter.status && filter.status !== "all" && claim.status !== filter.status) {
        return false;
      }
      if (filter.risk && filter.risk !== "all" && claim.risk !== filter.risk) {
        return false;
      }
      if (filter.type && filter.type !== "all" && claim.type !== filter.type) {
        return false;
      }
      if (filter.section && filter.section !== "all" && claim.section !== filter.section) {
        return false;
      }
      return true;
    });

    this._view?.webview.postMessage({
      type: "updateClaims",
      claims: filteredClaims,
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "claims-grid.js"),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "claims-grid.css"),
    );

    return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUri}" rel="stylesheet">
                <title>Claims Grid</title>
            </head>
            <body>
                <div class="filters">
                    <select id="statusFilter">
                        <option value="all">All Status</option>
                        <option value="unsupported">Unsupported</option>
                        <option value="supported">Supported</option>
                        <option value="pending">Pending</option>
                    </select>
                    <select id="riskFilter">
                        <option value="all">All Risk</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                    <select id="typeFilter">
                        <option value="all">All Types</option>
                        <option value="BLP">BLP</option>
                        <option value="quote">Quote</option>
                        <option value="statistic">Statistic</option>
                        <option value="contentious">Contentious</option>
                        <option value="general">General</option>
                    </select>
                </div>
                <div id="claims-container"></div>
                <script src="${scriptUri}"></script>
            </body>
            </html>`;
  }
}

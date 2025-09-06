import * as vscode from 'vscode';

export class WikitextDiagnostics {
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('wiki-drafter');
    }

    public updateDiagnostics(document: vscode.TextDocument) {
        if (document.languageId !== 'wikitext') {
            return;
        }

        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();

        // Check for unclosed tags
        this.checkUnclosedTags(text, diagnostics, document);
        
        // Check for refname collisions
        this.checkRefnameCollisions(text, diagnostics, document);
        
        // Check for mixed cite styles
        this.checkMixedCiteStyles(text, diagnostics, document);
        
        // Check for orphaned refs
        this.checkOrphanedRefs(text, diagnostics, document);

        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    private checkUnclosedTags(text: string, diagnostics: vscode.Diagnostic[], document: vscode.TextDocument) {
        const tagRegex = /<(\/?)(ref|gallery|nowiki|pre|code|math)([^>]*)>/g;
        const openTags: Array<{ name: string, pos: number }> = [];
        let match;

        while ((match = tagRegex.exec(text)) !== null) {
            const isClosing = match[1] === '/';
            const tagName = match[2];
            const position = document.positionAt(match.index);

            if (isClosing) {
                const lastOpen = openTags.findIndex(tag => tag.name === tagName);
                if (lastOpen !== -1) {
                    openTags.splice(lastOpen, 1);
                } else {
                    // Closing tag without opening
                    const diagnostic = new vscode.Diagnostic(
                        new vscode.Range(position, document.positionAt(match.index + match[0].length)),
                        `Closing tag </${tagName}> without matching opening tag`,
                        vscode.DiagnosticSeverity.Error
                    );
                    diagnostics.push(diagnostic);
                }
            } else if (!match[3].includes('/')) {
                // Self-closing tags don't need to be tracked
                openTags.push({ name: tagName, pos: match.index });
            }
        }

        // Report unclosed tags
        openTags.forEach(tag => {
            const position = document.positionAt(tag.pos);
            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(position, position.translate(0, tag.name.length + 2)),
                `Unclosed <${tag.name}> tag`,
                vscode.DiagnosticSeverity.Error
            );
            diagnostics.push(diagnostic);
        });
    }

    private checkRefnameCollisions(text: string, diagnostics: vscode.Diagnostic[], document: vscode.TextDocument) {
        const refnameRegex = /<ref\s+name\s*=\s*["']([^"']+)["'][^>]*>/g;
        const refnames = new Map<string, number[]>();
        let match;

        while ((match = refnameRegex.exec(text)) !== null) {
            const refname = match[1];
            if (!refnames.has(refname)) {
                refnames.set(refname, []);
            }
            refnames.get(refname)!.push(match.index);
        }

        refnames.forEach((positions, refname) => {
            if (positions.length > 1) {
                positions.forEach(pos => {
                    const position = document.positionAt(pos);
                    const diagnostic = new vscode.Diagnostic(
                        new vscode.Range(position, position.translate(0, 20)), // approximate length
                        `Duplicate refname: ${refname}`,
                        vscode.DiagnosticSeverity.Warning
                    );
                    diagnostics.push(diagnostic);
                });
            }
        });
    }

    private checkMixedCiteStyles(text: string, diagnostics: vscode.Diagnostic[], document: vscode.TextDocument) {
        const namedRefRegex = /<ref\s+name\s*=/g;
        const inlineRefRegex = /<ref(?!\s+name)[^>]*>[^<]+<\/ref>/g;
        
        const hasNamedRefs = namedRefRegex.test(text);
        const hasInlineRefs = inlineRefRegex.test(text);

        if (hasNamedRefs && hasInlineRefs) {
            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 0),
                'Mixed citation styles detected. Consider using consistent named references.',
                vscode.DiagnosticSeverity.Information
            );
            diagnostics.push(diagnostic);
        }
    }

    private checkOrphanedRefs(text: string, diagnostics: vscode.Diagnostic[], document: vscode.TextDocument) {
        const reflistRegex = /\{\{reflist\}\}/i;
        const referencesRegex = /<references\s*\/?>|<references[^>]*>.*?<\/references>/is;
        const refRegex = /<ref[^>]*>/g;

        const hasRefs = refRegex.test(text);
        const hasReflist = reflistRegex.test(text) || referencesRegex.test(text);

        if (hasRefs && !hasReflist) {
            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(document.lineCount - 1, 0, document.lineCount - 1, 0),
                'References found but no {{reflist}} or <references/> section',
                vscode.DiagnosticSeverity.Warning
            );
            diagnostic.code = 'missing-reflist';
            diagnostics.push(diagnostic);
        }
    }

    dispose() {
        this.diagnosticCollection.dispose();
    }
}
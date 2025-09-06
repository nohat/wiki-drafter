// Manual Jest mock for the 'vscode' module
// Uses the global.vscode set in tests/setup.ts if available, otherwise provides a minimal stub

const defaultMock = {
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn(),
  },
  window: {
    registerWebviewViewProvider: jest.fn(),
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    activeTextEditor: undefined,
    onDidChangeActiveTextEditor: jest.fn(),
    createWebviewPanel: jest.fn(() => ({
      webview: { html: "", onDidReceiveMessage: jest.fn(), postMessage: jest.fn() },
    })),
  },
  workspace: {
    getConfiguration: jest.fn(() => ({ get: jest.fn() })),
    onDidChangeTextDocument: jest.fn(),
  },
  Uri: {
    file: jest.fn((p) => ({ fsPath: p })),
    joinPath: jest.fn((...parts) => ({ fsPath: parts.join("/") })),
  },
  ViewColumn: { One: 1, Two: 2, Three: 3 },
  TextEditorRevealType: { InCenter: 1 },
  Range: jest.fn(),
  Position: jest.fn(),
  Selection: jest.fn(),
  WebviewViewProvider: class {},
};

module.exports = global && global.vscode ? global.vscode : defaultMock;

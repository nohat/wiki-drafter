/**
 * Jest setup file for VS Code extension tests
 */

// Mock VS Code API
const vscode = {
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
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      // Return the provided default value by default
      get: jest.fn((key: string, defaultValue?: any) => defaultValue),
    })),
    onDidChangeTextDocument: jest.fn(),
  },
  languages: {
    createDiagnosticCollection: jest.fn(() => ({
      set: jest.fn(),
      clear: jest.fn(),
      delete: jest.fn(),
      dispose: jest.fn(),
      name: "wiki-drafter",
    })),
  },
  Uri: {
    file: jest.fn(),
    joinPath: jest.fn(),
  },
  ViewColumn: {
    One: 1,
    Two: 2,
    Three: 3,
  },
  TextEditorRevealType: {
    InCenter: 1,
  },
  Range: jest.fn(),
  Position: jest.fn(),
  Selection: jest.fn(),
};

// Make vscode API available globally
// Provide a default activeTextEditor with revealRange if not set by a test
if (!(vscode as any).window || !(vscode as any).window.activeTextEditor) {
  (vscode as any).window = (vscode as any).window || {};
  (vscode as any).window.activeTextEditor = {
    selection: {},
    revealRange: jest.fn(),
  };
}

(global as any).vscode = vscode;

// Mock axios for HTTP requests
jest.mock("axios", () => ({
  post: jest.fn(),
  get: jest.fn(),
  create: jest.fn(() => ({
    post: jest.fn(),
    get: jest.fn(),
  })),
}));

export default vscode;

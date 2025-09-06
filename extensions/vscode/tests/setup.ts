/**
 * Jest setup file for VS Code extension tests
 */

// Mock VS Code API
const vscode = {
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn()
  },
  window: {
    registerWebviewViewProvider: jest.fn(),
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    activeTextEditor: undefined,
    onDidChangeActiveTextEditor: jest.fn()
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn()
    })),
    onDidChangeTextDocument: jest.fn()
  },
  Uri: {
    file: jest.fn(),
    joinPath: jest.fn()
  },
  ViewColumn: {
    One: 1,
    Two: 2,
    Three: 3
  },
  TextEditorRevealType: {
    InCenter: 1
  },
  Range: jest.fn(),
  Position: jest.fn(),
  Selection: jest.fn()
};

// Make vscode API available globally
(global as any).vscode = vscode;

// Mock axios for HTTP requests
jest.mock('axios', () => ({
  post: jest.fn(),
  get: jest.fn(),
  create: jest.fn(() => ({
    post: jest.fn(),
    get: jest.fn()
  }))
}));

export default vscode;
/**
 * Unit tests for ClaimsGridProvider
 */

import { ClaimsGridProvider } from "../../src/webviews/claims-grid/claimsGridProvider";
import * as vscode from "vscode";

describe("ClaimsGridProvider", () => {
  let claimsGridProvider: ClaimsGridProvider;
  let mockExtensionUri: vscode.Uri;
  let mockWebviewView: any;
  let mockDocument: any;

  beforeEach(() => {
    mockExtensionUri = { fsPath: "/test/path" } as vscode.Uri;
    claimsGridProvider = new ClaimsGridProvider(mockExtensionUri);

    mockWebviewView = {
      webview: {
        options: {},
        html: "",
        postMessage: jest.fn(),
        asWebviewUri: jest.fn(),
        onDidReceiveMessage: jest.fn(),
      },
    };

    mockDocument = {
      getText: jest.fn(
        () =>
          `Carolina del Príncipe is a scientist. She was born in 1985. Her research focuses on deforestation.`,
      ),
      languageId: "wikitext",
      fileName: "test.wiki",
      uri: { fsPath: "/test/demo.wiki" },
      positionAt: jest.fn((offset: number) => ({ line: 0, character: offset })),
    };

    jest.clearAllMocks();
  });

  describe("resolveWebviewView", () => {
    it("should initialize webview with claims grid HTML", () => {
      claimsGridProvider.resolveWebviewView(mockWebviewView, { state: undefined }, {} as any);

      expect(mockWebviewView.webview.options).toEqual({
        enableScripts: true,
        localResourceRoots: [mockExtensionUri],
      });
      expect(mockWebviewView.webview.html).toContain("Claims Grid");
      expect(mockWebviewView.webview.html).toContain("statusFilter");
    });
  });

  describe("updateClaims", () => {
    beforeEach(() => {
      claimsGridProvider.resolveWebviewView(mockWebviewView, { state: undefined }, {} as any);
    });

    it("should extract basic claims from document", async () => {
      await claimsGridProvider.updateClaims(mockDocument);

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        type: "updateClaims",
        claims: expect.arrayContaining([
          expect.objectContaining({
            id: expect.stringMatching(/^c_\d+$/),
            text: expect.stringContaining("scientist"),
            type: expect.any(String),
            risk: expect.any(String),
            status: "unsupported",
          }),
        ]),
      });
    });
  });

  describe("claim classification", () => {
    it("should classify BLP claims", () => {
      const provider = claimsGridProvider as any;
      const result = provider._classifyClaimType("She was born in 1985");
      expect(result).toBe("BLP");
    });

    it("should classify statistical claims", () => {
      const provider = claimsGridProvider as any;
      const result = provider._classifyClaimType("The population increased by 25% in 2023");
      expect(result).toBe("statistic");
    });

    it("should classify contentious claims", () => {
      const provider = claimsGridProvider as any;
      const result = provider._classifyClaimType("The controversial decision was disputed");
      expect(result).toBe("contentious");
    });

    it("should default to general claims", () => {
      const provider = claimsGridProvider as any;
      const result = provider._classifyClaimType("This is a normal statement");
      expect(result).toBe("general");
    });
  });

  describe("risk assessment", () => {
    it("should assess high risk for controversial content", () => {
      const provider = claimsGridProvider as any;
      const result = provider._assessRisk("The alleged criminal activity was disputed");
      expect(result).toBe("high");
    });

    it("should assess medium risk for statistics", () => {
      const provider = claimsGridProvider as any;
      const result = provider._assessRisk("The company reported 15% growth in 2023");
      expect(result).toBe("medium");
    });

    it("should assess low risk for general statements", () => {
      const provider = claimsGridProvider as any;
      const result = provider._assessRisk("She studied at university");
      expect(result).toBe("low");
    });
  });

  describe("highlightClaim", () => {
    it("should highlight claim in editor", () => {
      const mockEditor = {
        selection: {},
        revealRange: jest.fn(),
      };
      (vscode.window as any).activeTextEditor = mockEditor;

      // Mock claims
      (claimsGridProvider as any)._claims = [
        {
          id: "c_1",
          start: 0,
          end: 20,
          text: "Test claim",
        },
      ];

      claimsGridProvider.highlightClaim("c_1");

      expect(mockEditor.revealRange).toHaveBeenCalled();
    });
  });
});

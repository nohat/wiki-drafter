/**
 * Unit tests for PreviewProvider
 */

import { PreviewProvider } from '../../src/webviews/preview/previewProvider';
import * as vscode from 'vscode';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PreviewProvider', () => {
  let previewProvider: PreviewProvider;
  let mockExtensionUri: vscode.Uri;
  let mockWebviewView: any;
  let mockDocument: any;

  beforeEach(() => {
    mockExtensionUri = { fsPath: '/test/path' } as vscode.Uri;
    previewProvider = new PreviewProvider(mockExtensionUri);
    
    mockWebviewView = {
      webview: {
        options: {},
        html: '',
        postMessage: jest.fn(),
        asWebviewUri: jest.fn(),
        onDidReceiveMessage: jest.fn()
      }
    };

    mockDocument = {
      getText: jest.fn(() => "'''Test''' article with [[links]]"),
      languageId: 'wikitext',
      fileName: 'test.wiki'
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('resolveWebviewView', () => {
    it('should initialize webview with correct HTML', () => {
      previewProvider.resolveWebviewView(mockWebviewView, { state: undefined }, {} as any);

      expect(mockWebviewView.webview.options).toEqual({
        enableScripts: true,
        localResourceRoots: [mockExtensionUri]
      });
      expect(mockWebviewView.webview.html).toContain('Loading preview...');
    });

    it('should set up message handler', () => {
      previewProvider.resolveWebviewView(mockWebviewView, { state: undefined }, {} as any);
      
      expect(mockWebviewView.webview.onDidReceiveMessage).toHaveBeenCalled();
    });
  });

  describe('updatePreview', () => {
    beforeEach(() => {
      previewProvider.resolveWebviewView(mockWebviewView, { state: undefined }, {} as any);
    });

    it('should render preview with companion service', async () => {
      const mockResponse = {
        data: {
          html: '<p><strong>Test</strong> article</p>',
          dsr_map: {}
        }
      };
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      previewProvider.updatePreview(mockDocument);

      // Wait for debounced update
      await new Promise(resolve => setTimeout(resolve, 250));

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:8000/render',
        {
          wikitext: "'''Test''' article with [[links]]",
          section: undefined
        },
        { timeout: 5000 }
      );
    });

    it('should fallback to basic HTML when service fails', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Service unavailable'));

      previewProvider.updatePreview(mockDocument);

      // Wait for debounced update
      await new Promise(resolve => setTimeout(resolve, 250));

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        type: 'updatePreview',
        html: expect.stringContaining('<strong>Test</strong>'),
        dsrMap: null
      });
    });
  });

  describe('_getBasicHtmlPreview', () => {
    it('should convert basic wikitext to HTML', () => {
      const provider = previewProvider as any;
      const result = provider._getBasicHtmlPreview("'''Bold''' and ''italic''");
      
      expect(result).toContain('<strong>Bold</strong>');
      expect(result).toContain('<em>italic</em>');
      expect(result).toContain('class="wiki-content"');
    });

    it('should handle wikilinks', () => {
      const provider = previewProvider as any;
      const result = provider._getBasicHtmlPreview("[[Article|Display text]]");
      
      expect(result).toContain('class="wikilink"');
      expect(result).toContain('Display text');
    });

    it('should handle references', () => {
      const provider = previewProvider as any;
      const result = provider._getBasicHtmlPreview('<ref name="test">Citation</ref>');
      
      expect(result).toContain('class="reference"');
      expect(result).toContain('[test]');
    });
  });
});
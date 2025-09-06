# Wiki-Drafter

AI-first Wikipedia drafting with policy-aware automation. A VS Code extension with companion service that provides three synchronized panes (Wikitext, Live Preview, Claims Grid), policy-aware automation, link archiving, copyright violation safety, and continuous learning.

## Features

- **Three-Pane Interface**: Wikitext editor, live preview, and claims grid working in sync
- **Policy-Aware Automation**: Automatic detection and enforcement of Wikipedia policies (V/BLP/Inline/When-to-cite)
- **Claims Management**: Automatic extraction and classification of claims requiring citations
- **Citation Integration**: Citoid-powered citation normalization with stable refnames
- **Source Quality Scoring**: WP:RSP integration with reliability heuristics
- **Link Archiving**: Automatic Wayback Machine integration for external links
- **Copyright Violation Detection**: Built-in copyvio screening
- **Live Preview**: Real-time Parsoid rendering with cross-highlighting
- **Keyboard-First Workflow**: Optimized shortcuts for power editors

## Project Structure

```
wiki-drafter/
├── extensions/vscode/          # VS Code extension
│   ├── src/
│   │   ├── extension.ts        # Main extension entry point
│   │   ├── editor/             # Editor features (diagnostics, etc.)
│   │   ├── commands/           # Command implementations
│   │   └── webviews/           # Preview and Claims Grid webviews
│   ├── media/                  # Webview assets (CSS, JS)
│   └── package.json           # Extension manifest
├── services/local/             # Python companion service
│   ├── app.py                 # FastAPI main application
│   ├── routers/               # API route handlers
│   │   ├── render.py          # Parsoid integration
│   │   ├── citoid.py          # Citation normalization
│   │   ├── archive.py         # Wayback Machine integration
│   │   ├── copyvio.py         # Copyright violation detection
│   │   └── score.py           # Source quality scoring
│   ├── requirements.txt       # Python dependencies
│   ├── rsp_cache.json        # WP:RSP database cache
│   └── sources.json          # Normalized source storage
├── packages/shared/           # Shared types and schemas
├── examples/                  # Demo articles and test data
└── learn/                    # Learning artifacts (auto-generated)
```

## Quick Start

### Prerequisites

- **VS Code** or **Windsurf** (1.74.0+)
- **Python 3.8+** for companion service
- **Node.js 16+** and **npm** for extension development
- **Parsoid** (optional, for advanced preview features)
- **Citoid** (optional, for citation normalization)

### 1. Install VS Code Extension

```bash
cd extensions/vscode
npm install
npm run compile
```

Then install the extension by:
1. Opening VS Code
2. Going to Extensions view (Ctrl+Shift+X)
3. Click "..." menu → "Install from VSIX"
4. Select the generated `.vsix` file

### 2. Set Up Companion Service

```bash
cd services/local
pip install -r requirements.txt
python app.py
```

The service will start on `http://localhost:8000`. You can verify it's working by visiting the health check endpoint.

### 3. Configure Dependencies (Optional)

#### Parsoid Setup
For enhanced preview functionality, install and run Parsoid:

```bash
npm install -g parsoid
parsoid --config ./parsoid-config.yaml
```

#### Citoid Setup
For citation normalization:

```bash
npm install -g citoid
citoid
```

### 4. Try the Demo

1. Open the demo article: `examples/demo-article.wiki`
2. The extension should activate automatically for `.wiki` files
3. Open the Claims Grid view from the activity bar
4. Use keyboard shortcuts to interact with claims and citations

## Keyboard Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| `;` | Insert Citation | Quick citation insertion at cursor |
| `Cmd+.` | Accept All Autos | Accept all low-risk automatic suggestions |
| `Cmd+U` | Filter Unsupported | Filter to unsupported claims only |
| `A` | Archive Links | Archive all pending external links |
| `Q` | Toggle Quote | Toggle quote/blockquote formatting |
| `F` | Fix "As of" | Fix "as of" phrasing issues |
| `Shift+B` | BLP Focus | Focus on BLP (Biography of Living Persons) claims |
| `Cmd+Enter` | Publish to Sandbox | Publish current draft to Wikipedia sandbox |
| `Alt+Cmd+Enter` | Export Patch | Export changes as diff/patch |

## Configuration

Create `.wiki-draft.config.json` in your project root:

```json
{
  "cite_style": "named-refs",
  "as_of_year_threshold": 3,
  "llm": {
    "provider": "ollama",
    "model": "llama3.1:70b",
    "temperature": 0.1
  },
  "parsoid": {
    "endpoint": "http://localhost:8142"
  },
  "citoid": {
    "endpoint": "http://localhost:1970"
  },
  "policy": {
    "inline_for": ["BLP", "quote", "statistic", "contentious"]
  },
  "thresholds": {
    "source_quality_high_risk_min": 70,
    "copyvio_max_similarity": 0.35
  }
}
```

## Development

### VS Code Extension Development

```bash
cd extensions/vscode
npm run watch  # Watch mode for development
```

Press F5 in VS Code to launch Extension Development Host.

### Companion Service Development

```bash
cd services/local
# Install development dependencies
pip install -r requirements.txt uvicorn[standard]

# Run with auto-reload
uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

### Running Tests

```bash
# Extension tests
cd extensions/vscode
npm test

# Service tests
cd services/local
python -m pytest tests/
```

## API Documentation

The companion service provides these endpoints:

- `POST /render` - Parsoid wikitext rendering
- `POST /citoid` - Citation normalization via Citoid
- `POST /archive` - Link archiving via Wayback Machine
- `POST /copyvio` - Copyright violation detection
- `POST /score` - Source quality scoring using WP:RSP

Visit `http://localhost:8000/docs` when the service is running for interactive API documentation.

## Policy Integration

Wiki-Drafter enforces Wikipedia policies automatically:

- **Verifiability (V)**: All claims flagged until supported with reliable sources
- **BLP**: Biography of Living Persons claims require high-quality sources
- **Inline Citations**: Direct quotes, statistics, and contentious claims require inline cites
- **When to Cite**: Automatic detection of claim types requiring citation

## Learning System

The extension includes a learning loop that:
1. Captures user feedback on AI suggestions
2. Adjusts thresholds based on acceptance rates
3. Synthesizes new rules from patterns
4. Maintains an auto-updated "Operating Manual"

Learning artifacts are stored locally in the `learn/` directory.

## Troubleshooting

### Extension Not Activating
- Ensure file has `.wiki` or `.wikitext` extension
- Check VS Code language mode is set to "wikitext"

### Companion Service Connection Issues
- Verify service is running on `http://localhost:8000`
- Check VS Code settings for correct companion service endpoint
- Review service logs for errors

### Preview Not Loading
- Ensure Parsoid is installed and running (optional dependency)
- Extension falls back to basic preview if Parsoid unavailable
- Check network connectivity to Parsoid endpoint

### Citations Not Working
- Citoid service is optional - extension provides fallback citation parsing
- Verify Citoid endpoint in configuration
- Check that URLs/DOIs are valid and accessible

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test` and `python -m pytest`)
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Wikipedia community for policy guidance
- Wikimedia Foundation for Parsoid, Citoid, and other tools
- VS Code team for excellent extension APIs
- Contributors to reliable sources databases (WP:RSP)

## Roadmap

- [ ] Multi-user collaboration features
- [ ] Enhanced LLM integration for claim extraction
- [ ] Advanced template editing support
- [ ] Integration with Wikipedia's editing interface
- [ ] Mobile companion app
- [ ] Advanced analytics and reporting

For detailed technical specifications, see the [Product Requirements Document](docs/PRD.md).
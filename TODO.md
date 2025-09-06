# Wiki-Drafter Development TODO
*Current implementation status vs PRD requirements*

## ✅ Completed - Milestone 1: Scaffold & Three-Pane Shell
- [x] Extension framework created (activates on .wiki files)
- [x] Three-pane UI structure (Editor, Preview webview, Claims Grid webview)
- [x] Language configuration for wikitext (.wiki/.wikitext files)
- [x] Companion service skeleton (FastAPI on localhost:8000)
- [x] Extension installed and working in Windsurf
- [x] Basic webview providers (TypeScript classes exist)
- [x] Activity bar integration (Wiki-Drafter icon)

## 🔄 In Progress - Getting Basic Functionality Working
- [x] Fix fallback HTML renderer for preview ✅ WORKING!
- [x] Companion service rendering ✅ WORKING! 
- [ ] Debug claim extraction display (claims not showing in grid)

## 📋 Pending - Core Features (PRD Milestones 2-4)

### Milestone 2: Parsoid Preview + DSR Mapping  
- [ ] Set up local Parsoid service
- [ ] Implement proper wikitext → HTML rendering
- [ ] Add DSR-based cross-highlighting between panes
- [ ] Section-scoped rendering optimization

### Milestone 3: Citations & References
- [ ] Fix Citoid integration endpoint
- [ ] Named-ref insertion/deduplication  
- [ ] Reflist hygiene (auto-insert {{reflist}})
- [ ] Citation normalization (CSL-JSON → cite templates)

### Milestone 4: Policy Gates & RSP Scoring
- [ ] Implement WP:RSP source quality scoring
- [ ] BLP claim detection and blocking
- [ ] Inline citation requirements (quotes, statistics, BLP)
- [ ] "When to cite" policy automation

### Milestone 5: Link Management
- [ ] Wayback Machine archiving integration
- [ ] Dead link detection and flagging
- [ ] Archive URL storage and validation

### Milestone 6: Content Safety
- [ ] Copyvio screening (similarity detection)
- [ ] Quote vs close-paraphrase detection
- [ ] Auto-quote with citation functionality

### Milestone 7: LLM Integration
- [ ] Implement intelligent claim extraction (replace basic sentence parser)
- [ ] Schema-validated LLM responses
- [ ] Claim classification (BLP, quote, statistic, contentious, general)
- [ ] Risk assessment automation

### Milestone 8: Publishing & Diff
- [ ] Pre-publish checklist with gates
- [ ] MediaWiki API integration for sandbox publishing
- [ ] Clean diff generation and edit summaries
- [ ] Policy-aware edit summary composition

### Milestone 9: Learning Loop
- [ ] Feedback capture system (accept/reject/edit suggestions)
- [ ] Threshold tuning based on user behavior
- [ ] Operating Manual auto-generation
- [ ] Rule synthesis from patterns

### Milestone 10: Polish & QA
- [ ] Gold set regression testing
- [ ] Performance optimization (sub-second feedback)
- [ ] Accessibility improvements
- [ ] Documentation and examples

## 🔧 Technical Debt & Improvements
- [ ] Add .vscodeignore for cleaner packaging
- [ ] Fix extension packaging warnings (repository field, LICENSE)
- [ ] Bundle extension for better performance
- [ ] Add error handling and logging
- [ ] Implement proper interval tree for claim offset management
- [ ] Add comprehensive test coverage

## 🐛 Current Issues
- **Preview not rendering**: Parsoid not configured, fallback renderer broken
- **Claims grid empty**: Claim extraction not displaying results  
- **No cross-highlighting**: Claims don't highlight text in editor/preview
- **Keyboard shortcuts inactive**: Commands defined but handlers missing
- **Service endpoints untested**: API integration needs validation

## 📊 Implementation Progress
- **Milestone 1**: ✅ Complete (Scaffold & UI structure)
- **Milestone 2**: 🔄 In Progress (Basic rendering)
- **Milestones 3-10**: ⏳ Not started

**Current Focus**: Get basic preview rendering working to demonstrate the three-pane concept, then implement claim extraction display.
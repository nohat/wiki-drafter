Assumptions: Single-user, English Wikipedia target, VS Code/Windsurf host, local-first with optional cloud LLMs, drafts live in Git, Parsoid reachable locally or via WMF REST.

# Product Requirements & Technical Spec — “Wiki-Drafter”

## 1) Objective

Build a VS Code/Windsurf extension (plus optional local companion service) that turns Wikipedia drafting into an AI-first, human-in-the-loop workflow: three synchronized panes (Wikitext, Live Preview, Claims Grid), policy-aware automation (V/BLP/Inline/When-to-cite), link archiving, copyvio safety, and an online-learning loop that continuously improves suggestions and maintains an “Operating Manual.”

## 2) Success Criteria

* All claims requiring inline cites are flagged until satisfied; zero BLP hard-violations at publish.
* Sub-second editing feedback: decorations <25 ms; section preview patch <600 ms median with local Parsoid.
* 100% new external links archived (or verified live) before publish.
* AI suggestion acceptance rate improves week-over-week until stable; regressions auto-rolled back.
* Clean diffs: stable refnames, no spurious churn.

## 3) Scope

### In

* Three-pane UX (Editor, Preview, Claims Grid).
* Policy gates (V/BLP/Inline/When-to-cite), RSP-driven reliability scoring.
* Citoid integration; named-ref insertion/deduping; Reflist hygiene.
* Wayback/IABot archiving; dead-link checks.
* Copyvio screening (Earwig-style); quotes/close-paraphrase detection.
* LLM-assisted claim extraction/classification/paraphrase phrasing.
* Section-scoped preview with Parsoid; DSR-based cross-highlighting.
* Learning loop: feedback capture, threshold tuning, rule synthesis, Operating Manual.

### Out (v1)

* Multi-user collaboration, server sync, on-wiki gadget distribution.
* WYSIWYG editing; template authoring tools; infobox editors.
* Automated source search on the web (may propose intents, no scraping).

## 4) Personas

* **Power editor (single user):** Keyboard-first, policy-savvy; wants fast triage, precise control, and clean diffs.

## 5) Canonical Workflows (AI-first HITL)

1. **Import & initialize** → parse, extract claims, map refs, lock cite style.
2. **Drafting & refactor** → inline chips for add/upgrade cite, quote, as-of.
3. **Attach/upgrade source** → Citoid normalize, RSP score, archive.
4. **BLP gate** → block publish on unsupported/legal/health claims.
5. **Quotes safety** → detect verbatim/close paraphrase → quote or rewrite.
6. **Stats freshness** → detect recency needs → insert “As of YYYY.”
7. **General→inline reconciliation** → promote where policy demands.
8. **Archive & link rot** → batch archive; verify titles.
9. **Pre-publish checklist** → gates, composed edit summary, clean diff.
10. **Post-publish retrospective** → learn from overrides, update manual.

## 6) Functional Requirements

### 6.1 Editor & Interaction

* Wikitext editor with diagnostics (unclosed tags, refname collisions, mixed cite styles, orphaned refs).
* Inline chips (no modal by default): **Add cite**, **Upgrade source**, **Quote req.**, **As-of**, **BLP risk**.
* Keyboard map (macOS symbols imply Cmd; translate on Windows):

  * `;` insert/attach citation at cursor
  * `⌘.` accept all low-risk autos in view
  * `⌘U` filter unsupported claims
  * `1/2/3` choose top cite candidate
  * `A` archive pending links
  * `Q` toggle quote/blockquote w/ cite
  * `F` fix “As of” phrasing
  * `⇧B` BLP focus mode
  * `⌘↩` publish to sandbox; `⌥⌘↩` export patch

### 6.2 Claims Grid

* One row per claim; columns:
  `id, section, start, end, claim_text, type, risk, requires_inline, existing_refs, status, sources[], source_quality, as_of, notes`
* Filters: `status!=supported`, `risk=high`, `BLP`, `section`.
* Row selection ↔ highlights sentence in Editor & Preview.

### 6.3 Live Preview

* Parsoid render (section-scoped when possible) in Webview.
* DOM patching (no full reload); click footnote → select sentence/row.
* DSR-based spans (`data-claim-id`) for cross-mapping.

### 6.4 Policy & Reliability

* Inline required when: quotes, BLP/legal/health, statistics, contentious/likely-challenged, or article’s CITEVAR demands inline.
* Reliability scoring via WP\:RSP mapping + deterministic penalties/bonuses:

  * Base by RSP label; adjustments for editorial control, independence, primary/secondary fit, metadata completeness.
  * Thresholds configurable; high-risk claims require ≥ configured floor.

### 6.5 Citations & Archiving

* Citoid normalize → {{cite web/journal/book}}; named-ref creation and reuse; stable `refname = domain_year_slugN`.
* `{{reflist}}` check and auto-insert.
* Wayback save & IABot suggestions; store `archive-url/date`, `url-status`.

### 6.6 Copyvio & Quotes

* Similarity scan vs. web; thresholds configurable.
* Actions: auto-quote (with cite), paraphrase suggestion, or block publish.

### 6.7 “As of” Freshness

* Detect time-sensitive stats; mark stale; suggest “As of YYYY” wording or a newer source.

### 6.8 Learning Loop

* Feedback capture per suggestion: `{accept, edit, reject, defer}` + reason picklist.
* Threshold tuner (per taxonomy); few-shot memory (examples) injected into future prompts; rule synthesis proposes new deterministic rulelets.
* Auto-maintained **Operating Manual** (Markdown): Signals → Actions → Rationale → Examples + changelog.

### 6.9 Publishing

* Sandbox push via MediaWiki API; composed edit summary referencing policies touched.
* Clean diff view (VS Code native).

## 7) Non-Functional Requirements

* Latency budgets: decorations <25 ms; grid row update <80 ms; section preview <600 ms median (local Parsoid); full page <1 s median (local).
* Determinism: repeated runs yield identical refnames and citation serialization.
* Privacy: all learning artifacts local by default; opt-in export.
* Resilience: degraded mode without Parsoid (basic preview); suggestions never block typing.
* Accessibility: keyboard complete; ARIA in webviews; high-contrast chips.

## 8) System Architecture

### 8.1 Components

* **VS Code/Windsurf Extension (TypeScript)**

  * Language features: diagnostics, code actions, hovers.
  * Two Webviews: Preview, Claims Grid (React/TypeScript).
  * Decorations & navigation; command palette/shortcuts.
  * LLM orchestrator (provider abstraction, schema validation).
  * Git integration (no custom UI required).
* **Local Companion Service** (optional; FastAPI or Node/Express)

  * Parsoid proxy & cache.
  * Citoid/Crossref/OpenAlex proxy/enrichment.
  * Wayback/IABot wrapper.
  * Copyvio similarity endpoint.
  * mwparserfromhell ops (safe ref insertion/rename) if using Python.

### 8.2 Data Flow (per keystroke)

1. Editor change → update `Doc.rev`; shift claim intervals (interval tree) and re-segment touched paragraph.
2. Update decorations & dirty Claims rows immediately.
3. Debounce → Parsoid section render → DOM patch; rebuild DSR mapping and re-wrap `data-claim-id` spans.

### 8.3 Background Jobs

* LLM claim extraction on idle; tag with `rev`—discard stale.
* Archive queue (batch).
* Copyvio queue on pre-publish or explicit request.

## 9) Interfaces & Schemas

### 9.1 Config (`.wiki-draft.config.json`)

```json
{
  "cite_style": "named-refs",
  "as_of_year_threshold": 3,
  "llm": {"provider": "ollama", "model": "llama3.1:70b", "temperature": 0.1},
  "wikimedia_auth": {"method": "botpassword", "username": "", "password": ""},
  "parsoid": {"endpoint": "http://localhost:8142"},
  "citoid": {"endpoint": "http://localhost:1970"},
  "policy": {"inline_for": ["BLP","quote","statistic","contentious"]},
  "thresholds": {"source_quality_high_risk_min": 70, "copyvio_max_similarity": 0.35}
}
```

### 9.2 Claims file (`Article.claims.json`)

```json
{
  "article": "Title",
  "rev": 1842,
  "claims": [
    {
      "id":"c_12","section":"History","start":1824,"end":1903,
      "text":"In 1897, the line was extended to the coast.",
      "type":"statistic","risk":"medium","requires_inline":true,
      "existing_refs":["railhist1898"],"status":"supported",
      "sources":["railhist1898"],"source_quality":82,
      "as_of":"1898-01-01","notes":"Gazette checked."
    }
  ]
}
```

### 9.3 Source store (`sources.json` or SQLite table)

```json
{
  "railhist1898": {
    "normalized_key": "railhist1898",
    "csl_json": { "type":"article-journal","author":[{"family":"Smith"}], "issued":{"date-parts":[[1898]]}, "title":"...", "container-title":"Rail Hist." },
    "cite_template": "cite journal",
    "rsp_label": "generally reliable",
    "publisher": "Rail Hist. Society",
    "is_primary": false,
    "is_independent": true,
    "archive_url": "https://web.archive.org/...",
    "oa_flag": false,
    "access_date": "2025-09-05"
  }
}
```

### 9.4 RSP cache (`rsp_cache.json`)

```json
{
  "example.com": {"label":"deprecated","notes":"Consensus deprecated for any claim"},
  "latimes.com": {"label":"generally reliable"},
  "arxiv.org": {"label":"context-dependent","notes":"Not peer-reviewed; OK for some topics"}
}
```

### 9.5 Feedback log (`learn/feedback.log.jsonl`)

```json
{"ts":"2025-09-05T17:22:13Z","article":"Carolina del Príncipe","rev":1842,"claim_id":"c_73","suggestion_type":"attach_source","ai_choice":{"source_id":"company_pr_2021","score":58},"user_action":"reject","reason":"mis-scored_source","notes":"Press release; need independent coverage"}
```

### 9.6 Operating Manual (`learn/operating-manual.md`)

```md
## Legal/BLP: Indictments and lawsuits
**Signals:** person + (indicted|sued|arrested)  
**Action:** require secondary newspaper/book; disallow blogs/press releases.  
**Rationale:** BLP; accuracy.  
**Examples:** c_219 (2025-09-05): replaced company blog with AP.
```

### 9.7 Local Service API (HTTP JSON)

* `POST /render` → `{wikitext, section?}` → `{html, dsr_map}`
* `POST /citoid` → `{url|doi|isbn}` → `{csl_json, template, refname}`
* `POST /archive` → `{url}` → `{archive_url, archive_date, status}`
* `POST /copyvio` → `{text, top_n?}` → `{similarity_max, matches:[{url,score}]}`
* `POST /score_source` → `{domain, csl_json, context}` → `{source_quality, rsp_label, reasons[]}`
* `POST /mw/preview` → `{title, wikitext}` → `{html}` (optional proxy)
* `POST /mw/publish` → `{title, wikitext, summary}` → `{new_rev, diff_url}`

### 9.8 LLM Contract (function-calling JSON)

**Claim extraction task**

```json
{
  "claim_id":"c42","section":"History",
  "start":1834,"end":1901,"claim_text":"In 1897 ...",
  "claim_type":"statistic","risk":"medium",
  "requires_inline_suggestion":true,
  "rationale":"date + infrastructure expansion; likely to be challenged"
}
```

Validation: strict JSON schema; offsets must align to sentence boundaries (snap if needed).

## 10) Core Algorithms (pseudocode)

### 10.1 Interval maintenance

```ts
class IntervalIndex {
  insert(id, start, end) {...} // balanced tree
  shift(rangeStart, deltaLen) {...} // shift intervals >= rangeStart
  query(rangeStart, rangeEnd) -> ids[]
}
onTextChange(delta):
  doc.apply(delta); rev++
  index.shift(delta.start, delta.text.length - delta.rangeLength)
  dirty = index.query(delta.start, delta.start + delta.text.length)
  resegmentParagraphAround(delta.start)
  updateDecorations(dirty)
```

### 10.2 Debounced preview

```ts
schedulePreview():
  debounce(200ms, async () => {
    const section = currentSection()
    const {html, dsr} = await svc.render({wikitext: doc.text, section})
    preview.patch(html) // morphdom
    mapping = buildMappingFromDSR(dsr)
    wrapClaims(mapping, claims)
  })
```

### 10.3 Inline citation placement

* Place `<ref name="...">…</ref>` at sentence end, inside punctuation policies.
* If refname exists with identical CSL-JSON → reuse; else create named ref and store normalized source.

## 11) UI Spec

* **Layout:** Editor (left), Preview (center), Claims Grid (right); resizable.
* **Grid row:** status pill (red/amber/green), claim text (truncated), badges (BLP, quote, stat), source score chip.
* **Hover cards:** show cite metadata, RSP label, archive status, and compact rationale for AI suggestions.
* **Checklist drawer:** pre-publish gate list with pass/fail and “waive with rationale” control (logged).

## 12) Performance & Caching

* Local Parsoid strongly preferred (configurable endpoint).
* Cache Citoid responses by URL/DOI; cache RSP lookups by domain.
* Persistent store: small SQLite recommended for sources + learn logs; JSON acceptable for v1.

## 13) Security & Privacy

* Wikimedia credentials via VS Code SecretStorage.
* LLM keys stored in SecretStorage; redact in logs.
* Learning artifacts remain local by default; explicit user action to export/share.

## 14) Testing & QA

* **Gold set**: 50 mixed articles with ground-truth annotations (claims, inline vs general, acceptable sources). Store under `examples/gold/`.
* **Unit tests**: interval shifts, refname dedupe, score calc, “as-of” detector, CITEVAR detection.
* **Integration tests**: render→map→highlight loop; attach/upgrade cite; archive flow; BLP gate.
* **Latency tests**: synthetic typing benchmark; section render timing (local vs remote).
* **Regression harness**: acceptance metrics (precision/recall on claimability; zero BLP false-negatives; stable refnames) must not drop between builds.
* **Manual scenarios**: quotes rewrite; dead link replacement; general→inline promotion.

## 15) Telemetry (local)

* Counters: suggestions shown/accepted/rejected per type; mean time-to-first-cite.
* Gauges: archive coverage; BLP overrides; copyvio blocks.
* Weekly summary appended to Operating Manual; auto-rollback if acceptance dips beyond threshold.

## 16) Delivery Plan (milestones, order only)

1. **Scaffold & three-pane shell**: diagnostics, grid, cross-highlight stubs.
2. **Parsoid preview + DSR mapping** (section-scoped).
3. **Citations**: Citoid normalize, named-ref insertion, dedupe, reflist hygiene.
4. **RSP scoring + policy gates** (V/BLP/Inline).
5. **Archiving & link-rot checks**.
6. **Copyvio & quotes safety**.
7. **LLM claim extraction & paraphrase (schema-validated)**.
8. **Pre-publish checklist & diff composer**.
9. **Learning loop**: feedback capture → threshold tuner → Operating Manual.
10. **Gold set & regression harness**; polish, docs.

## 17) File/Repo Layout

```
wiki-drafter/
  extensions/vscode/
    src/extension.ts
    src/editor/diagnostics.ts
    src/commands/*.ts
    src/webviews/preview/
    src/webviews/claims-grid/
    media/
    package.json
  services/local/  (FastAPI or Node)
    app.(py|ts)
    routers/{render,citoid,archive,copyvio,score}.(py|ts)
    parsers/
    rsp_cache.json
  packages/shared/
    schemas/{claims.schema.json,feedback.schema.json}
    types/
  examples/{demo-article.wiki, demo-article.claims.json, gold/**}
  learn/{operating-manual.md, feedback.log.jsonl}
```

## 18) Open Technical Decisions (choose defaults; both supported)

* **Companion service**: Python (mwparserfromhell + FastAPI) vs Node (unified stack). Default: **Python** for robust wikitext ops.
* **LLM**: Local (Ollama) vs cloud (OpenAI/Anthropic). Default: **Local** with pluggable provider.
* **Store**: SQLite vs JSON. Default: **SQLite** for sources/learn; JSON for claims.

## 19) Acceptance Checklist (go/no-go)

* [ ] Decorations and chips render within budget while typing.
* [ ] Claims Grid stays consistent through heavy edits (no lost anchors).
* [ ] Parsoid preview patches reliably with correct cross-highlights.
* [ ] Citoid normalization + named-ref reuse deterministic; reflist present.
* [ ] RSP scoring enforces thresholds; BLP hard stops work; rationale logging on overrides.
* [ ] Archive coverage 100% for new external links; dead links flagged.
* [ ] Copyvio gate prevents publish of high-similarity unquoted text.
* [ ] “As of” detector and phrasing applied to stale stats.
* [ ] Pre-publish checklist green or explicitly waived; composed summary cites policies.
* [ ] Learning loop produces weekly Operating Manual updates; acceptance trends non-degrading.

This PRD/spec is intentionally implementation-ready for a VS Code/Windsurf codebase with a small local service, focusing on AI-first UX, strict policy guardrails, and measurable, iterative improvement.

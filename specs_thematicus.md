# Thematicus — Project Specification
**Version:** 1.2  
**Status:** Pre-build  
**Stack:** React (single artifact) + Groq API (Llama 3.3 70B)  

---

## 1. Project Overview

A browser-based qualitative thematic analyzer that processes up to 10 PDF documents against a user-defined codebook. The system performs both **deductive coding** (user-defined Gen 1 themes) and **inductive coding** (Groq-discovered emergent themes/sub-codes), producing a living codebook, cross-document analysis, four interactive visualizations, and a downloadable summary report.

Thematicus follows a **pipeline-first architecture** inherited from prior research tooling (VMARO): sequential knowledge enrichment, state-aware checkpointing, validated LLM outputs, and full interpretability at every step.

---

## 2. Core Design Principles

- **Living codebook** — themes evolve across generations; Gen 1 is sacred and never removed
- **Human-in-the-loop** — review gate after Phase 2 before any PDF analysis begins
- **Sequential processing** — PDFs analyzed one at a time; each updates the codebook before the next call, so later documents benefit from earlier discoveries
- **Single API key** — sequential calls + exponential backoff handles Groq rate limits without key pooling
- **Client-side aggregation** — all merging, matrix building, and chart data prep done in JS; no extra API calls
- **Provenance tracking** — every theme and sub-code carries generation metadata and source document(s)
- **Never trust raw LLM output** — all responses pass through a normalization and validation layer before use
- **Exact checkpointing** — cache records the precise document and phase where a run stopped, enabling exact resume

---

## 3. Design Philosophy

Thematicus follows a pipeline-first architecture inspired by multi-agent research systems (VMARO):

- **Sequential enrichment of knowledge** — the codebook evolves per document; each analysis is richer than the last
- **State-aware processing** — every step builds on the validated output of the previous step; no step assumes a clean slate
- **Minimal reliance on black-box retrieval** — no embeddings, no vector DB; all reasoning is prompt-driven and auditable
- **Emphasis on interpretability and provenance** — every theme, sub-code, and quote traces back to a source document and generation
- **Validated pipeline** — LLM outputs are never consumed raw; normalization and schema validation run between every phase

---

## 4. Tech Stack

| Layer | Technology |
|---|---|
| UI framework | React (single .jsx artifact) |
| PDF extraction | PDF.js (cdnjs CDN) |
| LLM inference | Groq API — `llama-3.3-70b-versatile` (default) / `llama3-8b-8192` (fast mode) |
| Charts | D3.js — knowledge graph, sunburst, radar, heatmap |
| Export | Browser `window.print()` → PDF, or `Blob` download as HTML |
| State | React `useState` / `useReducer` — no backend, no localStorage |
| Client-side storage | IndexedDB (via lightweight wrapper or `idb`) |
| Cache strategy | Per-session persistent checkpointing (codebook, analyses, evolution log) |

---

## 5. Data Schemas

### 5.1 Gen 1 Input (user-provided)
```json
["Trust", "Identity", "Power", "Resistance", "Care"]
```
Accepted as `.json` (array) or `.txt` (one theme per line). Parsed and normalized to `string[]`.

---

### 5.2 Codebook Schema (`codebook.json`)
Built in Phase 2. Evolves during Phase 3. Final version is `codebook_final.json`.

```json
{
  "version": 2,
  "generated_at": "2025-01-01T00:00:00Z",
  "themes": [
    {
      "id": "trust",
      "label": "Trust",
      "generation": 1,
      "source": "user",
      "definition": "The reliance on or confidence in a person, institution, or system.",
      "keywords": ["rely", "confidence", "faith", "credibility"],
      "sub_codes": [
        {
          "id": "trust_institutional",
          "label": "Institutional trust",
          "generation": 2,
          "source": "groq_phase2",
          "definition": "Trust placed in formal institutions such as governments or hospitals.",
          "keywords": ["government", "hospital", "policy", "authority"]
        },
        {
          "id": "trust_interpersonal",
          "label": "Interpersonal trust",
          "generation": 2,
          "source": "groq_phase2",
          "definition": "Trust between individuals in personal relationships.",
          "keywords": ["friend", "family", "colleague", "confide"]
        },
        {
          "id": "trust_passive_compliance",
          "label": "Passive compliance",
          "generation": 3,
          "source": "groq_phase3",
          "triggered_by": ["doc_3.pdf"],
          "definition": "Apparent trust expressed through compliance rather than genuine belief.",
          "keywords": ["comply", "go along", "no choice", "resigned"]
        }
      ]
    },
    {
      "id": "surveillance",
      "label": "Surveillance",
      "generation": 2,
      "source": "groq_phase2",
      "triggered_by": ["corpus_preview"],
      "definition": "EMERGENT: Monitoring and observation of individuals by institutions or peers.",
      "keywords": ["watch", "monitor", "track", "observe", "report"],
      "emergent": true,
      "sub_codes": []
    }
  ]
}
```

**Provenance rules:**
- `generation: 1` — user-defined, never deleted
- `generation: 2` — built by Groq in Phase 2 from corpus preview
- `generation: 3` — discovered during Phase 3 per-PDF analysis
- `emergent: true` — flags new *main* themes (not sub-codes) added post-Gen 1
- `triggered_by` — which document(s) caused this addition

---

### 5.3 Per-PDF Analysis Schema (`analysis_N.json`)
Returned by Groq for each document in Phase 3.

```json
{
  "doc_id": "doc_3",
  "doc_name": "interview_cohort_a.pdf",
  "doc_summary": "Participants describe compliance-driven behaviour in clinical settings, with limited agency.",
  "word_count": 4821,
  "tags": [
    {
      "theme_id": "trust",
      "sub_code_id": "trust_institutional",
      "intensity": 4,
      "confidence": 0.82,
      "quotes": [
        "We just did what the doctors said, there was no room to question.",
        "You trust the system because you have to, not because you want to."
      ],
      "paragraph_refs": [2, 7, 14]
    },
    {
      "theme_id": "power",
      "sub_code_id": null,
      "intensity": 3,
      "quotes": ["They held all the cards in that situation."],
      "paragraph_refs": [5]
    }
  ],
  "new_sub_codes": [
    {
      "id": "trust_passive_compliance",
      "label": "Passive compliance",
      "parent_theme_id": "trust",
      "definition": "Apparent trust expressed through compliance rather than genuine belief.",
      "keywords": ["comply", "go along", "no choice", "resigned"],
      "justification": "Distinct pattern not captured by institutional or interpersonal trust sub-codes."
    }
  ],
  "emergent_themes": []
}
```

---

### 5.4 Master Data Schema (`master_data.json`)
Built in Phase 4 by merging all `analysis_N.json` files.

```json
{
  "codebook_final": { },
  "codebook_evolution": {
    "gen1_count": 5,
    "gen2_sub_codes_added": 11,
    "gen2_emergent_themes": 1,
    "gen3_sub_codes_added": 3,
    "gen3_emergent_themes": 0
  },
  "documents": [
    { "doc_id": "doc_1", "doc_name": "...", "word_count": 0, "doc_summary": "..." }
  ],
  "intensity_matrix": {
    "trust": { "doc_1": 4, "doc_2": 2, "doc_3": 5, "doc_4": 0 },
    "identity": { "doc_1": 2, "doc_2": 4, "doc_3": 1, "doc_4": 3 }
  },
  "cooccurrence": [
    { "theme_a": "trust", "theme_b": "power", "count": 7, "docs": ["doc_1", "doc_3"] },
    { "theme_a": "identity", "theme_b": "resistance", "count": 4, "docs": ["doc_2"] }
  ],
  "quote_bank": {
    "trust": [
      { "quote": "...", "doc": "doc_3", "intensity": 4 }
    ]
  },
  "theme_frequency": {
    "trust": { "doc_count": 9, "total_tags": 34, "avg_intensity": 3.6 }
  },
  "saturation": {
    "detected": true,
    "at_doc": "doc_7",
    "consecutive_empty_docs": 3
  }
}
```

---

### 5.5 Cache / Checkpoint Schema (`cache_store`)
Stored in IndexedDB under a single key (e.g., `thematic_cache`).

```json
{
  "version": "v1",
  "created_at": "ISO timestamp",
  "phase": "phase3",
  "last_completed_doc": "doc_3",
  "codebook": { },
  "analyses": {
    "doc_1": { },
    "doc_2": { },
    "doc_3": { }
  },
  "completed_docs": ["doc_1", "doc_2", "doc_3"],
  "logs": [
    { "doc": "doc_1", "doc_name": "...", "added_sub_codes": [], "added_themes": [], "prompt_version": "phase3_prompt_v1" },
    { "doc": "doc_3", "doc_name": "...", "added_sub_codes": ["trust_passive_compliance"], "added_themes": [], "prompt_version": "phase3_prompt_v1" }
  ],
  "master_data": { }
}
```

**Notes:**
- `phase` + `last_completed_doc` enable **exact** resume — not just "somewhere in Phase 3" but the precise document boundary
- `logs[]` persists the full evolution history so it survives reload and feeds the Phase 6 report
- `completed_docs` is used to skip already-processed documents on resume
- `version` is used to invalidate incompatible schema updates (mismatch → prompt reset)
- Raw PDF files are **not** stored — only extracted text and derived data

---

## 6. Quality Gates

The system includes lightweight validation layers between phases to ensure output reliability. LLM outputs are **never consumed raw** — every response passes through a gate before entering application state.

### Phase 2 Gate — Codebook Validation
After receiving the Phase 2 response from Groq:
- Ensure every theme has: `id`, `label`, `definition`, `keywords[]`
- Reject malformed themes (missing required fields) and log them
- Deduplicate: reject any theme whose `id` already exists in Gen 1
- Cap emergent themes at **3 maximum** — more signals an overly broad prompt, not a richer corpus
- If validation fails entirely: retry once with a stricter prompt, then surface error to user

### Phase 3 Gate — Per-Document Analysis Validation
After receiving each Phase 3 response from Groq:
- Ensure `intensity` values fall in `[1, 5]` — clamp or reject out-of-range values
- Ensure `quotes[]` is non-empty for any tag with intensity ≥ 3
- Ensure every `theme_id` in `tags[]` exists in the current codebook — discard orphan tags
- Ensure every `new_sub_code` has `id`, `label`, `parent_theme_id`, `definition`, `keywords[]`, `justification`
- Cap `new_sub_codes` at max 2 per document per theme
- Cap `emergent_themes` at max 1 per document
- If validation fails:
  - Retry once with a stricter prompt instruction appended
  - If still invalid: mark document as `"partial"`, log the issue, continue to next document

### JSON Repair (runs before both gates)
All LLM responses pass through a cleanup function before schema validation:
- Strip markdown fences (` ```json ... ``` `)
- Remove inline comments
- Fix trailing commas in objects/arrays
- Attempt `JSON.parse()` — if it fails, attempt light structural repair before giving up
- Only fully parsed, schema-valid JSON proceeds to application state

---

## 7. Output Normalization Layer

All LLM responses pass through a dedicated normalization pipeline before reaching any gate or application state. This is a pure utility layer — isolated from business logic and independently testable.

```
raw LLM string
  → strip markdown / code fences
  → trim whitespace
  → fix trailing commas
  → JSON.parse()
  → schema validation
  → [Quality Gate]
  → application state
```

**Fallback chain:**
1. Attempt parse → success → proceed
2. Attempt light repair → re-parse → success → proceed
3. Retry Groq call with stricter prompt suffix: *"Return ONLY raw JSON. No markdown. No explanation."*
4. Second attempt fails → mark as error, surface to user, continue pipeline if possible

Implemented as a standalone `normalizeAndParse(raw, schema)` utility — keeping it reusable across all phases.

---

## 8. Prompt Versioning

Each phase uses versioned, named prompt templates stored as constants in the codebase. This ensures reproducibility, simplifies debugging, and makes future improvements trackable.

| Phase | Prompt constant | Version |
|---|---|---|
| Phase 2 — Codebook builder | `PHASE2_PROMPT` | `v1` |
| Phase 3 — Per-PDF analysis | `PHASE3_PROMPT` | `v1` |
| Phase 6 — Report writer | `PHASE6_PROMPT` | `v1` |

**Rules:**
- Prompt text is never constructed dynamically — only variables (codebook JSON, document text) are injected
- Any change to prompt wording or structure increments the version: `v1` → `v2`
- The active prompt version is recorded in each cache log entry for auditability
- The cache `version` field is independent — it tracks data structure compatibility, not prompt version

---

## 9. Codebook Evolution Log

The evolution log is a first-class data structure — not just a UI toast. It is built incrementally during Phase 3, persisted in the cache, and consumed by both the UI timeline and the Phase 6 report.

**What is logged after each document analysis:**
- New sub-codes added (label, parent theme, triggered by which document)
- New emergent themes added (label, triggered by which document)
- Documents that produced zero additions (important for saturation detection)
- Prompt version used

**Log entry schema:**
```json
{
  "doc": "doc_3",
  "doc_name": "interview_cohort_a.pdf",
  "added_sub_codes": [
    { "id": "trust_passive_compliance", "label": "Passive compliance", "parent": "trust" }
  ],
  "added_themes": [],
  "prompt_version": "phase3_prompt_v1"
}
```

**UI display:**
- Shown as a live scrolling timeline during Phase 3 processing
- Additions render as: `doc_3.pdf → +1 sub-code (Passive compliance under Trust)`
- Zero-addition entries render as: `doc_5.pdf → no new codes`
- Timeline persists and remains visible in the final results view
- Full log is included in the Phase 6 report as the codebook evolution table

---

## 10. Theme Saturation Detection

Thematicus tracks whether new codes are still being discovered as the corpus is processed. When a corpus stops producing novel themes, it signals thematic saturation — a key qualitative research judgment that is typically made manually.

**Detection logic:**
- After each document analysis, check whether any new sub-codes or emergent themes were added
- Maintain a rolling count of consecutive documents with zero additions
- Default saturation threshold: **3 consecutive documents with no new codes**

**UI signal:**
- When threshold is reached, display a non-blocking banner:  
  *"No new themes emerging across the last 3 documents — thematic saturation likely reached."*
- Banner is informational only — processing continues normally
- Saturation status is recorded in `master_data` and mentioned in the Phase 6 report

---

## 11. Processing Transparency

Thematicus shows users exactly what the pipeline is doing at every moment. There are no black boxes.

**Per-phase display:**
- Current phase name + step description (e.g., "Phase 3 — Analyzing document 4 of 10")
- Currently active document name
- Estimated time remaining (based on average duration of completed calls)
- Live evolution log panel (scrollable, always visible during Phase 3)

**Progress indicators:**
- Top-level stepper: Phase 0 → Phase 6 with completed / active / pending states
- Per-document progress bar during Phase 3
- Spinner + label during Groq API calls: "Waiting for Groq…" → "Validating response…" → "Updating codebook…"

**Error transparency:**
- All gate rejections, parse failures, and retries are surfaced in the log panel with plain-language descriptions
- User is never left wondering why processing stalled
- Partial validations are flagged with a "Partial analysis" UI badge and an option to "Retry this document"

---

## 12. User Control Hooks

Lightweight human-in-the-loop controls at key decision points, without interrupting the automated pipeline.

**Phase 2 (currently implemented):**
- Accept / reject / edit individual sub-codes and emergent themes
- Merge two sub-codes into one (must-have — prevents codebook bloat)
- Manually add custom sub-codes or themes before confirming
- "Accept all" / "Reject all emergent" bulk actions

**Future (v2+):**
- Allow disabling specific Gen 1 themes before Phase 3 begins (e.g., skip coding for "Power" in this run)
- Per-document overrides: mark a document as "skip" or "re-analyze" from the results view
- Post-hoc codebook editing with re-run option for affected documents

---

## 13. Phase Breakdown

### Phase 0 — Setup
**Deliverable:** Functional UI shell, no API calls.

- Groq API key input field (masked, session-only, never persisted)
- Model selector: `llama-3.3-70b-versatile` (quality) / `llama3-8b-8192` (speed)
- Step progress indicator (phases 0–6 shown as stepper)
- Global error boundary with friendly messages

**API Key Handling:**
- Entered via masked UI input field (React state only)
- Optional: stored in `sessionStorage` if user enables "Remember for session"
- Never persisted to IndexedDB or localStorage
- No `.env` mutation at runtime (Vercel constraint)

---

### Phase 1 — Input Layer
**Deliverable:** Extracted text per PDF + parsed theme list.

**PDF upload:**
- Accept up to 10 `.pdf` files via drag-and-drop or file picker
- Extract text using PDF.js → store as `{ doc_id, doc_name, text, word_count }` (only extracted text stored; raw PDFs are **not** written to IndexedDB)
- Show per-file extraction status (success / warn if < 200 words / error)
- Warn user if text extraction is poor (< 50 words) — likely a scanned/image-only PDF

**Themes upload:**
- Accept `.json` (flat array) or `.txt` (newline-separated)
- Validate: must be array of strings, 2–50 items
- Display parsed themes as editable chips — user can add/remove before proceeding
- Save as `gen1_themes: string[]`

---

### Phase 2 — Theme Tree Builder
**Groq calls:** 1  
**Deliverable:** `codebook_v1.json` + review gate UI.

**Input to Groq:** Gen 1 theme list + 500-token preview sample from each PDF (first ~300 words).

**Prompt schema** (`PHASE2_PROMPT v1`):
```
SYSTEM:
You are a qualitative research assistant specializing in thematic analysis.
You will receive a list of primary themes (Gen 1) and text samples from a corpus.
Your job is to:
1. Build sub-codes for each Gen 1 theme based on what you observe in the samples.
2. Identify any concepts in the corpus that are categorically distinct from ALL Gen 1 
   themes. Propose these as new main themes (emergent). Only propose a new main theme 
   if it genuinely cannot be classified as a sub-code of any existing Gen 1 theme.
3. Return ONLY valid JSON. No preamble, no explanation, no markdown.

OUTPUT FORMAT: { themes: [ { id, label, definition, keywords[], sub_codes[], emergent? } ] }

USER:
Gen 1 themes: ["Trust", "Identity", "Power"]

Corpus samples:
[doc_1.pdf]: "..."
[doc_2.pdf]: "..."
...
```

**→ Output passes through: Output Normalization Layer → Phase 2 Quality Gate**

**Review gate UI:**
- Show side-by-side: Gen 1 themes (left) | Groq suggestions (right)
- Sub-codes shown as expandable lists under each parent theme
- Emergent themes highlighted with a badge
- Per-item controls: ✓ Accept | ✗ Reject | ✎ Edit label/definition
- **Merge sub-codes** — select two sub-codes and merge into one (must-have)
- "Accept all" / "Reject all emergent" bulk actions
- User can manually add sub-codes or themes before confirming
- Confirm button → saves `codebook_final.json` → unlocks Phase 3

---

### Phase 3 — Per-PDF Analysis (Sequential)
**Groq calls:** up to 10 (one per PDF, sequential)  
**Deliverable:** `analysis_1.json` … `analysis_N.json` + updated codebook + evolution log.

**Codebook Transmission Optimization:**
Before sending to Groq in Phase 3, optimize the codebook by stripping long definitions, limiting keywords to top 5, and sending only: `theme_id`, `label`, and `sub_code` ids + labels. This prevents token bloat and improves LLM focus.

**Processing order:**
1. Call Groq with PDF_1 text + optimized codebook in system prompt
2. Response → Output Normalization Layer → Phase 3 Quality Gate
3. Extract validated `new_sub_codes[]` and `emergent_themes[]`
4. Merge into codebook → `codebook_v2.json`
5. Append to evolution log, update cache checkpoint (`phase`, `last_completed_doc`, `logs[]`)
6. Check saturation counter
7. Repeat for PDF_2 with updated codebook ... through PDF_N

**Prompt schema** (`PHASE3_PROMPT v1`):
```
SYSTEM:
You are a qualitative thematic analyst. Use ONLY the codebook below to tag the provided text.
You may propose new sub-codes or emergent themes if you encounter concepts genuinely absent 
from the codebook. Be conservative — only add what is categorically distinct.
Return ONLY valid JSON matching the output schema. No preamble, no markdown.

Intensity scale:
1 = weak/brief mention  
3 = moderate presence  
5 = dominant recurring theme

CODEBOOK (current version):
{ ... codebook JSON ... }

OUTPUT SCHEMA:
{
  doc_summary: string,
  tags: [{ theme_id, sub_code_id|null, intensity: 1-5, confidence: 0.0-1.0, quotes: string[], paragraph_refs: int[] }],
  new_sub_codes: [{ id, label, parent_theme_id, definition, keywords[], justification }],
  emergent_themes: [{ id, label, definition, keywords[], justification }]
}

USER:
Document: [doc_name]
Text:
[full extracted text]
```

**Rate limiting strategy:**
- Sequential calls (inherently spaced)
- 2-second minimum delay between calls
- On 429: exponential backoff — wait 5s, 10s, 20s, 40s (max 4 retries)
- On 500: retry once after 3s, then surface error with option to retry manually

**Cache / Checkpoint Integration:**

After each successful, validated document analysis — save to IndexedDB:
- Updated `codebook`
- `analysis_N` result
- `completed_docs` appended
- `phase` + `last_completed_doc` updated
- `logs[]` entry appended

On app load, if cache found — offer user:
- **"Resume previous analysis"** — skip completed docs, restore exact codebook, continue from `last_completed_doc + 1`
- **"Start fresh (clear cache)"** — invalidate and reset

---

### Phase 4 — Aggregation Engine
**Groq calls:** 0  
**Deliverable:** `master_data.json`

All merging done client-side in JS:

1. **Intensity matrix** — for each theme × each doc, record intensity (0 if not tagged)
2. **Co-occurrence** — for each pair of themes that appear in the same doc, count and record
3. **Quote bank** — group all quotes by theme, sort by intensity descending, then by document
4. **Theme frequency** — doc_count, total_tags, avg_intensity per theme
5. **Codebook evolution stats** — count Gen 1/2/3 additions
6. **Saturation summary** — first document at which saturation was detected (if any)

---

### Phase 5 — Visualizations
**Groq calls:** 0  
**Deliverable:** 4 interactive D3 charts, tabbed interface.

#### 5.1 Knowledge Graph (D3 force-directed)
- **Nodes:** themes (size = frequency) + documents (smaller, square)
- **Edges:** co-occurrence between themes (thickness = count); theme-to-document presence
- **Node styling:** Gen 1 = solid fill | Gen 2 = dashed border | Gen 3 / emergent = dotted + star badge
- **Interactions:** drag nodes, click node → sidebar shows definition + top quotes
- **Color:** each main theme gets a fixed ramp; documents are gray

#### 5.2 Sunburst Chart (D3 partition)
- **Ring 1 (center):** main themes
- **Ring 2:** sub-codes
- **Ring 3 (outer):** documents where that sub-code appears
- **Segment size:** proportional to intensity score
- **Interactions:** click segment to zoom in; breadcrumb trail at top

#### 5.3 Radar / Spider Chart (D3 radialLine)
- **Axes:** one per main theme
- **One polygon per document** (up to 10 overlaid, semi-transparent)
- **Toggle:** click document name in legend to show/hide — supports subset selection to avoid visual chaos
- **Scale:** 0–5 intensity per axis

#### 5.4 Heatmap (D3 or CSS grid)
- **Rows:** themes (grouped by parent if sub-codes shown)
- **Columns:** documents
- **Cell color:** intensity 0–5 mapped to color ramp (light → dark)
- **Click cell:** show quotes from that theme × document combination
- **Toggle:** show main themes only / show sub-codes

---

### Phase 6 — Summary Report
**Groq calls:** 1  
**Deliverable:** Downloadable HTML report (printable to PDF).

**Input to Groq:** `master_data.json` (intensity matrix + quote bank + codebook evolution + saturation summary)

**Prompt schema** (`PHASE6_PROMPT v1`):
```
SYSTEM:
You are a qualitative research writer. Write a concise thematic analysis report 
based on the structured data provided. The report should:
- Open with an overview of the corpus and codebook
- Have one section per main theme: findings across documents, intensity patterns, 
  top supporting quotes (max 3 per theme), notable sub-code discoveries
- Close with cross-cutting observations and emergent theme commentary
- Mention saturation point if detected
- Be written in formal academic prose, third person
- Do NOT invent findings not supported by the data

USER:
{ ... master_data.json ... }
```

**Report structure:**
1. Corpus overview (N docs, total word count, codebook summary)
2. Per-theme sections (one per main theme)
3. Emergent themes section (if any)
4. Cross-cutting observations
5. Codebook evolution log (table: what was added, when, triggered by)
6. Saturation note (if applicable)
7. Appendix: full quote bank

**Export:** Download as `.html` (self-contained with inline CSS) or trigger browser print dialog for PDF.

---

## 14. Engine Design Contract

Core pipeline function signature:

```typescript
runPipeline({
  apiKey: string,
  themes: string[],
  documents: { doc_id: string, text: string }[],
  onProgress: (status: ProgressStatus) => void
}) → Promise<master_data>
```

**Purpose:**
- Decouples UI from pipeline logic entirely
- Enables isolated unit testing of each phase
- `onProgress` callback drives all UI state updates (progress bar, evolution log, status messages, saturation signal)
- Pipeline is the single source of truth for sequencing; UI is purely reactive

**Supporting utilities (independently testable):**

```typescript
normalizeAndParse(raw: string, schema: Schema) → ParsedJSON
validateCodebook(codebook: Codebook) → ValidationResult
validateAnalysis(analysis: Analysis, codebook: Codebook) → ValidationResult
checkSaturation(logs: LogEntry[], threshold: number) → SaturationResult
buildMasterData(analyses: Analysis[], codebook: Codebook) → MasterData
```

---

## 15. Rate Limiting & Error Handling

| Scenario | Strategy |
|---|---|
| 429 Too Many Requests | Exponential backoff: 5s → 10s → 20s → 40s → fail with manual retry |
| 500 Server Error | Retry once after 3s; if fails again, show error + skip option |
| JSON parse failure | Normalization layer repairs; if unrecoverable, re-prompt once with stricter suffix |
| Schema validation failure | Phase gate retries once; if still invalid, mark document as "partial" and continue |
| PDF extraction failure | Warn user, allow skip or manual text paste fallback |
| Context length exceeded | Truncate PDF text to 100k tokens with a warning banner |
| Partial run interruption | Resume from `last_completed_doc` exactly via IndexedDB checkpoint |
| Cache corruption / version mismatch | Invalidate cache, prompt user to start fresh |
| User reload mid-analysis | Restore exact checkpoint from IndexedDB on next app load |

---

## 16. UI States

```
cache_detected → resume_prompt →
idle → uploading → extracting → phase2_loading → review_gate →
resuming → analyzing (1/10) → analyzing (2/10) → ... →
[saturation_signal] → aggregating → visualizing → report_generating → done
```

Each state has: progress indicator, estimated time, cancel option (where safe), error recovery.

---

## 17. Constraints & Limitations

- Max 10 PDFs per session
- Max ~100k tokens per PDF (Groq context window ceiling for safety)
- Themes file: 2–50 items
- No data persists after page refresh unless IndexedDB cache is present
- Groq free tier: ~6k TPM — large PDFs may be slow; paid tier recommended for production use
- Scanned/image-only PDFs not supported (PDF.js extracts text layer only)
- IndexedDB storage is browser-specific and not shared across users or devices
- Clearing browser data will remove all cached analysis and checkpoints
- Incognito / private browsing mode will not persist cache across sessions
- No server-side persistence — all data is local to the user's device

---

## 18. Out of Scope (v1)

- Multi-language corpus support
- Real-time collaboration
- Vector embeddings / semantic search
- Backend server / database persistence
- OAuth or user accounts
- Support for .docx / .epub input formats
- Per-document theme disabling (planned for v2 — see §12)

---

## 19. Open Questions

- [x] Should the review gate allow merging sub-codes? → **YES** (must-have — without this, the codebook becomes messy fast)
- [x] Radar chart subset selection? → **YES** (10 overlays = visual chaos; toggle per document in legend)
- [x] Quote bank sorting? → **By intensity first, then by document**
- [x] Mid-analysis review gate for emergent themes? → **NO** (breaks flow and hurts UX in v1 — use live evolution log instead)

---

## 20. Data Privacy & Security

- All processing occurs client-side in the browser
- No user data (PDFs, themes, API keys) is sent to any server except the Groq API
- API key is user-provided and never persisted to disk or IndexedDB
- Extracted document text is stored locally in IndexedDB only
- No cross-user data sharing is possible
- Application does not implement authentication (by design)

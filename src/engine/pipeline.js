/**
 * Core Pipeline Orchestrator
 */

import { callGroq } from './groqClient';
import { PHASE2_PROMPT_V1, PHASE3_PROMPT_V1, PHASE6_PROMPT_V1, buildPrompt } from './prompts';
import { normalizeAndParse } from './normalize';
import { validateCodebook, validateAnalysis } from './validators';
import { buildCodebookFromGen1, compressCodebook } from './codebookUtils';
import { stripAcademicNoise, getChunkedText, estimateTokens, calculateNextWait, sleep } from './textUtils';

/**
 * Tiered Model Strategy Configuration
 */
const MODEL_CONFIG = (selectedModel) => ({
  quality: selectedModel,
  bulk: 'llama-3.1-8b-instant',
  CHUNK_SIZE_TOKENS: 2000,
  CHUNK_OVERLAP_TOKENS: 300,
});

/**
 * Phase 2 Initial Codebook Generation
 * Takes Gen 1 themes + corpus preview to generate initial sub-codes.
 */
export async function generateInitialCodebook({ apiKey, model, themes, documents }) {
  const config = MODEL_CONFIG(model);
  // 1. Build Gen 1 Codebook baseline
  const baselineCodebook = buildCodebookFromGen1(themes);

  // 2. Prepare corpus sample (first ~300 words of each document)
  const samples = documents.map(doc => {
    const preview = doc.text.split(' ').slice(0, 300).join(' ');
    return `[${doc.name}]: "${preview}..."`;
  }).join('\n\n');

  // 3. Build Prompt
  // We pass the baseline themes with IDs so the LLM can reference them accurately.
  const themesForPrompt = baselineCodebook.themes.map(t => ({ id: t.id, label: t.label }));
  
  const systemPrompt = buildPrompt(PHASE2_PROMPT_V1, {
    themes: JSON.stringify(themesForPrompt),
    samples: samples
  });

  // 4. Call LLM
  const rawResponse = await callGroq({
    apiKey,
    model: config.quality,
    systemPrompt: systemPrompt,
    userPrompt: "Process the provided themes and corpus samples. Return the JSON object as specified in the system instructions."
  });

  console.log("=== THEMATICUS DEBUG: RAW LLM RESPONSE (PHASE 2) ===");
  console.log(rawResponse);
  console.log("====================================================");

  // 5. Normalize
  let parsed = normalizeAndParse(rawResponse);

  // 6. Validate & Fallback Logic
  if (!parsed.success) {
    // Retry once with strict suffix
    console.warn("Phase 2 Parse Failed. Retrying strictly...");
    const strictPrompt = systemPrompt + "\n\nCRITICAL REDIRECT: Return ONLY pure JSON. No markdown blocking. No conversation.";
    const retryRaw = await callGroq({ apiKey, model: config.quality, systemPrompt: strictPrompt, userPrompt: "Return ONLY the JSON object now." });
    console.log("=== THEMATICUS DEBUG: RAW LLM RETRY RESPONSE (PHASE 2) ===");
    console.log(retryRaw);
    console.log("==========================================================");
    parsed = normalizeAndParse(retryRaw);
    if (!parsed.success) {
      throw new Error(`Failed to generate codebook. LLM output malformed.\n\nRAW OUTPUT: ${retryRaw.substring(0, 500)}...`);
    }
  }

  const validation = validateCodebook(parsed.data, themes);
  if (!validation.valid) {
    console.error("=== THEMATICUS DEBUG: VALIDATION FAILED (PHASE 2) ===", validation.errors);
    throw new Error(`Codebook schema validation failed: ${validation.errors.join(", ")}`);
  }

  console.log("=== THEMATICUS DEBUG: PARSED & VALIDATED CODEBOOK (PHASE 2) ===", validation.cleanedData || parsed.data);

  // 7. Inject baseline properties and combine
  const groqThemes = parsed.data.themes;
  const normalizeId = (id) => id.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');

  groqThemes.forEach(t => {
    const gid = normalizeId(t.id);
    const baselineTheme = baselineCodebook.themes.find(bt => normalizeId(bt.id) === gid);
    
    if (baselineTheme) {
      baselineTheme.label = t.label;
      baselineTheme.original_label = t.original_label;
      baselineTheme.sub_codes = (t.sub_codes || []).map(sc => ({
        ...sc,
        id: normalizeId(sc.id || sc.label),
        generation: 2,
        source: 'groq_phase2'
      }));
    } else if (t.emergent) {
      baselineCodebook.themes.push({
        ...t,
        id: normalizeId(t.id || t.label),
        generation: 2,
        source: 'groq_phase2',
        emergent: true,
        triggered_by: ['corpus_preview'],
        original_label: t.original_label || t.label, // Em themes might not have original unless renamed
        sub_codes: (t.sub_codes || []).map(sc => ({
          ...sc,
          id: normalizeId(sc.id || sc.label),
          generation: 2,
          source: 'groq_phase2'
        }))
      });
    }
  });

  baselineCodebook.version = 2;
  return baselineCodebook;
}

/**
 * Phase 3 Sequential Document Analysis
 */
export async function processDocumentPhase3({ apiKey, model, document, currentCodebook, onProgress }) {
  const config = MODEL_CONFIG(model);

  // Layer 1: Noise Stripping
  const rawCharCount = document.text.length;
  const cleanedText = stripAcademicNoise(document.text);
  const cleanCharCount = cleanedText.length;
  const reduction = Math.round((1 - (cleanCharCount / rawCharCount)) * 100);
  
  if (onProgress) onProgress(`Layer 1: Noise stripping reduced text by ${reduction}% (${rawCharCount} -> ${cleanCharCount} chars).`);

  // Layer 2: Chunking Strategy
  const totalTokens = estimateTokens(cleanedText);
  const chunks = getChunkedText(cleanedText, config.CHUNK_SIZE_TOKENS, config.CHUNK_OVERLAP_TOKENS);
  
  if (onProgress) onProgress(`Layer 2: ${totalTokens} tokens. Processing in ${chunks.length} chunk(s) using ${config.bulk}.`);

  const minimalCodebook = compressCodebook(currentCodebook);
  const chunkResults = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkTokens = estimateTokens(chunk);
    
    if (chunks.length > 1 && onProgress) {
      onProgress(`Processing Chunk ${i + 1}/${chunks.length}... (${chunkTokens} tokens)`);
    }

    const systemPrompt = buildPrompt(PHASE3_PROMPT_V1, {
      codebook: minimalCodebook
    });

    const rawResponse = await callGroq({
      apiKey,
      model: config.bulk,
      systemPrompt: systemPrompt,
      userPrompt: `Document: ${document.name} (Part ${i+1}/${chunks.length})\nText:\n${chunk}`
    });

    let parsed = normalizeAndParse(rawResponse);

    if (!parsed.success) {
      if (onProgress) onProgress(`[Chunk ${i+1}] Parse Failed. Retrying strictly...`);
      const strictPrompt = systemPrompt + "\n\nCRITICAL REDIRECT: Return ONLY pure JSON matching the schema. No markdown blocking. No conversation.";
      const retryRaw = await callGroq({ 
        apiKey, 
        model: config.bulk, 
        systemPrompt: strictPrompt, 
        userPrompt: `Document: ${document.name} (Part ${i+1}/${chunks.length})\nText:\n${chunk}` 
      });
      parsed = normalizeAndParse(retryRaw);
      if (!parsed.success) {
        throw new Error(`Parse failed for ${document.name} Chunk ${i+1}. RAW OUTPUT: ${retryRaw.substring(0, 1000)}...`);
      }
    }

    // Tag provenance
    if (parsed.data.tags) {
      parsed.data.tags.forEach(t => t.chunk_index = i + 1);
    }
    chunkResults.push(parsed.data);

    // Strict Pacing: Wait after each chunk to avoid 429/413 on tight 6000 TPM tiers
    if (i < chunks.length - 1) {
      const waitTime = 30000; // 30 seconds
      if (onProgress) onProgress(`[Pacing] Waiting ${waitTime/1000}s to respect Groq rate limits...`);
      await sleep(waitTime);
    }
  }

  // Layer 4: Client-Side Merge Logic
  const masterAnalysis = {
    doc_summary: chunkResults.map(r => r.doc_summary).filter(Boolean).join("\n\n"),
    tags: [],
    new_sub_codes: [],
    emergent_themes: []
  };

  // Group tags by theme+subcode
  const tagGroups = {};
  chunkResults.flatMap(r => r.tags || []).forEach(t => {
    const key = `${t.theme_id}|${t.sub_code_id || ''}`;
    if (!tagGroups[key]) tagGroups[key] = [];
    tagGroups[key].push(t);
  });

  // Apply merge logic per group
  masterAnalysis.tags = Object.values(tagGroups).map(tags => ({
    theme_id: tags[0].theme_id,
    sub_code_id: tags[0].sub_code_id,
    intensity: Math.max(...tags.map(t => t.intensity || 1)),
    quotes: [...new Set(tags.flatMap(t => t.quotes || []))],
    context: tags.reduce((best, t) => 
      (t.context?.length || 0) > (best.context?.length || 0) ? t : best
    , tags[0]).context,
    chunk_sources: tags.map(t => t.chunk_index)
  }));

  // Merge new code suggestions (simple union, deduplicated by ID)
  chunkResults.forEach(r => {
    (r.new_sub_codes || []).forEach(sc => {
      if (!masterAnalysis.new_sub_codes.find(existing => existing.id === sc.id)) {
        masterAnalysis.new_sub_codes.push(sc);
      }
    });
    (r.emergent_themes || []).forEach(em => {
      if (!masterAnalysis.emergent_themes.find(existing => existing.id === em.id)) {
        masterAnalysis.emergent_themes.push(em);
      }
    });
  });

  // Final Validation
  const validation = validateAnalysis(masterAnalysis, currentCodebook);
  if (!validation.valid) {
    throw new Error(`Integrated Analysis validation failed for ${document.name}: ${validation.errors.join(", ")}`);
  }

  return validation.cleanedData;
}

/**
 * Phase 5 Final Report Generation
 */
export async function generateFinalReport({ apiKey, model, masterData }) {
  const config = MODEL_CONFIG(model);

  // Use a stringified version of master data, dropping raw document texts if present
  // To protect context limits, only pass the tags and codebook.
  const safeData = {
    codebook: masterData.codebook,
    analyses: {},
    theme_metrics: masterData.theme_metrics || {},
    saturationPoint: masterData.saturationPoint || null
  };
  
  for (const doc of Object.keys(masterData.analyses)) {
    if (!masterData.analyses[doc].error) {
      safeData.analyses[doc] = masterData.analyses[doc];
    }
  }

  const systemPrompt = buildPrompt(PHASE6_PROMPT_V1, {
    master_data: JSON.stringify(safeData, null, 2)
  });

  const rawResponse = await callGroq({
    apiKey,
    model: config.quality,
    systemPrompt: systemPrompt,
    userPrompt: "Generate the markdown thematic analysis report."
  });

  console.log("=== THEMATICUS DEBUG: RAW LLM RESPONSE (PHASE 5) ===");
  console.log(rawResponse);
  console.log("====================================================");

  return rawResponse.trim();
}

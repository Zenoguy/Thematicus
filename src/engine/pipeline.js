/**
 * Core Pipeline Orchestrator
 */

import { callGroq } from './groqClient';
import { PHASE2_PROMPT_V1, buildPrompt } from './prompts';
import { normalizeAndParse } from './normalize';
import { validateCodebook, validateAnalysis } from './validators';
import { buildCodebookFromGen1, compressCodebook } from './codebookUtils';

/**
 * Phase 2 Initial Codebook Generation
 * Takes Gen 1 themes + corpus preview to generate initial sub-codes.
 */
export async function generateInitialCodebook({ apiKey, model, themes, documents }) {
  // 1. Build Gen 1 Codebook baseline
  const baselineCodebook = buildCodebookFromGen1(themes);

  // 2. Prepare corpus sample (first ~300 words of each document)
  const samples = documents.map(doc => {
    const preview = doc.text.split(' ').slice(0, 300).join(' ');
    return `[${doc.name}]: "${preview}..."`;
  }).join('\n\n');

  // 3. Build Prompt
  const systemPrompt = buildPrompt(PHASE2_PROMPT_V1, {
    themes: JSON.stringify(themes),
    samples: samples
  });

  // 4. Call LLM
  const rawResponse = await callGroq({
    apiKey,
    model,
    systemPrompt: systemPrompt,
    userPrompt: "Please process the themes and corpus samples according to your system instructions."
  });

  // 5. Normalize
  let parsed = normalizeAndParse(rawResponse);

  // 6. Validate & Fallback Logic
  if (!parsed.success) {
    // Retry once with strict suffix
    console.warn("Phase 2 Parse Failed. Retrying strictly...");
    const strictPrompt = systemPrompt + "\n\nCRITICAL REDIRECT: Return ONLY pure JSON. No markdown blocking. No conversation.";
    const retryRaw = await callGroq({ apiKey, model, systemPrompt: strictPrompt, userPrompt: "Please process." });
    parsed = normalizeAndParse(retryRaw);
    if (!parsed.success) {
      throw new Error(`Failed to generate codebook. LLM output malformed.\n\n${retryRaw.substring(0, 200)}...`);
    }
  }

  const validation = validateCodebook(parsed.data, themes);
  if (!validation.valid) {
    throw new Error(`Codebook schema validation failed: ${validation.errors.join(", ")}`);
  }

  // 7. Inject baseline properties and combine
  const groqThemes = parsed.data.themes;
  groqThemes.forEach(t => {
    // LLM often fails to carry forward definitions or keywords for Gen 1, or mixes them.
    // The safest approach is applying changes to our baseline codebook layout.
    const baselineTheme = baselineCodebook.themes.find(bt => bt.id === t.id);
    if (baselineTheme) {
      baselineTheme.sub_codes = (t.sub_codes || []).map(sc => ({
        ...sc,
        generation: 2,
        source: 'groq_phase2'
      }));
    } else if (t.emergent) {
      baselineCodebook.themes.push({
        ...t,
        generation: 2,
        source: 'groq_phase2',
        emergent: true,
        triggered_by: ['corpus_preview'],
        sub_codes: []
      });
    }
  });

  baselineCodebook.version = 2;
  return baselineCodebook;
}

/**
 * Phase 3 Sequential Document Analysis
 */
export async function processDocumentPhase3({ apiKey, model, document, currentCodebook }) {
  // Compress codebook to save tokens
  const minimalCodebook = compressCodebook(currentCodebook);

  const systemPrompt = buildPrompt(PHASE3_PROMPT_V1, {
    codebook: minimalCodebook
  });

  const rawResponse = await callGroq({
    apiKey,
    model,
    systemPrompt: systemPrompt,
    userPrompt: `Document: ${document.name}\nText:\n${document.text}`
  });

  let parsed = normalizeAndParse(rawResponse);

  if (!parsed.success) {
    console.warn(`Phase 3 Parse Failed for ${document.name}. Retrying strictly...`);
    const strictPrompt = systemPrompt + "\n\nCRITICAL REDIRECT: Return ONLY pure JSON matching the schema. No markdown blocking. No conversation.";
    const retryRaw = await callGroq({ 
      apiKey, 
      model, 
      systemPrompt: strictPrompt, 
      userPrompt: `Document: ${document.name}\nText:\n${document.text}` 
    });
    parsed = normalizeAndParse(retryRaw);
    if (!parsed.success) {
      throw new Error(`Failed to parse analysis for ${document.name}. LLM output malformed.`);
    }
  }

  const validation = validateAnalysis(parsed.data, currentCodebook);
  if (!validation.valid) {
    throw new Error(`Analysis validation failed for ${document.name}: ${validation.errors.join(", ")}`);
  }

  return validation.cleanedData;
}

/**
 * Phase 5 Final Report Generation
 */
export async function generateFinalReport({ apiKey, model, masterData }) {
  // Use a stringified version of master data, dropping raw document texts if present
  // To protect context limits, only pass the tags and codebook.
  const safeData = {
    codebook: masterData.codebook,
    analyses: {}
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
    model,
    systemPrompt: systemPrompt,
    userPrompt: "Generate the markdown thematic analysis report."
  });

  return rawResponse.trim();
}

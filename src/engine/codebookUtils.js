/**
 * Codebook Utilities
 */

export function compressCodebook(codebook) {
  // Reduces token load for Phase 3
  const compressed = {
    version: codebook.version,
    themes: codebook.themes.map(t => ({
      theme_id: t.id,
      label: t.label,
      keywords: t.keywords.slice(0, 5), // Limit top 5
      sub_codes: (t.sub_codes || []).map(sc => ({
        id: sc.id,
        label: sc.label
      }))
    }))
  };
  return JSON.stringify(compressed, null, 2);
}

export function mergeNewCodes(codebook, newSubCodes = [], newEmergent = [], triggerDocId) {
  const updatedCodebook = JSON.parse(JSON.stringify(codebook)); // deep copy

  // Add new sub_codes
  for (const sub of newSubCodes) {
    const parent = updatedCodebook.themes.find(t => t.id === sub.parent_theme_id);
    if (parent) {
      if (!parent.sub_codes) parent.sub_codes = [];
      const exists = parent.sub_codes.find(sc => sc.id === sub.id);
      if (!exists) {
        parent.sub_codes.push({
          ...sub,
          generation: 3,
          source: "groq_phase3",
          triggered_by: [triggerDocId]
        });
      }
    }
  }

  // Add emergent themes
  for (const em of newEmergent) {
    const exists = updatedCodebook.themes.find(t => t.id === em.id);
    if (!exists) {
      updatedCodebook.themes.push({
        ...em,
        generation: 3,
        source: "groq_phase3",
        emergent: true,
        triggered_by: [triggerDocId],
        sub_codes: []
      });
    }
  }

  return updatedCodebook;
}

export function buildCodebookFromGen1(gen1Array) {
  return {
    version: 1,
    generated_at: new Date().toISOString(),
    themes: gen1Array.map(t => ({
      id: t.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      label: t,
      generation: 1,
      source: "user",
      definition: "User-defined primary theme.",
      keywords: [t.toLowerCase()],
      sub_codes: []
    }))
  };
}

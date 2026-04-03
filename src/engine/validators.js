/**
 * Quality Gates / Schema Validation
 */

export function validateCodebook(data, gen1Themes = []) {
  const errors = [];
  
  if (!data || !Array.isArray(data.themes)) {
    return { valid: false, errors: ["Codebook root must contain an array of 'themes'"] };
  }

  let emergentCount = 0;
  const idsFound = new Set();
  const gen1Ids = new Set(gen1Themes.map(t => t.toLowerCase().replace(/[^a-z0-9]/g, '_')));

  for (const t of data.themes) {
    if (!t.id || !t.label || !t.definition || !Array.isArray(t.keywords)) {
      errors.push(`Theme malformed: ${t.id || t.label || 'Unknown'}`);
    }
    
    // Check for Gen 1 duplicates that snuck in as emergent
    if (t.emergent && gen1Ids.has(t.id)) {
      errors.push(`Emergent theme ${t.id} is already a Gen 1 theme.`);
    }

    if (t.emergent) emergentCount++;
    idsFound.add(t.id);
  }

  if (emergentCount > 3) {
    errors.push(`Too many emergent themes (${emergentCount}). Maximum allowed is 3.`);
  }

  return { 
    valid: errors.length === 0, 
    errors 
  };
}

export function validateAnalysis(analysis, currentCodebook) {
  const errors = [];
  
  if (!analysis || !Array.isArray(analysis.tags)) {
    return { valid: false, errors: ["Analysis must contain an array of 'tags'"] };
  }

  const validThemeIds = new Set(currentCodebook.themes.map(t => t.id));

  // Validate tags
  const validTags = [];
  for (const tag of analysis.tags) {
    if (!validThemeIds.has(tag.theme_id)) {
      // Discard orphan tags silently per specs
      continue;
    }

    let intensity = parseInt(tag.intensity, 10) || 1;
    intensity = Math.max(1, Math.min(5, intensity));
    tag.intensity = intensity;

    if (intensity >= 3 && (!Array.isArray(tag.quotes) || tag.quotes.length === 0)) {
      errors.push(`Tag for ${tag.theme_id} has intensity ${intensity} but no quotes.`);
    }
    
    validTags.push(tag);
  }
  analysis.tags = validTags;

  // Validate new_sub_codes
  if (analysis.new_sub_codes) {
    const subCodesPerTheme = {};
    const validSubs = [];
    
    for (const sub of analysis.new_sub_codes) {
      if (!sub.id || !sub.label || !sub.parent_theme_id) {
        errors.push("new_sub_codes must have id, label, and parent_theme_id.");
        continue;
      }
      
      subCodesPerTheme[sub.parent_theme_id] = (subCodesPerTheme[sub.parent_theme_id] || 0) + 1;
      
      // Cap at 2 per document per theme
      if (subCodesPerTheme[sub.parent_theme_id] <= 2) {
        validSubs.push(sub);
      }
    }
    analysis.new_sub_codes = validSubs;
  }

  // Validate emergent_themes
  if (analysis.emergent_themes && analysis.emergent_themes.length > 0) {
    // Cap at 1 emergent theme per document
    if (analysis.emergent_themes.length > 1) {
      analysis.emergent_themes = [analysis.emergent_themes[0]];
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    cleanedData: analysis
  };
}

/**
 * Universal JSON Normalization Layer
 * Runs before any schema validation.
 */

export function normalizeAndParse(rawString) {
  let cleaned = rawString.trim();

  // Strip markdown formatting if the LLM output fenced code blocks
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/, '');
  }

  // Basic cleanup
  cleaned = cleaned.trim();

  try {
    const data = JSON.parse(cleaned);
    return { success: true, data, repaired: false };
  } catch (err) {
    // Attempt light repair: fix trailing commas in objects and arrays
    try {
      let repairedStr = cleaned
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');
      
      const data = JSON.parse(repairedStr);
      return { success: true, data, repaired: true };
    } catch (err2) {
      return { success: false, error: "JSON parsing failed even after light repair." };
    }
  }
}

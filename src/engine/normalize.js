/**
 * Universal JSON Normalization Layer
 * Runs before any schema validation.
 */

export function normalizeAndParse(rawString) {
  let cleaned = rawString.trim();

  // Try to find the first '{' and last '}' to extract the JSON object
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  // Basic cleanup for markdown remains if not caught by braces
  cleaned = cleaned.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();

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

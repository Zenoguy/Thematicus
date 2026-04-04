/**
 * Layer 1: Smart Academic Noise Stripping
 * Reduces token count by removing low-signal sections (Methods, References, Citations).
 */
const STRIP_PATTERNS = [
  /references?\s*\n[\s\S]*$/i,          // references to end of doc
  /\backnowledg\w+\b[\s\S]{0,2000}/gi,  // acknowledgements block
  /\bappendix\b[\s\S]{0,3000}/gi,       // appendices
  /\bmethods?\b[\s\S]{0,4000}/gi,       // methods section
  /figure\s+\d+[.:].{0,200}/gi,         // figure captions
  /table\s+\d+[.:].{0,500}/gi,          // table captions
  /doi:\s*\S+/gi,                        // DOI strings
  /https?:\/\/\S+/gi,                    // URLs
  /\[\d+\]/g,                            // citation markers [1], [23]
  /p\s*[<=>]\s*0\.\d+/gi,               // p-values
];

export function stripAcademicNoise(text) {
  let cleaned = text;
  for (const pattern of STRIP_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned.trim();
}

/**
 * Layer 2: Rolling Window Chunking
 * Splits text into segments while maintaining context through overlap.
 * Heuristic: 4 characters per token.
 */
export function getChunkedText(text, maxTokens = 3500, overlapTokens = 200) {
  const maxChars = maxTokens * 4;
  const overlapChars = overlapTokens * 4;
  
  if (text.length <= maxChars) return [text];

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxChars;
    
    // Boundary check
    if (end > text.length) end = text.length;

    const chunk = text.substring(start, end);
    chunks.push(chunk);

    if (end >= text.length) break;

    // Move start forward: next start is current end minus overlap
    start = end - overlapChars;
    
    // Safety: ensure we actually move forward
    if (start < 0) start = 0; 
  }

  return chunks;
}

/**
 * Layer 3: Token Estimation
 * Deterministic pacing support.
 */
export function estimateTokens(text) {
  // Common heuristic for English: 4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Pacing helper: Wait based on token budget
 * Limit 12000 TPM
 */
export async function calculateNextWait(tokenCount, tpmLimit = 12000) {
  // tokens / limit = fraction of a minute
  const waitMs = (tokenCount / tpmLimit) * 60 * 1000;
  return Math.ceil(waitMs);
}

export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

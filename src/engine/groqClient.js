/**
 * Groq API Integration Layer
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function callGroq({ apiKey, model, systemPrompt, userPrompt }) {
  if (!apiKey) throw new Error("Groq API key is missing.");

  // Roughly guard against 100k tokens (assume ~4 chars per token -> 400,000 chars)
  const MAX_CHARS = 400000;
  let safeUserPrompt = userPrompt;
  if (userPrompt.length > MAX_CHARS) {
    console.warn(`Input truncated! Context exceeded ${MAX_CHARS} characters.`);
    safeUserPrompt = userPrompt.substring(0, MAX_CHARS) + "\n\n[TRUNCATED FOR CONTEXT LIMIT...]";
  }

  const performRequest = async () => {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        temperature: 0.1, // Keep it relatively deterministic for qualitative coding
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: safeUserPrompt }
        ]
      })
    });

    if (!res.ok) {
      if (res.status === 429) {
        throw { status: 429, message: "Rate limit exceeded" };
      }
      if (res.status >= 500) {
        throw { status: res.status, message: `Server error: ${res.statusText}` };
      }
      const errText = await res.text();
      throw new Error(`Groq API Error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  };

  // === Retry Strategy ===
  let attempts = 0;
  const max429Retries = 4;
  const backoffSchedule = [5000, 10000, 20000, 40000]; // 5s, 10s, 20s, 40s
  
  let has500Retried = false;

  while (true) {
    try {
      // Impose a baseline minimum 2s delay between sequential calls locally
      await sleep(2000); 
      const result = await performRequest();
      return result;

    } catch (err) {
      if (err.status === 429) {
        if (attempts < max429Retries) {
          const waitTime = backoffSchedule[attempts];
          console.warn(`Groq 429 Rate Limit. Retrying in ${waitTime/1000}s...`);
          await sleep(waitTime);
          attempts++;
          continue;
        } else {
          throw new Error("Groq API rate limit exceeded. Max retries exhausted.");
        }
      }

      if (err.status >= 500 && !has500Retried) {
        console.warn(`Groq 500 Server Error. Retrying once after 3s...`);
        has500Retried = true;
        await sleep(3000);
        continue;
      }

      throw err;
    }
  }
}

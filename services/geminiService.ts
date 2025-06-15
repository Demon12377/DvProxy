// src/services/geminiService.ts

export function parseGeminiJsonResponse<T>(responseText: string): T | T[] | null {
  let jsonStr = responseText.trim();
  // Regex to remove markdown fences (```json ... ``` or ``` ... ```)
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s; 
  const match = jsonStr.match(fenceRegex);
  if (match && match[2]) {
    jsonStr = match[2].trim();
  }

  try {
    const parsedData = JSON.parse(jsonStr);
    return parsedData as T | T[];
  } catch (e) {
    console.error("Failed to parse JSON response from Gemini:", e, "Original text:", responseText);
    // Attempt to clean up common JSON issues like trailing commas
    try {
      const cleanedJsonStr = jsonStr
        .replace(/,\s*}/g, '}') // Remove trailing comma before closing brace
        .replace(/,\s*]/g, ']'); // Remove trailing comma before closing bracket
      const parsedDataStrict = JSON.parse(cleanedJsonStr);
      console.warn("Successfully parsed JSON after cleaning trailing commas.");
      return parsedDataStrict as T | T[];
    } catch (e2) {
      console.error("Failed to parse JSON response even after cleaning trailing commas:", e2, "Cleaned text:", jsonStr);
      return null;
    }
  }
}
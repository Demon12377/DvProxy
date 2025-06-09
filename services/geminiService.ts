// This file is currently a placeholder.
// The Gemini API interactions are mostly within App.tsx for direct state manipulation.
// If more complex, reusable Gemini logic emerges, it can be moved here.

// Example: Helper function for parsing JSON from Gemini response (already in App.tsx or similar if needed)
export function parseGeminiJsonResponse<T>(responseText: string): T | T[] | null {
  let jsonStr = responseText.trim();
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
    try {
      const cleanedJsonStr = jsonStr
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');
      const parsedDataStrict = JSON.parse(cleanedJsonStr);
      return parsedDataStrict as T | T[];
    } catch (e2) {
      console.error("Failed to parse JSON response even after cleaning:", e2, "Cleaned text:", jsonStr);
      return null;
    }
  }
}

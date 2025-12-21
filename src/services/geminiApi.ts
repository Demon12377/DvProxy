import { Persona } from '../config/personas';
import { DvachPost, Part, AppSettings } from '../core/types';
import { GoogleGenAI } from '@google/genai';

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
      console.warn("Successfully parsed JSON after cleaning trailing commas.");
      return parsedDataStrict as T | T[];
    } catch (e2) {
      console.error("Failed to parse JSON response even after cleaning trailing commas:", e2, "Cleaned text:", jsonStr);
      return null;
    }
  }
}

export async function generateReply(
  ai: GoogleGenAI,
  settings: AppSettings,
  persona: Persona,
  conversationWindow: DvachPost[],
  targetPost: DvachPost,
  mediaParts: Part[]
): Promise<string> {
  const model = ai.getGenerativeModel({ model: settings.geminiTextModel });

  const history = conversationWindow.map(p => ({
    role: "user", // Simplified for now
    parts: [{ text: `>>${p.num}: ${p.comment.replace(/<[^>]*>?/gm, '')}` }]
  }));

  const userPrompt = `You are on an imageboard. Reply to this post:\n>>${targetPost.num}: ${targetPost.comment.replace(/<[^>]*>?/gm, '')}`;

  const contents = [
    ...history,
    { role: "user", parts: [...mediaParts, { text: userPrompt }] }
  ];

  const result = await model.generateContent({
    contents: contents,
    systemInstruction: {
        role: "system",
        parts: [{text: persona.systemInstruction}]
    },
    generationConfig: {
      temperature: settings.geminiTemperature,
      topP: settings.geminiTopP,
      topK: settings.geminiTopK,
      maxOutputTokens: settings.geminiMaxOutputTokens,
      responseMimeType: 'application/json',
    },
  });

  const responseText = result.response.text();
  const parsed = parseGeminiJsonResponse<{ replyText: string }>(responseText);
  if (!parsed || typeof parsed.replyText !== 'string') {
    throw new Error('Invalid JSON response from Gemini or missing replyText.');
  }
  return parsed.replyText;
}

export async function generateInitialPost(
  ai: GoogleGenAI,
  settings: AppSettings,
  persona: Persona,
  opPost: DvachPost
): Promise<string> {
  const model = ai.getGenerativeModel({ model: settings.geminiTextModel });
  const userPrompt = `You are on an imageboard. The thread opening post is:\n>>${opPost.num}: ${opPost.comment.replace(/<[^>]*>?/gm, '')}\n\nGenerate an initial comment to start a conversation.`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    systemInstruction: {
        role: "system",
        parts: [{text: persona.systemInstruction}]
    },
    generationConfig: {
        temperature: settings.geminiTemperature,
        topP: settings.geminiTopP,
        topK: settings.geminiTopK,
        maxOutputTokens: settings.geminiMaxOutputTokens,
        responseMimeType: 'application/json',
    },
  });

  const responseText = result.response.text();
  const parsed = parseGeminiJsonResponse<{ replyText: string }>(responseText);
    if (!parsed || typeof parsed.replyText !== 'string') {
    throw new Error('Invalid JSON response from Gemini or missing replyText.');
  }
  return parsed.replyText;
}

export async function generateAggregatedReply(
  ai: GoogleGenAI,
  settings: AppSettings,
  persona: Persona,
  originalPost: DvachPost,
  replies: DvachPost[]
): Promise<string> {
  const model = ai.getGenerativeModel({ model: settings.geminiTextModel });
  const repliesText = replies.map(r => `>>${r.num} says: "${r.comment.replace(/<[^>]*>?/gm, '')}"`).join('\n\n');
  const userPrompt = `You are on an imageboard. Your post >>${originalPost.num} received several replies:\n\n${repliesText}\n\nGenerate a single, aggregated reply that addresses all of them in the standard imageboard format (e.g., ">>1111\\nReply to 1\\n\\n>>2222\\nReply to 2").`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    systemInstruction: {
        role: "system",
        parts: [{text: persona.systemInstruction}]
    },
    generationConfig: {
      temperature: settings.geminiTemperature,
      topP: settings.geminiTopP,
      topK: settings.geminiTopK,
      maxOutputTokens: settings.geminiMaxOutputTokens,
      responseMimeType: 'application/json',
    },
  });

  const responseText = result.response.text();
  const parsed = parseGeminiJsonResponse<{ replyText: string }>(responseText);
    if (!parsed || typeof parsed.replyText !== 'string') {
    throw new Error('Invalid JSON response from Gemini or missing replyText.');
  }
  return parsed.replyText;
}
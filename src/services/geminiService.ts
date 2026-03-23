import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface WordInfo {
  meaning: string;
  synonyms: string[];
  antonyms: string[];
  exampleSentence: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export async function getWordInfo(word: string): Promise<WordInfo> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Provide the meaning, synonyms, antonyms, an example sentence, and a difficulty level (easy, medium, or hard) for the word: "${word}".`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          meaning: {
            type: Type.STRING,
            description: "A clear and concise definition of the word.",
          },
          synonyms: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "A list of synonyms for the word.",
          },
          antonyms: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "A list of antonyms for the word.",
          },
          exampleSentence: {
            type: Type.STRING,
            description: "An example sentence using the word.",
          },
          difficulty: {
            type: Type.STRING,
            enum: ["easy", "medium", "hard"],
            description: "The difficulty level of the word.",
          },
        },
        required: ["meaning", "synonyms", "antonyms", "exampleSentence", "difficulty"],
      },
    },
  });

  try {
    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr) as WordInfo;
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error("Failed to get word info from AI.");
  }
}

import { GoogleGenAI } from "@google/genai";
import { ExtractionResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function extractQueueData(file: File): Promise<ExtractionResult> {
  const reader = new FileReader();
  const base64Promise = new Promise<string>((resolve) => {
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });

  const base64Data = await base64Promise;

  const prompt = `
    Analyze this screenshot from Dazhong Dianping (Meituan) for "Kao Jiang Spicy Grilled Fish" (烤匠麻辣烤鱼).
    Extract the following information:
    - City (Shanghai, Beijing, or Xi'an)
    - Specific store name
    - Queue breakdown (table type and count from '排XX桌')
    - Time shown on the screenshot page
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { text: prompt },
        {
          inlineData: {
            data: base64Data,
            mimeType: file.type
          }
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          city: { type: "STRING" },
          storeName: { type: "STRING" },
          queues: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                tableType: { type: "STRING" },
                queueCount: { type: "INTEGER" }
              },
              required: ["tableType", "queueCount"]
            }
          },
          pageTime: { type: "STRING" }
        },
        required: ["city", "storeName", "queues", "pageTime"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No data returned from AI");

  try {
    return JSON.parse(text) as ExtractionResult;
  } catch (error) {
    console.error("Failed to parse Gemini response", text);
    throw new Error("Failed to extract structured data");
  }
}

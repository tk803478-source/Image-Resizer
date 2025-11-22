import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AIAnalysisResult } from '../types';

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeImage = async (base64Data: string, mimeType: string): Promise<AIAnalysisResult> => {
  try {
    // Strip the data URL prefix to get just the base64 string if present
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, "");

    const model = 'gemini-2.5-flash';
    
    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        description: { type: Type.STRING },
        keywords: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING } 
        },
        ecoTip: { type: Type.STRING }
      },
      required: ['description', 'keywords', 'ecoTip'],
    };

    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Content
            }
          },
          {
            text: `Analyze this image. 
            1. Provide a short, descriptive alt-text suitable for accessibility. 
            2. Extract 3-5 relevant keywords.
            3. Provide a short, fun "eco-friendly" or "nature-inspired" metaphor or tip related to the visual content if possible. If not, just a general eco-tip.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as AIAnalysisResult;
    }
    
    throw new Error("No response received from Gemini.");
  } catch (error) {
    console.error("Analysis failed:", error);
    // Return a safe fallback to keep UI functional
    return {
      description: "Image analysis unavailable.",
      keywords: ["error", "retry"],
      ecoTip: "Nature takes its time, and sometimes so do servers. Please try again."
    };
  }
};
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface Recipe {
  name: string;
  type: string;
  ingredients: string[];
  method: string;
  cookingTime: string;
  tips: string[];
}

export interface AnalysisResponse {
  identifiedIngredients: string[];
  recipes: Recipe[];
  chefsTip: string;
}

export async function analyzeFridgeImage(base64Image: string, mimeType: string): Promise<AnalysisResponse> {
  const model = "gemini-3-flash-preview";

  const systemInstruction = `
    You are an expert Culinary AI with a deep understanding of both Indian and International cuisines.
    Analyze the image of a refrigerator provided.
    1. Identify all visible ingredients (vegetables, dairy, eggs, leftovers, etc.).
    2. Suggest 5 distinct recipes. Provide a mix of:
       - Authentic Indian dishes (Poha, Dal, Sabzi, Roti, etc.)
       - Popular International dishes (Pasta, Sandwich, Salad, etc.)
    3. If the user context seems Indian, prioritize wholesome Indian fusion recipes.
    4. Assume basic pantry staples like salt, oil, turmeric, spices are available.
    5. Language for names and methods: Hinglish (Hindi words in English script for a friendly Indian tone).
    6. Method should be very detailed and provided as a structured numbered list (point-wise).
    7. For each recipe, provide an estimated 'cookingTime' (e.g., '15 mins', '30 mins').
    8. For each recipe, provide 3-4 specific 'tips' (good advice, hacks, or flavor boosters) in a point-wise detailed manner.
    9. Provide a creative general 'Chef's Tip' at the end that covers food waste or flavor enhancement.
    10. Tone: Professional, slightly witty, and very helpful.
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      identifiedIngredients: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "List of ingredients found in the image."
      },
      recipes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Catchy Hinglish name for the dish." },
            type: { type: Type.STRING, description: "Category of the recipe." },
            ingredients: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Ingredients used." },
            method: { type: Type.STRING, description: "Detailed steps in Hinglish." },
            cookingTime: { type: Type.STRING, description: "Est. time (e.g. 20 mins)." },
            tips: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Detailed point-wise pro tips for this specific recipe." }
          },
          required: ["name", "type", "ingredients", "method", "cookingTime", "tips"]
        }
      },
      chefsTip: { type: Type.STRING, description: "Witty chef's tip." }
    },
    required: ["identifiedIngredients", "recipes", "chefsTip"]
  };

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType } },
        { text: "Identify ingredients and suggest 5 different recipes (Indian + Global) based on available items." }
      ]
    },
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema
    }
  });

  // MOBILE FIX: Safe parsing
  const responseText = response.text?.trim();

  if (!responseText) {
    throw new Error("Empty response from AI server");
  }

  try {
    return JSON.parse(responseText);
  } catch (error) {
    console.error("Response text:", responseText.substring(0, 200));
    throw new Error("Invalid response format from AI server");
  }
}

export async function analyzeIngredientsText(text: string): Promise<AnalysisResponse> {
  const model = "gemini-3-flash-preview";

  const systemInstruction = `
    You are an expert Culinary AI with a deep understanding of both Indian and International cuisines.
    You will receive a list of ingredients or a description of what is available.
    1. Identify all mentioned ingredients clearly.
    2. Suggest 5 distinct recipes. Provide a mix of:
       - Authentic Indian dishes (Poha, Dal, Sabzi, Roti, etc.)
       - Popular International dishes (Pasta, Sandwich, Salad, etc.)
    3. Prioritize wholesome Indian fusion recipes if relevant.
    4. Assume basic pantry staples like salt, oil, turmeric, spices are available.
    5. Language for names and methods: Hinglish (Hindi words in English script for a friendly Indian tone).
    6. Method should be very detailed and provided as a structured numbered list (point-wise).
    7. For each recipe, provide an estimated 'cookingTime' (e.g., '15 mins', '30 mins').
    8. For each recipe, provide 3-4 specific 'tips' (good advice, hacks, or flavor boosters) in a point-wise detailed manner.
    9. Provide a creative general 'Chef's Tip' at the end that covers food waste or flavor enhancement.
    10. Tone: Professional, slightly witty, and very helpful.
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      identifiedIngredients: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "List of ingredients identified from the text."
      },
      recipes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Catchy Hinglish name for the dish." },
            type: { type: Type.STRING, description: "Category of the recipe." },
            ingredients: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Ingredients used." },
            method: { type: Type.STRING, description: "Detailed steps in Hinglish." },
            cookingTime: { type: Type.STRING, description: "Est. time (e.g. 20 mins)." },
            tips: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Detailed point-wise pro tips for this specific recipe." }
          },
          required: ["name", "type", "ingredients", "method", "cookingTime", "tips"]
        }
      },
      chefsTip: { type: Type.STRING, description: "Witty chef's tip." }
    },
    required: ["identifiedIngredients", "recipes", "chefsTip"]
  };

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { text: `Ingredients list: ${text}` }
      ]
    },
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema
    }
  });

  const responseText = response.text?.trim();

  if (!responseText) {
    throw new Error("Empty response from AI server");
  }

  try {
    return JSON.parse(responseText);
  } catch (error) {
    console.error("Response text:", responseText.substring(0, 200));
    throw new Error("Invalid response format from AI server");
  }
}

import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface Recipe {
  name: string;
  type: "Breakfast" | "Snack" | "Main Course";
  ingredients: string[];
  method: string;
}

export interface AnalysisResponse {
  identifiedIngredients: string[];
  recipes: Recipe[];
  chefsTip: string;
}

export async function analyzeFridgeImage(base64Image: string, mimeType: string): Promise<AnalysisResponse> {
  const model = "gemini-3-flash-preview";

  const systemInstruction = `
    You are an expert Indian Fusion Chef. 
    Analyze the image of a refrigerator provided.
    1. Identify all visible ingredients (vegetables, dairy, eggs, leftovers, etc.).
    2. Suggest 3 distinct recipes: one quick breakfast, one healthy snack, and one main course.
    3. Use Indian fusion style.
    4. Assume basic pantry staples like salt, oil, turmeric, cumin, mustard seeds, etc., are available.
    5. The recipes must use the identified ingredients from the photo.
    6. Language for names and methods: Hinglish (Hindi words in English script where appropriate for a friendly Indian tone).
    7. Method should be very detailed and provided as a structured numbered list (point-wise). Start each step on a new line.
    8. Each step should be descriptive, explaining the 'how' and 'why' in Hinglish. Include "Pro-Tips" (like flame control, oil seasoning) within the steps.
    9. Provide a creative 'Chef's Tip' at the end that covers food waste or flavor enhancement.
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
            type: { type: Type.STRING, enum: ["Breakfast", "Snack", "Main Course"] },
            ingredients: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Ingredients used from the fridge." },
            method: { type: Type.STRING, description: "Step-by-step cooking method in Hinglish." }
          },
          required: ["name", "type", "ingredients", "method"]
        }
      },
      chefsTip: { type: Type.STRING, description: "Witty and helpful chef's tip." }
    },
    required: ["identifiedIngredients", "recipes", "chefsTip"]
  };

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType } },
        { text: "Identify ingredients and suggest 3 Indian fusion recipes as per the instructions." }
      ]
    },
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema
    }
  });

  return JSON.parse(response.text || "{}");
}

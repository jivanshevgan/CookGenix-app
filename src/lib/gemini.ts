import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface RecipeStep {
  text: string;
  visualPrompt: string;
}

export interface Recipe {
  name: string;
  type: string;
  ingredients: string[];
  method: string; // Maintain for backward compatibility
  steps: RecipeStep[];
  cookingTime: string;
  tips: string[];
  dishImagePrompt: string;
  mainImageUrl?: string; // Optional field to store generated URL
}

export interface AnalysisResponse {
  identifiedIngredients: string[];
  recipes: Recipe[];
  chefsTip: string;
}

/**
 * Generates an image based on a text prompt using Gemini's image generation capabilities.
 */
export async function generateRecipeImage(prompt: string): Promise<string> {
  const model = "gemini-2.5-flash-image";
  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data returned from model");
  } catch (error) {
    console.error("Image generation failed:", error);
    // Fallback to a placeholder if generation fails
    return `https://picsum.photos/seed/${encodeURIComponent(prompt.substring(0, 10))}/400/400`;
  }
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
    6. Provide a detailed 'method' string (as before) AND a 'steps' array.
    7. Each entry in 'steps' must have:
       - 'text': The instruction for that step.
       - 'visualPrompt': A highly descriptive, photorealistic prompt for an image generator showing this specific cooking step (e.g., "A close-up shot of chopped onions being sautéed in a steel pan with golden oil, steam rising, warm kitchen lighting").
    8. Provide a 'dishImagePrompt': A descriptive prompt for a final plated shot of the dish.
    9. For each recipe, provide an estimated 'cookingTime' (e.g., '15 mins', '30 mins').
    10. For each recipe, provide 3-4 specific 'tips' (good advice, hacks, or flavor boosters).
    11. Provide a creative general 'Chef's Tip' at the end.
    12. Tone: Professional, slightly witty, and very helpful.
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
            method: { type: Type.STRING, description: "Detailed steps in Hinglish as a single string." },
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  visualPrompt: { type: Type.STRING, description: "Descriptive image prompt for this step." }
                },
                required: ["text", "visualPrompt"]
              }
            },
            dishImagePrompt: { type: Type.STRING, description: "Image prompt for the final dish." },
            cookingTime: { type: Type.STRING, description: "Est. time (e.g. 20 mins)." },
            tips: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Detailed point-wise pro tips for this specific recipe." }
          },
          required: ["name", "type", "ingredients", "method", "steps", "dishImagePrompt", "cookingTime", "tips"]
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
    6. Provide a detailed 'method' string AND a 'steps' array.
    7. Each entry in 'steps' must have:
       - 'text': The instruction for that step.
       - 'visualPrompt': A highly descriptive, photorealistic prompt for an image generator (e.g., "A clean wooden board with freshly chopped vibrant vegetables and a sharp knife, natural window light").
    8. Provide a 'dishImagePrompt': A descriptive prompt for a final plated shot of the dish.
    9. For each recipe, provide an estimated 'cookingTime' (e.g., '15 mins', '30 mins').
    10. For each recipe, provide 3-4 specific 'tips'.
    11. Provide a creative general 'Chef's Tip' at the end.
    12. Tone: Professional, slightly witty, and very helpful.
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
            method: { type: Type.STRING, description: "Detailed steps in Hinglish as a single string." },
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  visualPrompt: { type: Type.STRING, description: "Descriptive image prompt for this step." }
                },
                required: ["text", "visualPrompt"]
              }
            },
            dishImagePrompt: { type: Type.STRING, description: "Image prompt for the final dish." },
            cookingTime: { type: Type.STRING, description: "Est. time (e.g. 20 mins)." },
            tips: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Detailed point-wise pro tips for this specific recipe." }
          },
          required: ["name", "type", "ingredients", "method", "steps", "dishImagePrompt", "cookingTime", "tips"]
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

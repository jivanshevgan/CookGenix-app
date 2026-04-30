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
  nutrition?: {
    calories: number;
    protein: string;
    fat: string;
    carbs: string;
  };
}

export interface AnalysisResponse {
  identifiedIngredients: string[];
  recipes: Recipe[];
  chefsTip: string;
}

/**
 * Generates an image based on a text prompt.
 * In this environment, we use keyword-based placeholder services for consistency 
 * unless a dedicated image generation model is confirmed.
 */
export async function generateRecipeImage(prompt: string, dishName?: string): Promise<string> {
  // Use pollinations.ai for much higher quality dish-specific images
  // We refine the prompt to ensure it focuses on the food
  const extractedDishName = dishName || (prompt.match(/dish: (.*?),/i) || prompt.match(/shot of (.*?),/i))?.[1] || "delicious food dish";
  
  // Combine dish name with descriptive details from the prompt for maximum accuracy
  // We clean up the prompt to remove unnecessary formatting
  const descriptiveDetails = prompt
    .replace(/dish: .*?,/i, "")
    .replace(/shot of .*?,/i, "")
    .substring(0, 200); 

  const refinedPrompt = encodeURIComponent(`Professional food photography, ${extractedDishName}, ${descriptiveDetails}, gourmet plating, high resolution, 8k, ultra-realistic, warm lighting, appetizing, depth of field`);
  
  return `https://image.pollinations.ai/prompt/${refinedPrompt}?width=800&height=600&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
}

export async function getIngredientSubstitute(ingredient: string, dishContext: string): Promise<string> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `You are a professional chef. A user is making "${dishContext}" but is missing the ingredient "${ingredient}". 
  Provide one or two best possible substitutes available in an Indian kitchen. 
  Keep the response very short (under 15 words) and helpful.
  Format: "Try [Sub1] or [Sub2] because [Reason]."`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [{ text: prompt }]
      }
    });
    return response.text?.trim() || "Try skipping it or using a neutral oil/base.";
  } catch (error) {
    console.error("Substitution failed:", error);
    return "Try skipping it or using a neutral oil/base.";
  }
}

export async function customizeRecipe(recipe: Recipe, customRequest: string): Promise<Recipe> {
  const model = "gemini-3-flash-preview";

  const systemInstruction = `
    You are an expert Chef. You will receive a recipe and a request to modify it.
    Return a NEW JSON object that follows the exact same Recipe schema.
    Maintain the Hinglish tone. Ensure all fields (name, ingredients, steps, cookingTime, tips, nutrition) are updated to reflect the change.
    Do not include any text outside the JSON object.
  `;

  const recipeSchema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      type: { type: Type.STRING },
      ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
      method: { type: Type.STRING },
      steps: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            visualPrompt: { type: Type.STRING }
          },
          required: ["text", "visualPrompt"]
        }
      },
      dishImagePrompt: { type: Type.STRING },
      cookingTime: { type: Type.STRING },
      tips: { type: Type.ARRAY, items: { type: Type.STRING } },
      nutrition: {
        type: Type.OBJECT,
        properties: {
          calories: { type: Type.NUMBER },
          protein: { type: Type.STRING },
          fat: { type: Type.STRING },
          carbs: { type: Type.STRING }
        },
        required: ["calories", "protein", "fat", "carbs"]
      }
    },
    required: ["name", "type", "ingredients", "method", "steps", "dishImagePrompt", "cookingTime", "tips", "nutrition"]
  };

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [{ text: `Recipe: ${JSON.stringify(recipe)}\nRequest: ${customRequest}` }]
      },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: recipeSchema
      }
    });
    
    let text = response.text?.trim();
    if (!text) throw new Error("No response from AI");
    
    // Strip markdown JSON blocks if present
    if (text.startsWith("```json")) {
      text = text.replace(/^```json\n?/, "").replace(/\n?```$/, "");
    } else if (text.startsWith("```")) {
      text = text.replace(/^```\n?/, "").replace(/\n?```$/, "");
    }
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Customization failed:", error);
    throw error;
  }
}

export async function analyzeFridgeImage(base64Image: string, mimeType: string): Promise<AnalysisResponse> {
  const model = "gemini-3-flash-preview";

  const systemInstruction = `
    You are an expert Indian Culinary AI with a deep understanding of traditional and modern Indian home cooking.
    Analyze the image of a refrigerator provided.
    1. Identify all visible ingredients (vegetables, dairy, eggs, leftovers, etc.).
    2. Suggest 5 distinct recipes. Focus heavily on:
       - Simple, everyday Indian dishes (e.g., Aloo Ki Sabzi, Dal Fry, Masala Omelette, Poha).
       - Ensure dish names are Indian and VERY simple to understand for a regular person.
       - You can include 1 or 2 popular fusion dishes if they use common Indian ingredients.
    3. Prioritize "Ghar ka khana" (home-cooked style) that is healthy and easy to make.
    4. Assume basic pantry staples like salt, oil, turmeric, cumin, mustard seeds, and basic masalas are available.
    5. Language for names and methods: Hinglish (Hindi words in English script for a friendly, relatable Indian tone).
    6. Ensure the 'name' of the dish is catchy but clear (e.g., "Chatpata Paneer Bhurji" instead of "Spiced Cottage Cheese Crumble").
    6. Provide a detailed 'method' string (as before) AND a 'steps' array.
    7. Each entry in 'steps' must have:
       - 'text': The instruction for that step. Be VERY detailed and descriptive. Aim for at least 7-10 steps for a comprehensive guide.
       - 'visualPrompt': A cinematic, hyper-realistic, close-up food photography prompt for this step. Include sensory details like "sizzling", "vibrant colors", "steam rising", "golden-brown texture", "glistening oil", and "natural soft kitchen lighting". Specify the action (e.g., "A macro shot of hand-tempering mustard seeds in hot oil").
    8. Provide a 'dishImagePrompt': A stunning, professional food photography prompt for the final plated dish. Start with "Dish: [Dish Name], ...". Describe the plating in detail (e.g., "served in a traditional brass bowl", "garnished with fresh micro-coriander and a swirl of cream"), the lighting (e.g., "warm golden hour lighting"), the background (e.g., "rustic dark wood setting"), and the overall mood (e.g., "cozy, appetizing, gourmet").
    9. For each recipe, provide an estimated 'cookingTime' (e.g., '15 mins', '30 mins').
    10. For each recipe, provide 3-4 specific 'tips' (good advice, hacks, or flavor boosters).
    11. MANDATORY NUTRITION: provide 'nutrition' with 'calories' (number), 'protein' (e.g., "12g"), 'fat' (e.g., "8g"), 'carbs' (e.g., "25g").
    12. Provide a creative general 'Chef's Tip' at the end.
    13. Tone: Professional, slightly witty, and very helpful.
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
            tips: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Detailed point-wise pro tips for this specific recipe." },
            nutrition: {
              type: Type.OBJECT,
              properties: {
                calories: { type: Type.NUMBER },
                protein: { type: Type.STRING },
                fat: { type: Type.STRING },
                carbs: { type: Type.STRING }
              },
              required: ["calories", "protein", "fat", "carbs"]
            }
          },
          required: ["name", "type", "ingredients", "method", "steps", "dishImagePrompt", "cookingTime", "tips", "nutrition"]
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

export async function analyzeIngredientsText(text: string, goal?: string): Promise<AnalysisResponse> {
  const model = "gemini-3-flash-preview";

  const goalInstruction = goal ? `The user's dietary goal is: ${goal}. Ensure recipes are optimized for this goal (e.g., higher protein for 'Muscle Gain', lower calories/carbs for 'Weight Loss').` : "";

  const systemInstruction = `
    You are an expert Indian Culinary AI specializing in simple Indian home-style cooking.
    You will receive a list of ingredients or a description of what is available.
    ${goalInstruction}
    1. Identify all mentioned ingredients clearly.
    2. Suggest 5 distinct recipes. Focus heavily on:
       - Simple, everyday Indian home dishes (e.g., Jeera Aloo, Mix Veg, Egg Curry, Tadka Dal).
       - Ensure dish names are simple Indian names that are easy to understand.
       - Avoid overly complex or fancy international names.
    3. Prioritize wholesome Indian recipes that can be made quickly.
    4. Assume basic Indian pantry staples like salt, oil, turmeric, and local spices are available.
    5. Language for names and methods: Hinglish (Hindi words in English script for a friendly, relatable Indian tone).
    6. Ensure the 'name' of the dish is simple and descriptive (e.g., "Masala Pulao" or "Aloo Matar").
    6. Provide a detailed 'method' string AND a 'steps' array.
    7. Each entry in 'steps' must have:
       - 'text': The instruction for that step. Be VERY detailed and descriptive. Aim for at least 7-10 steps for a comprehensive guide.
       - 'visualPrompt': A cinematic, hyper-realistic, close-up food photography prompt for this step. Include sensory details like "sizzling", "vibrant colors", "steam rising", "golden-brown texture", "glistening oil", and "natural soft kitchen lighting". Specify the action (e.g., "A macro shot of hand-tempering mustard seeds in hot oil").
    8. Provide a 'dishImagePrompt': A stunning, professional food photography prompt for the final plated dish. Start with "Dish: [Dish Name], ...". Describe the plating in detail (e.g., "served in a traditional brass bowl", "garnished with fresh micro-coriander and a swirl of cream"), the lighting (e.g., "warm golden hour lighting"), the background (e.g., "rustic dark wood setting"), and the overall mood (e.g., "cozy, appetizing, gourmet").
    9. For each recipe, provide an estimated 'cookingTime' (e.g., '15 mins', '30 mins').
    10. For each recipe, provide 3-4 specific 'tips'.
    11. MANDATORY NUTRITION: provide 'nutrition' with 'calories' (number), 'protein' (e.g., "12g"), 'fat' (e.g., "8g"), 'carbs' (e.g., "25g").
    12. Provide a creative general 'Chef's Tip' at the end.
    13. Tone: Professional, slightly witty, and very helpful.
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
            tips: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Detailed point-wise pro tips for this specific recipe." },
            nutrition: {
              type: Type.OBJECT,
              properties: {
                calories: { type: Type.NUMBER },
                protein: { type: Type.STRING },
                fat: { type: Type.STRING },
                carbs: { type: Type.STRING }
              },
              required: ["calories", "protein", "fat", "carbs"]
            }
          },
          required: ["name", "type", "ingredients", "method", "steps", "dishImagePrompt", "cookingTime", "tips", "nutrition"]
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

import { GoogleGenAI, Type } from "@google/genai";
import { Presentation } from "../types";

export const generatePresentationContent = async (text: string): Promise<Presentation> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-flash-preview';
  
  const prompt = `Ushbu matn asosida zamonaviy va professional taqdimot tuzilmasini yarating: "${text.substring(0, 4000)}".
  
  Ko'rsatmalar:
  1. Til: Matn qaysi tilda bo'lsa, o'sha tilda javob bering.
  2. Slaydlar: 7-8 ta slayd.
  3. Layout: Har bir slayd uchun 'steps', 'comparison', 'grid', 'classic' yoki 'process' turlaridan birini tanlang.
  4. Ikonkalar: Har bir band uchun mos Lucide-react ikonka nomini kiriting.
  5. Tasvir Promptlari: Har bir slayd uchun 'description' maydoniga ushbu slayd mavzusiga mos keladigan batafsil inglizcha rasm chizish buyrug'ini yozing.
  6. Rang: Taqdimot uchun mos professional hex rang (themeColor) tanlang.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          mainTitle: { type: Type.STRING },
          subtitle: { type: Type.STRING },
          themeColor: { type: Type.STRING },
          coverImagePrompt: { type: Type.STRING },
          slides: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                layout: { type: Type.STRING, enum: ['steps', 'comparison', 'grid', 'classic', 'process'] },
                description: { type: Type.STRING },
                content: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING },
                      icon: { type: Type.STRING }
                    },
                    required: ["text", "icon"]
                  }
                }
              },
              required: ["title", "layout", "content", "description"]
            }
          }
        },
        required: ["mainTitle", "subtitle", "slides", "themeColor", "coverImagePrompt"]
      }
    }
  });

  const output = response.text;
  if (!output) throw new Error("AI response empty");
  
  return JSON.parse(output) as Presentation;
};

export const generateImage = async (prompt: string): Promise<string | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `High-quality professional 4k presentation slide illustration for: ${prompt}. Minimalist, clean corporate style.` }]
      }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (e) {
    console.error("Image generation failed:", e);
    return null;
  }
};
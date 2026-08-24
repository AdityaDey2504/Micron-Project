import genAI from "../../config/gemini.js";
import { CHAT_MODEL } from "../../utils/constants.js";

export async function getBasicResponse(userMessage) {
  const response = await genAI.models.generateContent({
    model: CHAT_MODEL,
    contents: userMessage,
  });
  return response.text;
}

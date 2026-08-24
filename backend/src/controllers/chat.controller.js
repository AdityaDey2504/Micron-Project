import { getBasicResponse } from "../services/ai/orchestrator.js";

export async function handleChat(req, res) {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    const responseText = await getBasicResponse(message);
    res.json({ response: responseText });
  } catch (error) {
    console.error("Error in chat controller:", error);
    res.status(500).json({ error: "Failed to process chat message" });
  }
}

import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

// Initialize Gemini if key is present
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

export async function generateAIInsights(structuredData) {
  // Return fallback if no AI key is configured
  if (!genAI) {
    return {
      strengths: ["Data analysis pending", "Good baseline"],
      weaknesses: ["Waiting for AI integration"],
      learningPattern: "Consistent",
      areasForImprovement: ["Requires API Key"],
      personalizedSuggestions: ["Configure GEMINI_API_KEY in .env to enable AI insights."],
      summary: "AI Insights are currently unavailable due to missing configuration."
    };
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    You are an expert educational AI assistant.
    Given the following structured findings about a student's performance, behavior, and attendance, generate a professional academic insights report.
    
    Structured Data:
    ${JSON.stringify(structuredData, null, 2)}
    
    IMPORTANT RULES:
    1. Respond ONLY with a valid JSON object.
    2. Do NOT wrap the JSON in markdown blocks (e.g. no \`\`\`json). Just return the raw JSON string.
    3. The JSON MUST exactly match the following structure:
    {
      "strengths": ["string", "string"],
      "weaknesses": ["string", "string"],
      "learningPattern": "string (e.g. Visual Learner, Consistent progress, etc)",
      "areasForImprovement": ["string", "string"],
      "personalizedSuggestions": ["string", "string"],
      "summary": "string (A 2-3 sentence overall summary of the student)"
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    let text = result.response.text();
    
    // Clean up potential markdown formatting from AI output
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Failed to generate AI insights:", error);
    throw new Error("Failed to generate AI insights");
  }
}

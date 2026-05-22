export async function generateAIInsights(structuredData) {
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
    const response = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistral",
        prompt: prompt,
        stream: false,
        format: "json"
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const result = await response.json();
    let text = result.response;
    
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    console.error("Failed to generate AI insights via Ollama:", error.message);
    
    // Dynamic Fallback based on structuredData
    const att = structuredData?.attendance || 0;
    const max = structuredData?.academic_metrics?.totalMax || 0;
    const obt = structuredData?.academic_metrics?.totalObtained || 0;
    const academicPct = max > 0 ? (obt / max) * 100 : 0;
    
    let summary = `Student achieved an academic score of ${academicPct.toFixed(1)}% and maintains an attendance rate of ${att}%.`;
    let strengths = [];
    let weaknesses = [];
    let suggestions = [];
    
    if (academicPct >= 80) {
      strengths.push("Excellent overall academic performance.");
      summary += " They show strong conceptual understanding across subjects.";
    } else if (academicPct >= 60) {
      strengths.push("Satisfactory academic baseline.");
      weaknesses.push("Opportunity for higher scores with targeted practice.");
      summary += " Performance is steady, but there is room for improvement.";
      suggestions.push("Focus on daily revisions.");
    } else {
      weaknesses.push("Below average academic performance.");
      summary += " Immediate academic intervention and extra tutoring are recommended.";
      suggestions.push("Attend remedial classes.", "Dedicate more time to self-study.");
    }
    
    if (att < 75) {
      weaknesses.push(`Low attendance (${att}%).`);
      suggestions.push("Improve daily school attendance to avoid missing core concepts.");
    } else {
      strengths.push(`Good attendance (${att}%).`);
    }

    return {
      strengths: strengths.length > 0 ? strengths : ["Consistent effort"],
      weaknesses: weaknesses.length > 0 ? weaknesses : ["Needs structured study plan"],
      learningPattern: academicPct >= 75 ? "Quick Grasp" : "Needs Reinforcement",
      areasForImprovement: weaknesses,
      personalizedSuggestions: suggestions.length > 0 ? suggestions : ["Continue with current study habits."],
      summary: summary
    };
  }
}

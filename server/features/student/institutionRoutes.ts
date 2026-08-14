import express from "express";
import { GoogleGenAI } from "@google/genai";
const router = express.Router();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
const institutionCache: Record<string, string[]> = {};
// Autocomplete and fetch all matching educational institutions (schools & colleges) in India dynamically using Gemini
router.get("/suggest-institutions", async (req, res) => {
  const { q, type } = req.query;
  const queryText = typeof q === 'string' ? q.trim() : "";
  const instType = typeof type === 'string' ? type.trim() : "school";

  if (!queryText) {
    return res.json({ success: true, suggestions: [] });
  }

  // Check cache first to avoid redundant API calls
  const cacheKey = `${instType}:${queryText.toLowerCase()}`;
  if (institutionCache[cacheKey]) {
    return res.json({ success: true, suggestions: institutionCache[cacheKey] });
  }

  try {
    const prompt = `
You are a helpful database assistant specialized in Indian Education. 
Your task is to act as an auto-completion engine for names of educational institutions in India.

User Input Prefix: "${queryText}"
Institution Type: "${instType === 'school' ? 'school (High School / Higher Secondary / Junior College / boards like CBSE, ICSE, State Boards / Vidyalayas)' : 'college (Undergraduate / Postgraduate / Polytechnic / Engineering / Arts & Science / Masters / Universities)'}"

Rules:
1. Return exactly 6 to 10 highly relevant, real existing ${instType === 'school' ? 'schools' : 'colleges'} in India matching or containing this text prefix/pattern.
2. Ensure their names are accurate, well-formatted, and localized to India (e.g. including their city, state, or board abbreviation to be extremely clear and precise, e.g. "Delhi Public School (DPS), Dwarka", "DAV Public School, Solapur", "Walchand Institute of Technology (WIT), Solapur", "Indian Institute of Technology (IIT) Bombay, Mumbai").
3. Ensure to spell out or format the names elegantly, avoiding generic repeating names.
4. If the input is super short (like "V" or "D"), suggest famous Indian institutions starting with that letter.
5. You must output a raw JSON array of strings only. No markdown formatting, no explanation, no backticks.

Example format:
[
  "Institution Name 1, City",
  "Institution Name 2, City"
]
`;

    const aiResult = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const rawText = aiResult.text || "[]";
    const cleanedJson = rawText.replace(/```json\n?|```/gi, "").trim();
    let suggestions = JSON.parse(cleanedJson);

    if (!Array.isArray(suggestions)) {
      suggestions = [];
    }

    // Cache the result
    institutionCache[cacheKey] = suggestions;

    res.json({ success: true, suggestions });
  } catch (error) {
    console.error("Institution suggestion error:", error);
    // Return a safe matching fallback list if AI fails (e.g. key/rate issues)
    const fallbackList = instType === 'school' ? [
      "Central Board of Secondary Education (CBSE)",
      "Indian Certificate of Secondary Education (ICSE)",
      "Maharashtra State Board of Secondary and Higher Secondary Education (MSBSHSE)",
      "DAV Public School, Pune",
      "DAV Public School, Solapur",
      "Delhi Public School (DPS)",
      "Kendriya Vidyalaya, Solapur",
      "St. Xavier's High School, Mumbai",
      "Little Flower Convent School, Solapur",
      "Podar International School, Solapur"
    ] : [
      "Walchand Institute of Technology (WIT), Solapur",
      "Solapur Institute of Technology, Solapur",
      "Orchid College of Engineering, Solapur",
      "Indian Institute of Technology (IIT) Bombay, Mumbai",
      "Savitribai Phule Pune University, Pune",
      "College of Engineering Pune (COEP), Pune",
      "Veermata Jijabai Technological Institute (VJTI), Mumbai",
      "Vellore Institute of Technology (VIT), Vellore",
      "SRM Institute of Science and Technology, Chennai",
      "Symbiosis Institute of Technology, Pune"
    ];

    const filteredFallback = fallbackList.filter(item => 
      item.toLowerCase().includes(queryText.toLowerCase())
    );

    res.json({ success: true, suggestions: filteredFallback.length > 0 ? filteredFallback : fallbackList.slice(0, 5) });
  }
});

// Activity Logging Endpoint

export default router;

import { GoogleGenAI } from "@google/genai";
import { TAX_RULES } from "../config/taxRules";
import { TaxAnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const TAX_MODEL = "gemini-3.1-pro-preview";

const TAX_RULES_CONTEXT = JSON.stringify(TAX_RULES.FY_2024_25, null, 2);

export async function analyzeTaxDocuments(
  userProfile: any,
  documentTexts: string[]
): Promise<TaxAnalysisResult> {
  const prompt = `
    You are a professional Indian Tax Advisor specializing in Income Tax (FY 2024-25).
    Analyze the following user profile and document content for a salaried individual.
    
    User Profile:
    ${JSON.stringify(userProfile, null, 2)}
    
    Document Context:
    ${documentTexts.join("\n\n---\n\n")}
    
    Requirements:
    1. Every insight MUST reference specific Indian Tax Law (e.g., Section 80C, 80D, 87A, 115BAC).
    2. Provide a structured "actionPlan" which is a step-by-step guide.
    3. Calculate an overall audit risk score (0-100).
    4. EXTRACT KEY FINANCIAL VALUES: If the documents contain specific figures for Salary (Gross), TDS, Section 80C, Section 80D, Section 24 (Housing Loan), HRA, or NPS, extract them accurately into the "extractedValues" object.
    5. Identify missed deductions based on these Indian Tax Rules:
       ${TAX_RULES_CONTEXT}
    6. Determine the "Next Best Action" with potential ₹ savings based on the above rules.
    7. If data is missing for a specific step, the "action" should reflect "Requires more data".
    8. BE RUTHLESSLY ACCURATE with the extraction. If a value is ambiguous, do not extract it.
    
    Format the output as a valid JSON object matching the TaxAnalysisResult interface.
    Do not include any extra text outside the JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: TAX_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
}

export async function chatWithAssistant(
  userProfile: any,
  history: { role: 'user' | 'model', parts: { text: string }[] }[],
  message: string
) {
  const chat = ai.chats.create({
    model: TAX_MODEL,
    config: {
      systemInstruction: `You are a RUTHLESS tax strategist specializing in Indian income tax (FY 2024-25).
      Your goal is to maximize the client's wealth by legally minimizing tax liability to the absolute limit.
      Tone: Sharp, clinical, and authoritative. NO fluff, NO pleasantries, NO emojis. Talk like a top-tier private wealth advisor.

      INDIAN TAX RULES (FY 2024-25) CONTEXT:
      ${TAX_RULES_CONTEXT}

      YOUR ARSENAL (User Profile & Analysis):
      ${JSON.stringify(userProfile)}

      RESPONSE RIGIDITY (MANDATORY):
      1. Direct Answer -> 1 sentence. Hit the point immediately.
      2. Explanation -> 2 sentences max. Focus on the mechanics of the law (80C, 80D, 87A, 24b, etc.).
      3. Next Action -> Single clear imperative (e.g., "Invest ₹1.5L in ELSS", "Switch to New Regime").
      4. Risk Guard -> Mention the audit risk or legal boundary.

      CONSTRAINTS:
      - Max 75 words per response. Total brevity.
      - If data is missing (e.g., specific income), state: "INSUFFICIENT DATA: Provide [Value] for a precise answer."
      - Always use ₹ for amounts.
      - Never suggest illegal evasion. If a user asks for something illegal, tell them why it's a "tax suicide mission".

      ENDING (MANDATORY):
      Always end with: "Decision remains with you. Consult a CA before execution."`,
    },
    history: history
  });

  const response = await chat.sendMessage({ message });
  return response.text;
}

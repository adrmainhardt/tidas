import { GoogleGenAI } from "@google/genai";
import { FormSubmission } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeForms = async (forms: FormSubmission[]): Promise<string> => {
  try {
    const formSummary = forms.map(f => 
      `- De: ${f.senderName} (${f.senderEmail}) | Mensagem: "${f.message}" | Data: ${f.timestamp.toLocaleString()}`
    ).join('\n');

    const prompt = `
      Você é um assistente inteligente de gestão de sites. 
      Analise as seguintes submissões de formulário de contato recentes dos sites monitorados:

      ${formSummary}

      Por favor, forneça um resumo executivo curto em português. 
      1. Identifique qual mensagem parece ser a oportunidade de negócio mais urgente ou importante (Lead Quente).
      2. Resuma o sentimento geral das mensagens.
      3. Sugira uma ação rápida para o proprietário do site.
      
      Use formatação Markdown simples.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 } 
      }
    });

    return response.text || "Não foi possível gerar a análise no momento.";
  } catch (error) {
    console.error("Erro ao analisar formulários com Gemini:", error);
    return "Erro ao conectar com o assistente inteligente. Verifique sua chave API.";
  }
};
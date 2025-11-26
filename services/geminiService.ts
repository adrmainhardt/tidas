

import { GoogleGenAI } from "@google/genai";
import { FormSubmission } from "../types";
import { FALLBACK_API_KEY } from "../constants";

// Função auxiliar para garantir que temos uma chave
const getApiKey = (): string | undefined => {
  // Prioriza a variável de ambiente (Web), mas usa o fallback do constants.ts (Mobile/PWA)
  let key = process.env.API_KEY;
  
  if (!key || key.trim() === '') {
      key = FALLBACK_API_KEY;
  }
  
  return (key && key.trim() !== '') ? key : undefined;
};

export const analyzeForms = async (forms: FormSubmission[]): Promise<string> => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) return "Erro: Configure FALLBACK_API_KEY no constants.ts";

    const ai = new GoogleGenAI({ apiKey });
    
    const formSummary = forms.map(f => 
      `- De: ${f.senderName} (${f.senderEmail}) | Mensagem: "${f.message}" | Data: ${f.timestamp.toLocaleString()}`
    ).join('\n');

    const prompt = `
      Analise estas mensagens de formulário de contato:
      ${formSummary}

      Resuma a oportunidade mais urgente e o sentimento geral em português.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Análise indisponível.";
  } catch (error: any) {
    console.error("Erro Gemini Forms:", error);
    return `Erro: ${error.message || 'Falha na IA'}`;
  }
};

export const generateDashboardInsight = async (context: {
    sites: string[],
    forms: string[],
    emails: string[],
    trello: number,
    weather?: string
}): Promise<string> => {
    
    const apiKey = getApiKey();

    if (!apiKey) {
        throw new Error("API Key ausente. Configure 'FALLBACK_API_KEY' no arquivo constants.ts.");
    }

    try {
        const ai = new GoogleGenAI({ apiKey });

        const siteText = context.sites?.length ? context.sites.join(', ') : "Todos online.";
        const formText = context.forms?.length ? context.forms.join('; ') : "Sem mensagens.";
        const emailText = context.emails?.length ? context.emails.join('; ') : "Sem urgências.";
        const trelloText = context.trello > 0 ? `${context.trello} tarefas.` : "Trello em dia.";
        const weatherText = context.weather || "Clima desconhecido.";

        const prompt = `
        Atue como assistente pessoal (Tidas).
        DADOS:
        - Clima: ${weatherText}
        - Sites: ${siteText}
        - Inbox: ${formText} // ${emailText}
        - Trello: ${trelloText}

        INSTRUÇÃO:
        Crie um resumo executivo de 3 linhas em Português.
        Considere a previsão do tempo para a semana ao dar conselhos.
        Se houver chuva ou site offline, priorize isso.
        Seja direto.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        if (!response.text) {
            throw new Error("IA retornou vazio.");
        }

        return response.text;
    } catch (error: any) {
        console.error("Erro detalhado Insight:", error);
        
        let message = error.message || error.toString();
        
        if (message.includes("API key") || message.includes("403")) {
            throw new Error("Chave API recusada. Verifique constants.ts.");
        }
        if (message.includes("fetch")) {
             throw new Error("Sem internet.");
        }
        if (message.includes("quota")) {
             throw new Error("Cota excedida (429).");
        }
        throw new Error("Erro na IA: " + message.substring(0, 30));
    }
}
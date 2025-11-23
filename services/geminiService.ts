import { GoogleGenAI } from "@google/genai";
import { FormSubmission } from "../types";

export const analyzeForms = async (forms: FormSubmission[]): Promise<string> => {
  try {
    if (!process.env.API_KEY) return "Chave de API não configurada.";

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
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
  } catch (error) {
    console.error("Erro Gemini Forms:", error);
    return "Erro na IA.";
  }
};

export const generateDashboardInsight = async (context: {
    sites: string[],
    forms: string[],
    emails: string[],
    events: string[],
    trello: number
}): Promise<string> => {
    try {
        if (!process.env.API_KEY) {
            throw new Error("API_KEY_MISSING");
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const siteText = context.sites?.length ? context.sites.join(', ') : "Nenhum site.";
        const formText = context.forms?.length ? context.forms.join('; ') : "Sem mensagens.";
        const emailText = context.emails?.length ? context.emails.join('; ') : "Sem emails importantes.";
        const eventText = context.events?.length ? context.events.join('; ') : "Agenda livre.";
        const trelloText = `${context.trello || 0} cartões.`;

        const prompt = `
        Você é um assistente pessoal executivo. Gere um "Insight do Dia" curto e direto (máx 3 frases) com base nisto:
        
        SITES: ${siteText}
        MSGS: ${formText}
        EMAILS: ${emailText}
        AGENDA: ${eventText}
        TRELLO: ${trelloText}

        Priorize o que for urgente (site offline, reunião próxima). Se tudo estiver calmo, dê um resumo motivacional breve.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text || "A IA retornou uma resposta vazia.";
    } catch (error: any) {
        console.error("Erro detalhado insight:", error);
        return "Insight indisponível no momento.";
    }
}
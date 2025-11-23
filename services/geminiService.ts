
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
            throw new Error("API Key não encontrada no ambiente.");
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const siteText = context.sites?.length ? context.sites.join(', ') : "Nenhum site monitorado.";
        const formText = context.forms?.length ? context.forms.join('; ') : "Nenhuma mensagem nova.";
        const emailText = context.emails?.length ? context.emails.join('; ') : "Sem emails não lidos.";
        const eventText = context.events?.length ? context.events.join('; ') : "Agenda livre.";
        const trelloText = `${context.trello || 0} cartões pendentes.`;

        const prompt = `
        Atue como um assistente pessoal executivo eficiente.
        Gere um "Resumo do Dia" curto (máximo 2 linhas) baseado nestes dados:
        
        SITES: ${siteText}
        MSGS: ${formText}
        EMAILS: ${emailText}
        AGENDA: ${eventText}
        TRELLO: ${trelloText}

        Se houver problemas (sites offline), priorize isso. Caso contrário, dê um status geral positivo.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        if (!response.text) {
            throw new Error("Resposta vazia da IA.");
        }

        return response.text;
    } catch (error: any) {
        console.error("Erro detalhado Insight:", error);
        
        let msg = "Insight indisponível.";
        if (error.message.includes("API Key")) msg = "Erro: Chave API ausente.";
        else if (error.message.includes("Quota")) msg = "Cota da IA excedida.";
        else if (error.message.includes("fetch")) msg = "Erro de conexão.";
        else if (error.toString().includes("403")) msg = "Acesso negado (403).";
        
        // Retorna a mensagem de erro para ser exibida na UI
        throw new Error(msg);
    }
}

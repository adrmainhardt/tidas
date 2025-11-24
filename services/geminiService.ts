
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
    trello: number,
    weather?: string
}): Promise<string> => {
    try {
        if (!process.env.API_KEY) {
            throw new Error("API Key ausente/inválida.");
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const siteText = context.sites?.length ? context.sites.join(', ') : "Todos online.";
        const formText = context.forms?.length ? context.forms.join('; ') : "Sem mensagens críticas.";
        const emailText = context.emails?.length ? context.emails.join('; ') : "Caixa de entrada limpa.";
        const eventText = context.events?.length ? context.events.join('; ') : "Agenda livre.";
        const trelloText = context.trello > 0 ? `${context.trello} tarefas pendentes.` : "Tudo em dia no Trello.";
        const weatherText = context.weather || "Clima não informado.";

        const prompt = `
        Atue como um assistente executivo de elite. Analise TODOS os dados abaixo para gerar um "Briefing Matinal" estratégico e direto (máximo 3 frases curtas).

        DADOS:
        - Clima/Previsão: ${weatherText}
        - Agenda: ${eventText}
        - Sites: ${siteText}
        - Mensagens/Emails: ${formText} // ${emailText}
        - Tarefas: ${trelloText}

        INSTRUÇÃO:
        1. Comece comentando o clima e como ele afeta o dia (ex: "Dia chuvoso, ideal para focar no escritório").
        2. Destaque o compromisso ou problema mais urgente (Sites offline > Reuniões > Emails).
        3. Termine com uma frase motivadora ou de foco.
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
        // Tenta extrair mensagens de erro mais úteis para o usuário mobile
        if (error.message) {
            if (error.message.includes("API Key")) msg = "Erro: Chave API ausente.";
            else if (error.message.includes("Quota")) msg = "Limite de uso da IA atingido.";
            else if (error.message.includes("Failed to fetch")) msg = "Sem conexão com a IA.";
            else if (error.toString().includes("403")) msg = "Acesso negado à IA (403).";
        }
        
        throw new Error(msg);
    }
}

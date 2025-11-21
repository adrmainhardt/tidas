
import { GoogleGenAI } from "@google/genai";
import { FormSubmission } from "../types";

// Recuperação segura da chave
const getApiKey = () => {
  try {
    return (typeof process !== 'undefined' && process.env && process.env.API_KEY) ? process.env.API_KEY : '';
  } catch (e) {
    return '';
  }
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

export const analyzeForms = async (forms: FormSubmission[]): Promise<string> => {
  try {
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
        const siteText = context.sites?.length ? context.sites.join(', ') : "Nenhum site.";
        const formText = context.forms?.length ? context.forms.join('; ') : "Sem mensagens.";
        const emailText = context.emails?.length ? context.emails.join('; ') : "Sem emails importantes.";
        const eventText = context.events?.length ? context.events.join('; ') : "Agenda livre.";
        const trelloText = `${context.trello || 0} cartões.`;

        const prompt = `
        Você é um assistente pessoal. Gere um "Insight do Dia" (máx 3 frases) com base nisto:
        
        SITES: ${siteText}
        MSGS: ${formText}
        EMAILS: ${emailText}
        AGENDA: ${eventText}
        TRELLO: ${trelloText}

        Destaque APENAS o que é crítico/urgente. Se nada urgente, frase motivacional curta.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        if (!response.text) {
            return "A IA retornou uma resposta vazia.";
        }

        return response.text;
    } catch (error: any) {
        console.error("Erro detalhado insight:", error);
        
        // Retorna mensagem de erro amigável baseada no erro real
        if (error.toString().includes("API_KEY")) return "Erro: Chave API inválida ou não configurada.";
        if (error.toString().includes("429")) return "Erro: Muitos pedidos (Cota excedida).";
        if (error.toString().includes("fetch")) return "Erro de conexão com a IA.";
        
        return `Não foi possível gerar o insight: ${error.message || 'Erro desconhecido'}`;
    }
}



import { GoogleGenAI } from "@google/genai";
import { FormSubmission } from "../types";

export const analyzeForms = async (forms: FormSubmission[]): Promise<string> => {
  try {
    if (!process.env.API_KEY) return "Erro: API Key não configurada no arquivo .env ou ambiente.";

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
  } catch (error: any) {
    console.error("Erro Gemini Forms:", error);
    return `Erro: ${error.message || 'Falha na IA'}`;
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
        // Verificação explícita da chave antes de tentar chamar
        // Isso é crucial para debug no celular
        if (!process.env.API_KEY) {
            throw new Error("API_KEY não encontrada. Verifique as variáveis de ambiente ou o arquivo .env.");
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const siteText = context.sites?.length ? context.sites.join(', ') : "Todos online.";
        const formText = context.forms?.length ? context.forms.join('; ') : "Sem mensagens novas.";
        const emailText = context.emails?.length ? context.emails.join('; ') : "Sem e-mails urgentes.";
        const eventText = context.events?.length ? context.events.join('; ') : "Agenda livre hoje.";
        const trelloText = context.trello > 0 ? `${context.trello} tarefas pendentes.` : "Sem pendências no Trello.";
        const weatherText = context.weather || "Dados de clima indisponíveis.";

        const prompt = `
        Você é um assistente pessoal inteligente (Briefing Executivo).
        
        DADOS ATUAIS:
        1. Clima e Previsão Semanal: ${weatherText}
        2. Agenda Hoje: ${eventText}
        3. Status Sites: ${siteText}
        4. Mensagens/Emails Recentes: ${formText} // ${emailText}
        5. Tarefas Pendentes: ${trelloText}

        OBJETIVO:
        Gere um resumo curto (máximo 3 a 4 linhas) em texto corrido.
        
        REGRAS:
        - OBRIGATÓRIO: Relacione o clima da semana com a agenda/tarefas se houver eventos relevantes (ex: "Chuva na terça pode afetar a reunião externa...").
        - Se houver previsão de mudança drástica de tempo na semana, avise.
        - Priorize problemas críticos (Site Offline) acima de tudo.
        - Tom de voz: Profissional e direto.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        if (!response.text) {
            throw new Error("A IA retornou uma resposta vazia.");
        }

        return response.text;
    } catch (error: any) {
        console.error("Erro detalhado Insight:", error);
        
        // Retorna o erro REAL para facilitar o debug na tela do usuário no celular
        let message = error.message || error.toString();
        
        if (message.includes("API key not valid") || message.includes("API_KEY")) {
            throw new Error("Chave de API inválida ou ausente.");
        }
        
        if (message.includes("fetch")) {
             throw new Error("Erro de conexão. Verifique a internet.");
        }

        throw new Error(message);
    }
}
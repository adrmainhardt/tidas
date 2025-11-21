
import { GoogleGenAI } from "@google/genai";
import { FormSubmission } from "../types";

// Safe key retrieval to prevent crash if process is undefined
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
    return "Erro ao conectar com o assistente inteligente.";
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
        const prompt = `
        Você é um "Gerente Digital Pessoal" altamente eficiente. Crie um resumo "Insight" do dia para o usuário com base nestes dados:

        STATUS DOS SITES:
        ${context.sites.join('\n')}

        MENSAGENS RECEBIDAS (Últimas):
        ${context.forms.length > 0 ? context.forms.join('\n') : "Nenhuma mensagem nova."}

        E-MAILS NÃO LIDOS (Top 5):
        ${context.emails.length > 0 ? context.emails.join('\n') : "Caixa de entrada limpa."}

        AGENDA (Hoje):
        ${context.events.length > 0 ? context.events.join('\n') : "Sem eventos hoje."}

        TRELLO:
        ${context.trello} cartões novos ou atualizados recentemente.

        INSTRUÇÃO:
        Gere um texto curto (max 100 palavras) e direto.
        1. Comece com um status geral (ex: "Tudo tranquilo" ou "Atenção necessária").
        2. Destaque apenas o que for urgente (site offline, lead quente, reunião próxima).
        3. Se tudo estiver calmo, dê um tom positivo.
        Use emojis moderadamente. Não use saudações longas.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });

        return response.text || "Sem insights no momento.";
    } catch (error) {
        console.warn("Erro insight:", error);
        return "Não foi possível gerar o insight no momento.";
    }
}

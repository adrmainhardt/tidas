
import { GoogleGenAI } from "@google/genai";
import { FormSubmission } from "../types";
import { FALLBACK_API_KEY } from "../constants";

// Função auxiliar para garantir que temos uma chave
const getApiKey = (): string | undefined => {
  let key: string | undefined = undefined;
  
  // Tenta ler do process.env de forma segura
  try {
     // @ts-ignore
     if (typeof process !== 'undefined' && process.env) {
        key = process.env.API_KEY;
     }
  } catch (e) {
     // Ignora erro de acesso ao process
  }
  
  // Se não tem no env, usa o fallback do arquivo constants
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
}, apiKeyOverride?: string): Promise<string> => {
    
    // Lógica principal: Usa a chave do Override (Configurações) -> Env -> Fallback
    const apiKey = (apiKeyOverride && apiKeyOverride.trim() !== '') ? apiKeyOverride : getApiKey();

    if (!apiKey) {
        throw new Error("API Key ausente. Configure nas Engrenagem > Credenciais.");
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
        
        // Tratamento de erros comuns em Mobile
        if (message.includes("API key") || message.includes("403")) {
            throw new Error("Chave inválida ou bloqueada. Toque na engrenagem para configurar sua própria chave.");
        }
        if (message.includes("fetch") || message.includes("Failed to fetch")) {
             throw new Error("Erro de conexão. Verifique sua internet.");
        }
        if (message.includes("quota") || message.includes("429")) {
             throw new Error("Cota da API excedida.");
        }
        
        throw new Error(message.substring(0, 50));
    }
}

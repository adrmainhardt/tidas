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

export const calculateCommuteTime = async (): Promise<string> => {
  if (!process.env.API_KEY) return "Erro API Key";

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Endereços exatos extraídos do link do Maps fornecido
    const origin = "Tidas - Avenida Oscar Barcelos - Centro, Rio do Sul - SC";
    const destination = "R. Otto Guckert, 99 - Canta Galo, Rio do Sul - SC";

    const prompt = `
      Qual é o tempo de viagem estimado DE CARRO (dirigindo) AGORA de:
      "${origin}" 
      para:
      "${destination}"?
      
      Considere o trânsito atual.
      Responda EXATAMENTE e APENAS com o tempo (ex: "12 min" ou "1 h 5 min"). Não adicione texto extra.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
      }
    });

    // Se o Gemini usar o Maps, ele retorna groundingChunks, mas o texto gerado deve conter a resposta resumida que pedimos
    let timeText = response.text?.trim() || "";
    
    // Limpeza básica caso venha com ponto final
    if (timeText.endsWith('.')) timeText = timeText.slice(0, -1);

    return timeText || "N/A";

  } catch (error: any) {
    console.error("Erro ao calcular rota:", error);
    // Retorna string vazia ou erro curto para não quebrar layout
    return "Erro";
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
    // 1. Verificação de Existência da Chave (Erro de Build/Ambiente)
    if (!process.env.API_KEY || process.env.API_KEY.trim() === '') {
        throw new Error("A API_KEY não foi injetada no app (Vazia/Undefined).");
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const siteText = context.sites?.length ? context.sites.join(', ') : "Todos online.";
        const formText = context.forms?.length ? context.forms.join('; ') : "Sem mensagens novas.";
        const emailText = context.emails?.length ? context.emails.join('; ') : "Sem e-mails urgentes.";
        const eventText = context.events?.length ? context.events.join('; ') : "Agenda livre hoje.";
        const trelloText = context.trello > 0 ? `${context.trello} tarefas pendentes.` : "Sem pendências no Trello.";
        const weatherText = context.weather || "Dados de clima indisponíveis.";

        const prompt = `
        Você é um assistente pessoal executivo (Tidas AI).
        
        PANORAMA COMPLETO:
        ------------------
        1. 🌦️ Clima: ${weatherText}
        2. 📅 Agenda Hoje: ${eventText}
        3. 🌐 Monitoramento: ${siteText}
        4. 📩 Inbox (Forms/Emails): ${formText} // ${emailText}
        5. 📋 Projetos (Trello): ${trelloText}

        INSTRUÇÃO:
        Gere um briefing estratégico curto (3-4 linhas) e direto.
        
        REQUISITOS CRÍTICOS:
        1. **CLIMA DA SEMANA**: Se houver previsão de chuva ou mudança brusca na semana informada, ALERTE explicitamente relacionando com a agenda/trânsito.
        2. **PRIORIDADE**: Se houver site OFFLINE, comece por isso.
        3. **CORRELAÇÃO**: Tente conectar os pontos (ex: "Semana chuvosa pode impactar reuniões externas...").
        4. Tom: Profissional, assertivo e em Português do Brasil.
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
        
        let message = error.message || error.toString();
        
        // 2. Verificação de Validade da Chave (Erro do Google)
        if (message.includes("API key not valid") || message.includes("400") || message.includes("403")) {
            throw new Error("Chave API recusada pelo Google. Verifique restrições.");
        }
        
        if (message.includes("fetch") || message.includes("Network")) {
             throw new Error("Sem conexão com a internet ou bloqueio de rede.");
        }

        if (message.includes("candidate")) {
             throw new Error("Conteúdo bloqueado pelos filtros de segurança.");
        }

        throw new Error(message);
    }
}
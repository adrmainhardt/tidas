
import { GoogleGenAI } from "@google/genai";
import { FormSubmission } from "../types";
import { FALLBACK_API_KEY } from "../constants";

// Função auxiliar para garantir que temos uma chave
const getApiKey = (): string | undefined => {
  // Prioriza a variável de ambiente, mas usa o fallback do constants.ts se necessário (fix para mobile)
  const key = process.env.API_KEY || FALLBACK_API_KEY;
  return (key && key.trim() !== '') ? key : undefined;
};

export const analyzeForms = async (forms: FormSubmission[]): Promise<string> => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) return "Erro: API Key não configurada (Mobile/Env).";

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

export const calculateCommuteTime = async (originCoords?: { lat: number, lng: number }): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) return "Sem Key";

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Destino fixo
    const destination = "R. Otto Guckert, 99 - Canta Galo, Rio do Sul - SC, 89163-332";
    
    // Define a origem baseada no GPS (prioridade) ou fallback genérico
    let originDescription = "Centro de Rio do Sul, SC";
    let usingGPS = false;
    
    if (originCoords) {
        originDescription = `${originCoords.lat},${originCoords.lng}`;
        usingGPS = true;
    }

    const prompt = `
      Atue como um navegador GPS.
      
      Rota:
      De: "${originDescription}" ${usingGPS ? '(Coordenadas GPS exatas)' : '(Centro da cidade)'}
      Para: "${destination}"
      
      Instrução:
      Use a ferramenta googleMaps para calcular o tempo de trânsito AGORA (driving).
      
      Retorno Obrigatório:
      Apenas o tempo estimado (ex: "15 min", "1 h 10 min") e um emoji de status.
      - 🔴 para trânsito pesado/atraso.
      - 🟡 para trânsito moderado.
      - 🟢 para trânsito livre.
      
      Exemplo final: "🟢 12 min"
      Não escreva frases, apenas o emoji e o tempo.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
      }
    });

    let timeText = response.text?.trim() || "";
    
    // Limpeza e validação
    timeText = timeText.replace(/\.$/, ''); // Remove ponto final
    
    if (!timeText || timeText.length > 40) return "Consultar Mapa";

    return timeText;

  } catch (error: any) {
    console.error("Erro ao calcular rota:", error);
    // Erros de permissão ou rede
    if (error.message?.includes('fetch')) return "Offline";
    return "Erro API";
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
    
    const apiKey = getApiKey();

    // 1. Verificação de Existência da Chave (Erro de Build/Ambiente)
    if (!apiKey) {
        throw new Error("Chave API não encontrada. Adicione em constants.ts para mobile.");
    }

    try {
        const ai = new GoogleGenAI({ apiKey });

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
            throw new Error("Chave API recusada. Verifique o constants.ts.");
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

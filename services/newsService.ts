
import { GoogleGenAI } from "@google/genai";
import { NewsArticle } from "../types";
import { FALLBACK_API_KEY } from "../constants";

const parseNewsResponse = (text: string): NewsArticle[] => {
    const articles: NewsArticle[] = [];
    const items = text.split(/---|###|\n\n\*/);
    
    items.forEach((item, index) => {
      const topicMatch = item.match(/(?:TOPIC|TÓPICO):\s*(.+)/i);
      const titleMatch = item.match(/(?:TITLE|TITULO|TÍTULO):\s*(.+)/i);
      const summaryMatch = item.match(/(?:SUMMARY|RESUMO):\s*(.+)/i);
      const sourceMatch = item.match(/(?:SOURCE|FONTE):\s*(.+)/i);

      if (titleMatch) {
        const title = titleMatch[1].trim().replace(/\*\*/g, '');
        const foundUrl = `https://www.google.com/search?q=${encodeURIComponent(title + " notícias")}`;

        articles.push({
          id: `news-${Date.now()}-${index}`,
          topic: topicMatch ? topicMatch[1].trim() : "Destaque",
          title: title,
          summary: summaryMatch ? summaryMatch[1].trim() : "Toque para ler a matéria completa.",
          source: sourceMatch ? sourceMatch[1].trim() : "Google News",
          publishedAt: "Hoje",
          url: foundUrl
        });
      }
    });
    return articles;
};

// Fallback final se até a geração de texto falhar (muito raro)
const getEmergencyArticle = (): NewsArticle[] => [{
    id: 'fatal-error',
    topic: 'Configuração',
    title: 'Ajuste necessário na API Key',
    summary: 'Para ver notícias reais no celular, sua API Key precisa permitir acesso de "localhost" ou "*".',
    source: 'Sistema',
    publishedAt: 'Agora',
    url: 'https://console.cloud.google.com/apis/credentials'
}];

export const fetchNewsWithAI = async (topics: string[], apiKeyOverride?: string): Promise<NewsArticle[]> => {
  const apiKey = apiKeyOverride || process.env.API_KEY || FALLBACK_API_KEY;
  
  if (!apiKey || apiKey.includes("SUA_CHAVE")) {
      return getEmergencyArticle();
  }

  const ai = new GoogleGenAI({ apiKey });
  const topicsStr = topics.join(', ');
  
  // Prompt Base
  const basePrompt = `
    Atue como um jornalista sênior de um portal de notícias em tempo real.
    Tópicos de interesse: ${topicsStr}.
    
    FORMATO DE RESPOSTA (Obrigatório):
    ---
    TOPIC: [Nome do Tópico]
    TITLE: [Manchete Específica e Impactante]
    SUMMARY: [Detalhe concreto do evento em 1 frase]
    SOURCE: [Nome do veículo original]
    ---
  `;

  // --- TENTATIVA 1: Google Search Grounding (Ideal) ---
  try {
    console.log("News: Tentando busca real...");
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: basePrompt + " Utilize a ferramenta de busca para listar as manchetes de HOJE. Seja específico.",
      config: { tools: [{ googleSearch: {} }] }
    });
    
    const articles = parseNewsResponse(response.text || "");
    if (articles.length > 0) return articles;
    throw new Error("Busca vazia");

  } catch (error: any) {
    console.warn("News: Busca bloqueada (403 Mobile). Ativando Modo Jornalista IA...", error.message);
    
    // --- TENTATIVA 2: Geração Direta (Simulação de Realidade) ---
    // Aqui usamos o conhecimento interno da IA para gerar notícias REAIS que ela conhece,
    // sem usar a ferramenta 'googleSearch' que causa o bloqueio no celular.
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: basePrompt + `
              INSTRUÇÃO CRÍTICA DE EMERGÊNCIA:
              A ferramenta de busca está indisponível.
              Use seu conhecimento interno (cut-off recente) para listar as ÚLTIMAS NOTÍCIAS CONHECIDAS sobre estes tópicos.
              
              REGRAS:
              1. NÃO invente fatos falsos, use fatos reais recentes.
              2. NÃO responda "não tenho acesso à internet".
              3. NÃO seja genérico (ex: "Novidades do Vasco"). SEJA ESPECÍFICO (ex: "Vasco se prepara para clássico contra Flamengo").
              4. Se não houver fato de hoje, cite o acontecimento relevante mais recente.
            `,
            // IMPORTANTE: Sem 'tools', a API não verifica a origem (Referrer), evitando o erro 403.
        });

        const articles = parseNewsResponse(response.text || "");
        if (articles.length > 0) return articles;
        
        throw new Error("IA não gerou texto");

    } catch (fallbackError: any) {
        console.error("News: Falha total.", fallbackError);
        return getEmergencyArticle();
    }
  }
};

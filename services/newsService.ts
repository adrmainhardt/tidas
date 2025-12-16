
import { GoogleGenAI } from "@google/genai";
import { NewsArticle } from "../types";
import { FALLBACK_API_KEY } from "../constants";

// Gera cartões de link direto caso a IA falhe totalmente
const generateOfflineCards = (topics: string[]): NewsArticle[] => {
    return topics.map((t, i) => ({
        id: `offline-${Date.now()}-${i}`,
        topic: t,
        title: `Últimas notícias sobre ${t}`,
        summary: 'Não foi possível carregar o resumo automático. Toque para ver os resultados atualizados no Google.',
        source: 'Google Search',
        publishedAt: 'Agora',
        url: `https://www.google.com/search?q=${encodeURIComponent(t + " notícias")}`
    }));
};

const parseNewsResponse = (text: string): NewsArticle[] => {
    const articles: NewsArticle[] = [];
    const items = text.split(/---|###|\n\n\*/);
    
    items.forEach((item, index) => {
      const topicMatch = item.match(/(?:TOPIC|TÓPICO):\s*(.+)/i);
      const titleMatch = item.match(/(?:TITLE|TITULO|TÍTULO):\s*(.+)/i);
      const summaryMatch = item.match(/(?:SUMMARY|RESUMO):\s*(.+)/i);
      const sourceMatch = item.match(/(?:SOURCE|FONTE):\s*(.+)/i);

      if (titleMatch) {
        const title = titleMatch[1].trim().replace(/^"|"$/g, '').replace(/\*\*/g, ''); 
        const foundUrl = `https://www.google.com/search?q=${encodeURIComponent(title + " notícias")}`;

        articles.push({
          id: `news-${Date.now()}-${index}`,
          topic: topicMatch ? topicMatch[1].trim() : "Destaque",
          title: title,
          summary: summaryMatch ? summaryMatch[1].trim() : "Confira os detalhes no Google.",
          source: sourceMatch ? sourceMatch[1].trim() : "Google News",
          publishedAt: "Hoje",
          url: foundUrl
        });
      }
    });
    return articles;
};

const getEffectiveApiKey = (override?: string): string | null => {
    if (override && override.trim().length > 10) return override;
    
    // Verifica process.env com cuidado
    const envKey = process.env.API_KEY;
    if (envKey && envKey.trim().length > 10 && !envKey.includes("SUA_CHAVE")) {
        return envKey;
    }
    
    // Fallback final
    if (FALLBACK_API_KEY && FALLBACK_API_KEY.trim().length > 10) {
        return FALLBACK_API_KEY;
    }
    
    return null;
};

export const fetchNewsWithAI = async (topics: string[], apiKeyOverride?: string): Promise<NewsArticle[]> => {
  const apiKey = getEffectiveApiKey(apiKeyOverride);
  
  // Se não tiver chave válida, retorna links diretos em vez de vazio
  if (!apiKey) {
      console.warn("News: Sem API Key válida. Retornando fallback.");
      return generateOfflineCards(topics);
  }

  const ai = new GoogleGenAI({ apiKey });
  const topicsStr = topics.join(', ');

  const basePrompt = `
    Atue como um agregador de notícias RSS.
    Tópicos: ${topicsStr}.
    
    Liste 1 notícia RECENTE e REAL para cada tópico.
    Se não houver fato hoje, cite o último relevante.
    
    FORMATO (Estrito):
    ---
    TOPIC: [Tópico]
    TITLE: [Manchete]
    SUMMARY: [Resumo curto]
    SOURCE: [Fonte]
    ---
  `;

  // --- TENTATIVA 1: Busca Real (Search Tool) ---
  try {
    console.log("News: Tentando busca...");
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: basePrompt + " Use o Google Search para fatos de HOJE.",
      config: { tools: [{ googleSearch: {} }] }
    });
    
    const articles = parseNewsResponse(response.text || "");
    if (articles.length > 0) return articles;
    throw new Error("Busca vazia");

  } catch (error: any) {
    console.warn("News: Busca falhou. Tentando modo texto...", error.message);
    
    // --- TENTATIVA 2: Geração Textual (Sem Tools) ---
    // Isso evita erro 403 de origem/referer no celular
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: basePrompt + " (Use seu conhecimento interno. Não use tools.)",
        });

        const articles = parseNewsResponse(response.text || "");
        if (articles.length > 0) return articles;
        
        throw new Error("Texto inválido");

    } catch (fallbackError: any) {
        console.error("News: Falha crítica. Gerando links offline.", fallbackError);
        // --- TENTATIVA 3: Fallback Garantido ---
        // Nunca retorna vazio ou erro, retorna links úteis
        return generateOfflineCards(topics);
    }
  }
};

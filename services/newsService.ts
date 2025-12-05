
import { GoogleGenAI } from "@google/genai";
import { NewsArticle } from "../types";
import { FALLBACK_API_KEY } from "../constants";

// Formata a resposta de texto para objetos NewsArticle
const parseNewsResponse = (text: string): NewsArticle[] => {
    const articles: NewsArticle[] = [];
    // Divide por blocos comuns de separação
    const items = text.split(/---|###|\n\n\*/);
    
    items.forEach((item, index) => {
      const topicMatch = item.match(/(?:TOPIC|TÓPICO):\s*(.+)/i);
      const titleMatch = item.match(/(?:TITLE|TITULO|TÍTULO):\s*(.+)/i);
      const summaryMatch = item.match(/(?:SUMMARY|RESUMO):\s*(.+)/i);
      const sourceMatch = item.match(/(?:SOURCE|FONTE):\s*(.+)/i);

      if (titleMatch) {
        const title = titleMatch[1].trim().replace(/\*\*/g, '');
        // Remove aspas se houver
        const cleanTitle = title.replace(/^"|"$/g, ''); 
        const foundUrl = `https://www.google.com/search?q=${encodeURIComponent(cleanTitle + " notícias")}`;

        articles.push({
          id: `news-${Date.now()}-${index}`,
          topic: topicMatch ? topicMatch[1].trim() : "Destaque",
          title: cleanTitle,
          summary: summaryMatch ? summaryMatch[1].trim() : "Confira os detalhes no Google.",
          source: sourceMatch ? sourceMatch[1].trim() : "Google News",
          publishedAt: "Hoje",
          url: foundUrl
        });
      }
    });
    return articles;
};

export const fetchNewsWithAI = async (topics: string[], apiKeyOverride?: string): Promise<NewsArticle[]> => {
  const apiKey = apiKeyOverride || process.env.API_KEY || FALLBACK_API_KEY;
  
  if (!apiKey || apiKey.includes("SUA_CHAVE")) {
      return [];
  }

  const ai = new GoogleGenAI({ apiKey });
  const topicsStr = topics.join(', ');

  const basePrompt = `
    Atue como um jornalista de portal de notícias. 
    Tópicos: ${topicsStr}.
    
    Para CADA tópico, forneça a notícia mais importante e RECENTE que você conhece.
    
    FORMATO OBRIGATÓRIO (use este template exato):
    ---
    TOPIC: [Nome do Tópico]
    TITLE: [Manchete Clara e Específica]
    SUMMARY: [Resumo em 1 frase curta]
    SOURCE: [Fonte Original]
    ---
  `;

  // --- TENTATIVA 1: Busca Real (Pode falhar no celular se a Key não permitir o domínio) ---
  try {
    console.log("News: Tentando busca real (Search Tool)...");
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: basePrompt + " Use a ferramenta de busca para notícias de HOJE.",
      config: { tools: [{ googleSearch: {} }] }
    });
    
    const articles = parseNewsResponse(response.text || "");
    if (articles.length > 0) return articles;
    throw new Error("Busca retornou vazio");

  } catch (error: any) {
    console.warn("News: Busca falhou (provável 403 Mobile). Tentando Geração Textual...", error.message);
    
    // --- TENTATIVA 2: Geração Textual (Fallback Robusto) ---
    // Removemos 'tools' e 'json' para garantir que funcione apenas com texto puro (menos restrições).
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: basePrompt + `
              INSTRUÇÃO DE EMERGÊNCIA: A busca falhou.
              Gere as notícias com base no seu conhecimento interno (Cut-off recente).
              Seja ESPECÍFICO. Não invente, use fatos reais recentes.
              Não responda "não tenho acesso".
            `,
        });

        const articles = parseNewsResponse(response.text || "");
        if (articles.length > 0) return articles;
        
        throw new Error("IA gerou texto inválido");

    } catch (fallbackError: any) {
        console.error("News: Falha total.", fallbackError);
        
        // --- TENTATIVA 3: Feedback Visual de Erro (Último recurso) ---
        // Se chegamos aqui, a chave está bloqueando TUDO ou esgotou a cota.
        // Retornamos um card especial para o usuário saber o que fazer.
        return [{
            id: 'error-card',
            topic: 'Erro de Configuração',
            title: 'Notícias indisponíveis no momento',
            summary: 'Sua API Key está bloqueando o acesso deste dispositivo. Adicione este domínio no Google Console.',
            source: 'Sistema',
            publishedAt: 'Agora',
            url: 'https://console.cloud.google.com/apis/credentials'
        }];
    }
  }
};

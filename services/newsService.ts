
import { GoogleGenAI } from "@google/genai";
import { NewsArticle } from "../types";
import { FALLBACK_API_KEY } from "../constants";

// Notícias de emergência (Último recurso se a IA estiver totalmente offline)
const getMockNews = (topics: string[]): NewsArticle[] => {
    const topic = topics[0] || 'Geral';
    return [
        {
            id: 'mock-1',
            topic: topic,
            title: `Atualizações sobre ${topic}`,
            summary: 'Não foi possível conectar à ferramenta de busca em tempo real. Verifique a API Key ou a conexão.',
            source: 'Sistema Tidas',
            publishedAt: 'Agora',
            url: `https://www.google.com/search?q=${encodeURIComponent(topic + " notícias")}`
        },
        {
            id: 'mock-2',
            topic: 'Dica',
            title: 'Como corrigir o erro de notícias',
            summary: 'Se você está no celular, a chave de API pode ter restrições de domínio. Tente criar uma chave sem restrições.',
            source: 'Ajuda',
            publishedAt: 'Hoje',
            url: '#'
        }
    ];
};

const parseNewsResponse = (text: string): NewsArticle[] => {
    const articles: NewsArticle[] = [];
    // Tenta dividir por separadores comuns que a IA pode usar
    const items = text.split(/---|###|\n\n\*/);
    
    items.forEach((item, index) => {
      // Regex mais flexível para capturar os campos
      const topicMatch = item.match(/(?:TOPIC|TÓPICO):\s*(.+)/i);
      const titleMatch = item.match(/(?:TITLE|TITULO|TÍTULO):\s*(.+)/i);
      const summaryMatch = item.match(/(?:SUMMARY|RESUMO):\s*(.+)/i);
      const sourceMatch = item.match(/(?:SOURCE|FONTE):\s*(.+)/i);

      if (titleMatch) {
        const title = titleMatch[1].trim().replace(/\*\*/g, ''); // Remove markdown bold
        const foundUrl = `https://www.google.com/search?q=${encodeURIComponent(title + " notícias")}`;

        articles.push({
          id: `news-${Date.now()}-${index}`,
          topic: topicMatch ? topicMatch[1].trim() : "Destaque",
          title: title,
          summary: summaryMatch ? summaryMatch[1].trim() : "Toque para ver mais detalhes sobre este assunto.",
          source: sourceMatch ? sourceMatch[1].trim() : "IA Tidas",
          publishedAt: "Recente",
          url: foundUrl
        });
      }
    });
    return articles;
};

export const fetchNewsWithAI = async (topics: string[], apiKeyOverride?: string): Promise<NewsArticle[]> => {
  // Garante que temos uma chave, preferindo a do override (config)
  const apiKey = apiKeyOverride || process.env.API_KEY || FALLBACK_API_KEY;
  
  if (!apiKey || apiKey.includes("SUA_CHAVE")) {
      return getMockNews(topics);
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // Prompt base otimizado
  const topicsStr = topics.join(', ');
  const basePrompt = `
    Atue como um agregador de notícias.
    Tópicos: ${topicsStr}.
    
    IMPORTANTE: Formato de resposta estrito:
    ---
    TOPIC: [Nome do Tópico]
    TITLE: [Manchete Curta e Impactante]
    SUMMARY: [Resumo em 1 frase]
    SOURCE: [Fonte provável]
    ---
  `;

  // --- ESTRATÉGIA 1: Google Search Grounding (Ideal, mas falha no Mobile se a Key for restrita) ---
  try {
    console.log("News: Tentando busca em tempo real...");
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: basePrompt + " Use a ferramenta de busca para encontrar notícias de HOJE.",
      config: {
        tools: [{ googleSearch: {} }] // Causa 403 se a origem não for permitida
      }
    });
    
    const articles = parseNewsResponse(response.text || "");
    if (articles.length > 0) return articles;
    throw new Error("Retorno vazio da busca");

  } catch (error: any) {
    console.warn("News: Busca falhou (Provável restrição Mobile). Tentando conhecimento interno...", error.message);
    
    // --- ESTRATÉGIA 2: Geração Pura (Fallback Robusto) ---
    // Removemos 'tools' e pedimos um resumo do conhecimento da IA.
    // Alteramos o prompt para evitar que a IA diga "Não tenho acesso à internet".
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', // Modelo rápido
            contents: basePrompt + " Gere manchetes baseadas no seu conhecimento sobre estes temas. Se não tiver fatos de hoje, forneça fatos ou curiosidades recentes conhecidas.",
            // SEM TOOLS: Isso evita o erro 403 de origem/referer
        });

        const articles = parseNewsResponse(response.text || "");
        
        // Se a IA gerou algo, retornamos (mesmo que não seja "Breaking News", é melhor que erro)
        if (articles.length > 0) {
            // Marca como gerado por IA para transparência
            return articles.map(a => ({...a, source: 'IA (Resumo)'}));
        }
        
        throw new Error("Falha na geração de texto");

    } catch (fallbackError: any) {
        console.error("News: Todas as tentativas falharam.", fallbackError);
        return getMockNews(topics);
    }
  }
};

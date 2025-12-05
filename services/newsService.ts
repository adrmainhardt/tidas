
import { GoogleGenAI } from "@google/genai";
import { NewsArticle } from "../types";
import { FALLBACK_API_KEY } from "../constants";

// Notícias de emergência caso a API falhe totalmente
const getMockNews = (topics: string[]): NewsArticle[] => {
    return [
        {
            id: 'mock-1',
            topic: topics[0] || 'Geral',
            title: 'Notícias indisponíveis no momento',
            summary: 'Não foi possível conectar à API de notícias. Verifique sua conexão ou a chave de API. Exibindo conteúdo demonstrativo.',
            source: 'Sistema Tidas',
            publishedAt: 'Agora',
            url: '#'
        },
        {
            id: 'mock-2',
            topic: 'Tecnologia',
            title: 'Inteligência Artificial avança em 2025',
            summary: 'Novos modelos de linguagem prometem revolucionar a forma como interagimos com dispositivos móveis.',
            source: 'Tech News',
            publishedAt: 'Hoje',
            url: 'https://google.com'
        }
    ];
};

const parseNewsResponse = (text: string): NewsArticle[] => {
    const articles: NewsArticle[] = [];
    const items = text.split('---');
    
    items.forEach((item, index) => {
      const topicMatch = item.match(/TOPIC:\s*(.+)/);
      const titleMatch = item.match(/TITLE:\s*(.+)/);
      const summaryMatch = item.match(/SUMMARY:\s*(.+)/);
      const sourceMatch = item.match(/SOURCE:\s*(.+)/);

      if (titleMatch && summaryMatch) {
        const title = titleMatch[1].trim();
        const foundUrl = `https://www.google.com/search?q=${encodeURIComponent(title + " notícias")}`;

        articles.push({
          id: `news-${Date.now()}-${index}`,
          topic: topicMatch ? topicMatch[1].trim() : "Geral",
          title: title,
          summary: summaryMatch[1].trim(),
          source: sourceMatch ? sourceMatch[1].trim() : "IA Summary",
          publishedAt: "Recente",
          url: foundUrl
        });
      }
    });
    return articles;
};

export const fetchNewsWithAI = async (topics: string[], apiKeyOverride?: string): Promise<NewsArticle[]> => {
  const apiKey = apiKeyOverride || process.env.API_KEY || FALLBACK_API_KEY;
  
  if (!apiKey || apiKey.includes("SUA_CHAVE")) {
      console.warn("API Key inválida, usando mock.");
      return getMockNews(topics);
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const basePrompt = `
    Atue como um jornalista. Liste notícias RECENTES sobre: ${topics.join(', ')}.
    
    Formato OBRIGATÓRIO (use '---' para separar):
    TOPIC: [Tópico]
    TITLE: [Título Manchete]
    SUMMARY: [Resumo curto em português, máx 20 palavras]
    SOURCE: [Nome da Fonte Estimada]
    ---
  `;

  // ESTRATÉGIA 1: Tentar com Google Search Grounding (Melhor qualidade, mas bloqueia fácil no mobile)
  try {
    console.log("Tentativa 1: News com Google Search Tool...");
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: basePrompt + " Use a ferramenta de busca para fatos reais de hoje.",
      config: {
        tools: [{ googleSearch: {} }] // Essa ferramenta causa 403 se a origem não bater
      }
    });
    
    const articles = parseNewsResponse(response.text || "");
    if (articles.length > 0) return articles;
    throw new Error("Retorno vazio com Search Tool");

  } catch (error: any) {
    console.warn("Tentativa 1 falhou (Provável 403 Mobile). Iniciando Tentativa 2...", error.message);
    
    // ESTRATÉGIA 2: Tentar SEM ferramentas (Apenas conhecimento do modelo)
    // Isso evita o erro 403 de origem/referer na maioria dos casos
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: basePrompt + " Baseie-se no seu conhecimento mais recente possível.",
            // SEM TOOLS aqui
        });

        const articles = parseNewsResponse(response.text || "");
        if (articles.length > 0) return articles;
        throw new Error("Retorno vazio sem tools");

    } catch (fallbackError: any) {
        console.error("Todas as tentativas falharam:", fallbackError);
        // ESTRATÉGIA 3: Retornar Mock para não quebrar a UI
        return getMockNews(topics);
    }
  }
};

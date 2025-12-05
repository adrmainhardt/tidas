
import { GoogleGenAI, SchemaType } from "@google/genai";
import { NewsArticle } from "../types";
import { FALLBACK_API_KEY } from "../constants";

// Definição de tipos para o Schema JSON (usando strings para compatibilidade garantida)
const schema = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      topic: { type: "STRING" },
      title: { type: "STRING" },
      summary: { type: "STRING" },
      source: { type: "STRING" },
    },
    required: ["topic", "title", "summary", "source"],
  },
};

const parseNewsResponse = (text: string): NewsArticle[] => {
    const articles: NewsArticle[] = [];
    // Regex robusto para tentar extrair caso a IA não retorne JSON puro no primeiro método
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

export const fetchNewsWithAI = async (topics: string[], apiKeyOverride?: string): Promise<NewsArticle[]> => {
  const apiKey = apiKeyOverride || process.env.API_KEY || FALLBACK_API_KEY;
  
  // Se não tiver chave, retorna vazio para não mostrar erro feio, apenas "Sem notícias"
  if (!apiKey || apiKey.includes("SUA_CHAVE")) {
      return [];
  }

  const ai = new GoogleGenAI({ apiKey });
  const topicsStr = topics.join(', ');

  // --- ESTRATÉGIA 1: Google Search Grounding (Melhor qualidade, mas falha no Mobile se Key restrita) ---
  try {
    console.log("News: Tentando busca real...");
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Atue como um agregador de notícias. Tópicos: ${topicsStr}. 
      Use a ferramenta de busca para encontrar 4 manchetes de HOJE.
      
      FORMATO:
      ---
      TOPIC: [Tópico]
      TITLE: [Título]
      SUMMARY: [Resumo]
      SOURCE: [Fonte]
      ---`,
      config: { tools: [{ googleSearch: {} }] }
    });
    
    const articles = parseNewsResponse(response.text || "");
    if (articles.length > 0) return articles;
    throw new Error("Busca vazia ou bloqueada");

  } catch (error: any) {
    console.warn("News: Busca falhou. Ativando Fallback JSON...", error.message);
    
    // --- ESTRATÉGIA 2 (A CORREÇÃO): Geração JSON Estruturada ---
    // Usamos o modo JSON da API. Isso ignora o bloqueio de Referer da ferramenta de busca
    // e garante que o formato venha correto, evitando erros de parser.
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Você é um feed de notícias de backup.
            Tópicos: ${topicsStr}.
            
            Gere 4 notícias baseadas no seu conhecimento mais recente sobre estes tópicos.
            Se não tiver dados de "hoje", gere notícias baseadas em eventos contínuos reais (ex: campeonatos em andamento, situações políticas atuais).
            
            IMPORTANTE:
            1. NÃO invente nomes de pessoas que não existem.
            2. NÃO diga "sou uma IA". Aja como um feed RSS.
            3. Use fatos reais conhecidos.
            `,
            config: {
                responseMimeType: "application/json",
                // @ts-ignore - A tipagem do SDK pode variar, mas o payload aceita schema
                responseSchema: schema
            }
        });

        const jsonText = response.text || "[]";
        const data = JSON.parse(jsonText);
        
        if (Array.isArray(data) && data.length > 0) {
            return data.map((item: any, index: number) => ({
                id: `fallback-${Date.now()}-${index}`,
                topic: item.topic || "Geral",
                title: item.title || "Notícia do dia",
                summary: item.summary || "Confira os detalhes pesquisando no Google.",
                source: item.source || "Feed",
                publishedAt: "Recente",
                url: `https://www.google.com/search?q=${encodeURIComponent((item.title || "") + " notícias")}`
            }));
        }
        
        throw new Error("JSON inválido");

    } catch (fallbackError: any) {
        console.error("News: Falha crítica.", fallbackError);
        // Retorna array vazio em vez de erro para a UI lidar graciosamente
        return [];
    }
  }
};

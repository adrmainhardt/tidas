
import { GoogleGenAI } from "@google/genai";
import { NewsArticle } from "../types";
import { FALLBACK_API_KEY } from "../constants";

export const fetchNewsWithAI = async (topics: string[], apiKeyOverride?: string): Promise<NewsArticle[]> => {
  const apiKey = apiKeyOverride || process.env.API_KEY || FALLBACK_API_KEY;
  if (!apiKey) throw new Error("API Key ausente. Configure nas configurações.");

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Procure por notícias recentes (de hoje ou ontem) sobre estes tópicos: ${topics.join(', ')}.
    
    Para cada notícia encontrada, formate a saída EXATAMENTE neste padrão:
    TOPIC: [Nome do Tópico]
    TITLE: [Título da Notícia]
    SUMMARY: [Resumo curto em português, máx 2 frases]
    SOURCE: [Nome da Fonte, ex: G1, ESPN]
    ---
    
    Traga pelo menos 1 notícia relevante para cada tópico se houver novidades.
    Seja direto e informativo.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text || "";
    const articles: NewsArticle[] = [];
    
    // Parse manual do formato de texto solicitado
    const items = text.split('---');
    
    items.forEach((item, index) => {
      const topicMatch = item.match(/TOPIC:\s*(.+)/);
      const titleMatch = item.match(/TITLE:\s*(.+)/);
      const summaryMatch = item.match(/SUMMARY:\s*(.+)/);
      const sourceMatch = item.match(/SOURCE:\s*(.+)/);

      if (titleMatch && summaryMatch) {
        const title = titleMatch[1].trim();
        
        // Estratégia simples: Linkar para busca no Google
        const foundUrl = `https://www.google.com/search?q=${encodeURIComponent(title + " notícias")}`;

        articles.push({
          id: `news-${Date.now()}-${index}`,
          topic: topicMatch ? topicMatch[1].trim() : "Geral",
          title: title,
          summary: summaryMatch[1].trim(),
          source: sourceMatch ? sourceMatch[1].trim() : "Google Search",
          publishedAt: "Hoje",
          url: foundUrl
        });
      }
    });

    // Se a IA não retornou nada estruturado mas também não deu erro
    if (articles.length === 0 && text.length < 50) {
        throw new Error("A IA não encontrou notícias recentes.");
    }

    return articles;

  } catch (error: any) {
    console.error("Erro ao buscar notícias:", error);
    
    // Tratamento de mensagens de erro comuns para exibir na UI
    let msg = error.message || "Erro desconhecido";
    if (msg.includes("403")) msg = "Acesso Negado (403). Verifique restrições de domínio na API Key.";
    if (msg.includes("400")) msg = "Requisição Inválida (400). Chave pode estar incorreta.";
    if (msg.includes("API key not valid")) msg = "API Key inválida.";
    
    throw new Error(msg);
  }
};

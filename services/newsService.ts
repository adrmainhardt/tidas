
import { NewsArticle } from "../types";

// Fallback final caso tudo falhe
const generateOfflineCards = (topics: string[]): NewsArticle[] => {
    return topics.map((t, i) => ({
        id: `offline-${Date.now()}-${i}`,
        topic: t,
        title: `Ver notícias sobre ${t}`,
        summary: 'Toque para abrir a pesquisa do Google.',
        source: 'Google Search',
        publishedAt: 'Agora',
        timestamp: Date.now() - (i * 1000), // Timestamps ligeiramente diferentes
        url: `https://www.google.com/search?q=${encodeURIComponent(t + " notícias")}`
    }));
};

/**
 * Tenta buscar texto de uma URL usando múltiplos proxies CORS.
 */
const fetchWithProxy = async (targetUrl: string): Promise<string> => {
    // 1. Tenta corsproxy.io (Geralmente mais rápido e compatível)
    try {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
        const response = await fetch(proxyUrl);
        if (response.ok) {
            const text = await response.text();
            if (text.trim().startsWith('<')) return text; // Parece XML/HTML
        }
    } catch (e) {
        console.warn("CorsProxy falhou, tentando backup...");
    }

    // 2. Tenta allorigins.win (Backup)
    try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
        const response = await fetch(proxyUrl);
        if (response.ok) {
             const text = await response.text();
             if (text.trim().startsWith('<')) return text;
        }
    } catch (e) {
        console.warn("AllOrigins falhou.");
    }

    throw new Error("Todos os proxies falharam.");
};

/**
 * Busca notícias. Agora extrai até 3 notícias por tópico para garantir volume.
 */
export const fetchNewsWithAI = async (topics: string[], apiKeyOverride?: string): Promise<NewsArticle[]> => {
  // Aumentamos o limite de tópicos para buscar (até 5 tópicos diferentes)
  const shuffledTopics = [...topics].sort(() => 0.5 - Math.random()).slice(0, 5);

  const fetchPromises = shuffledTopics.map(async (topic) => {
      try {
          // --- TENTATIVA 1: Google News RSS ---
          const googleUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
          let xmlString = "";
          let provider = "google";

          try {
              xmlString = await fetchWithProxy(googleUrl);
          } catch (e) {
              console.warn(`Google News falhou para ${topic}, tentando Bing...`);
              // --- TENTATIVA 2: Bing News RSS (Fallback se Google bloquear) ---
              const bingUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(topic)}&format=rss`;
              xmlString = await fetchWithProxy(bingUrl);
              provider = "bing";
          }

          // Parse XML
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlString, "text/xml");
          const items = xmlDoc.querySelectorAll("item");

          if (items.length > 0) {
              // PEGAR AS 3 PRIMEIRAS NOTÍCIAS DE CADA TÓPICO
              const topItems = Array.from(items).slice(0, 3);
              
              return topItems.map((item, index) => {
                  const titleFull = item.querySelector("title")?.textContent || "";
                  let link = item.querySelector("link")?.textContent || "";
                  
                  if (provider === "bing" && !link.startsWith("http")) {
                       const guid = item.querySelector("guid")?.textContent;
                       if (guid && guid.startsWith("http")) link = guid;
                  }

                  const pubDateRaw = item.querySelector("pubDate")?.textContent || "";
                  const sourceRaw = item.querySelector("source")?.textContent || (provider === "bing" ? "Bing News" : "Google News");
                  
                  // Limpeza do Título
                  const titleParts = titleFull.split(" - ");
                  const title = titleParts.length > 1 ? titleParts.slice(0, -1).join(" - ") : titleFull;
                  
                  const pubDate = new Date(pubDateRaw);
                  
                  // Lógica robusta de Timestamp: Se a data for inválida, gera uma data aleatória nas últimas 24h
                  // Isso garante que notícias sem data não fiquem todas agrupadas no final
                  let timestamp = pubDate.getTime();
                  if (isNaN(timestamp)) {
                      timestamp = Date.now() - Math.floor(Math.random() * 86400000); 
                  }

                  const timeString = isNaN(pubDate.getTime()) 
                      ? "Recente" 
                      : pubDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + pubDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                  return {
                      id: `news-${topic}-${Date.now()}-${index}`, // ID único com index
                      topic: topic,
                      title: title,
                      summary: titleFull, 
                      source: sourceRaw,
                      publishedAt: timeString,
                      timestamp: timestamp, // Usado para ordenação
                      url: link
                  } as NewsArticle;
              });
          }
      } catch (e) {
          console.warn(`Erro total ao buscar notícia para ${topic}:`, e);
          return null;
      }
      return null;
  });

  const results = await Promise.all(fetchPromises);
  
  // Flatten array de arrays
  const validArticles = results
      .flat()
      .filter((a): a is NewsArticle => a !== null && a !== undefined);

  // Remove duplicatas baseadas no título (caso tópicos se sobreponham)
  const uniqueArticles = Array.from(new Map(validArticles.map(item => [item.title, item])).values());

  if (uniqueArticles.length === 0) {
      return generateOfflineCards(topics.slice(0, 3));
  }

  // ORDENAÇÃO: Mais recentes primeiro (Decrescente)
  // Isso mistura os tópicos naturalmente, pois a ordem será baseada na hora da publicação e não no tópico.
  uniqueArticles.sort((a, b) => b.timestamp - a.timestamp);

  return uniqueArticles;
};

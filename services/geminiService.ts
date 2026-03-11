
import { GoogleGenAI } from "@google/genai";
import { SheetGrid, Tab } from "../types";

export const generateDashboardInsights = async (tab: Tab, data: SheetGrid): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY; 
  if (!apiKey) {
    return "Configuração pendente: A Chave de API (GEMINI_API_KEY) não foi encontrada no ambiente de produção (Vercel).";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Prepare data summary based on tab
    let dataSummary = "";
    if (tab === Tab.HOME) {
      dataSummary = "Esta é a visão geral do dashboard com KPIs consolidados de Marketing, Vendas e Financeiro.";
    } else {
      // Take first 15 rows for context
      const sample = data.slice(0, 15).map(row => row.join(" | ")).join("\n");
      dataSummary = `Dados da aba "${tab.toUpperCase()}":\n${sample}`;
    }

    const prompt = `
      Atue como um Consultor de Negócios Especialista.
      Estou analisando a aba "${tab}" de um dashboard empresarial.
      
      ${dataSummary}
      
      Com base nesses dados, forneça 3 insights estratégicos curtos (máximo 2 frases cada) em Português do Brasil.
      Identifique tendências, pontos de atenção ou oportunidades de melhoria.
      Seja direto e profissional.
      Não use markdown complexo, apenas texto plano com quebras de linha.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Não foi possível gerar insights no momento.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Erro ao conectar com a IA. Verifique se a API Key é válida e se há permissão de acesso.";
  }
};

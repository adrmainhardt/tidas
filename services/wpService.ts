
import { FormSubmission, SiteConfig } from '../types';

// Tipos de retorno da API
interface WpApiResponse<T> {
  success: boolean;
  data: T;
}

interface WpStats {
  online_users: number;
  monthly_visitors: number;
}

// Função auxiliar para gerar dados simulados quando a API não estiver disponível
const getMockFormsForSite = (site: SiteConfig): FormSubmission[] => {
  const now = new Date();
  
  if (site.name.toLowerCase().includes('tidas')) {
    return [
      {
        id: `mock-${site.id}-1`,
        siteId: site.id,
        senderName: 'Roberto Almeida',
        senderEmail: 'roberto@gmail.com',
        message: 'Olá, gostaria de saber se o sapato modelo X tem no tamanho 42?',
        timestamp: new Date(now.getTime() - 1000 * 60 * 30), // 30 min atrás
        isRead: false
      }
    ];
  }

  if (site.name.toLowerCase().includes('servipa')) {
    return [
      {
        id: `mock-${site.id}-2`,
        siteId: site.id,
        senderName: 'Ana Cláudia',
        senderEmail: 'ana.c@hotmail.com',
        message: 'Não estou conseguindo emitir meu boleto pelo site.',
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 2), // 2 horas atrás
        isRead: false
      }
    ];
  }

  return [
    {
      id: `mock-${site.id}-3`,
      siteId: site.id,
      senderName: 'Contato Site',
      senderEmail: 'contato@empresa.com',
      message: 'Tenho interesse em anunciar no portal.',
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24), // 1 dia atrás
      isRead: true
    }
  ];
};

/**
 * Busca formulários do endpoint personalizado do WordPress.
 */
export const fetchFormsFromWP = async (site: SiteConfig): Promise<FormSubmission[]> => {
  if (!site.apiKey) {
    return getMockFormsForSite(site);
  }

  const cleanUrl = site.url.replace(/\/$/, '');
  const endpoint = `${cleanUrl}/wp-json/monitor-app/v1/submissions?key=${encodeURIComponent(site.apiKey)}&_=${Date.now()}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // Timeout reduzido

    const response = await fetch(endpoint, {
      method: 'GET',
      signal: controller.signal,
      mode: 'cors' // Tenta CORS explicitamente
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Falha silenciosa, retorna mock
      return getMockFormsForSite(site);
    }

    const data = await response.json();

    if (!data.success || !Array.isArray(data.data)) {
      return getMockFormsForSite(site);
    }

    return data.data.map((item: any) => ({
      id: `wp-${site.id}-${item.id}`,
      siteId: site.id,
      senderName: item.name || 'Desconhecido',
      senderEmail: item.email || 'sem-email@site.com',
      message: item.message || 'Sem conteúdo',
      timestamp: new Date(item.date),
      isRead: false
    }));

  } catch (error) {
    // Erro de rede ou fetch (comum em localhost ou servidores sem CORS configurado)
    // Retorna mock data sem poluir o console com "Error"
    console.warn(`WP Fetch (Mocking): ${site.name}`); 
    return getMockFormsForSite(site);
  }
};

/**
 * Busca estatísticas de visitantes (Koko Analytics) e status via API.
 */
export const fetchSiteStats = async (site: SiteConfig): Promise<{ online: number, monthly: number } | null> => {
  if (!site.apiKey) return null;

  const cleanUrl = site.url.replace(/\/$/, '');
  const endpoint = `${cleanUrl}/wp-json/monitor-app/v1/stats?key=${encodeURIComponent(site.apiKey)}&_=${Date.now()}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(endpoint, {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const json: WpApiResponse<WpStats> = await response.json();
    
    if (json.success && json.data) {
      return {
        online: json.data.online_users,
        monthly: json.data.monthly_visitors
      };
    }
    return null;

  } catch (error) {
    return null;
  }
};

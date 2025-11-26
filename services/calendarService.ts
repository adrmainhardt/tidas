
import { CalendarEvent } from "../types";

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

export const fetchCalendarEvents = async (auth: { token?: string | null, apiKey?: string }, calendarIds: string[]): Promise<CalendarEvent[]> => {
  try {
    const now = new Date();
    
    // Define o início do período como 00:00:00 de hoje para pegar eventos do dia todo
    const startOfPeriod = new Date(now);
    startOfPeriod.setHours(0, 0, 0, 0);
    const timeMin = startOfPeriod.toISOString();
    
    // Vai até 3 meses para frente para garantir "próximos eventos da semana/mês"
    const endOfPeriod = new Date(now);
    endOfPeriod.setMonth(endOfPeriod.getMonth() + 3);
    const timeMax = endOfPeriod.toISOString();

    // IDs para buscar
    const targets = [...calendarIds];
    
    // Adiciona 'primary' se tiver token, mas não se for apenas API Key e não estiver na lista
    if (auth.token && !targets.includes('primary')) {
        targets.push('primary');
    }

    const allEventsPromises = targets.map(async (calId) => {
      // Se não tem token e pede primary, retorna vazio
      if (!auth.token && calId === 'primary') return [];

      // URL base sem a chave/token ainda
      const baseUrl = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calId)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=50&_=${Date.now()}`;
      
      try {
          let response;
          
          // 1. TENTATIVA AUTENTICADA (Se tiver token)
          if (auth.token) {
              response = await fetch(baseUrl, {
                  headers: { 'Authorization': `Bearer ${auth.token}` }
              });

              // Se der erro de permissão (403/404) e tivermos API Key,
              // pode ser uma agenda pública que o usuário não tem na conta dele.
              if (!response.ok && (response.status === 403 || response.status === 404)) {
                 response = null; // Força cair no bloco abaixo (tentativa pública)
              }
          }

          // 2. TENTATIVA PÚBLICA (Fallback ou Default)
          // Se não tivemos resposta válida acima
          if (!response || !response.ok) {
              // Só funciona se tiver API Key
              if (auth.apiKey) {
                 const publicUrl = `${baseUrl}&key=${auth.apiKey}`;
                 response = await fetch(publicUrl);
              }
          }

          if (!response || !response.ok) {
              if (response) {
                 const status = response.status;
                 // 404: Agenda não encontrada ou privada
                 // 403: Acesso negado (Privada)
                 if (status === 404 || status === 403) {
                     // Log discreto apenas como aviso, não erro
                     console.warn(`Agenda privada ou inacessível: ${calId}`);
                     return []; 
                 }

                 try {
                     const err = await response.json();
                     const errorMsg = err.error?.message || JSON.stringify(err, null, 2);
                     console.error(`Erro API Google (${status}): ${errorMsg}`);
                 } catch (e) {
                     console.error(`Erro API Google: Status ${status}`);
                 }
              }
              return [];
          }

          const data = await response.json();
          if (!data.items) return [];

          return (data.items || []).map((item: any) => ({ ...item, _sourceName: data.summary || calId }));

      } catch (e) {
          console.error(`Erro de conexão agenda ${calId}:`, e);
          return [];
      }
    });

    const results = await Promise.all(allEventsPromises);
    const rawEvents = results.flat();

    // Processamento e normalização dos dados
    const processedEvents: CalendarEvent[] = rawEvents.map((item: any) => {
      let start: Date;
      let end: Date;
      let isAllDay = false;

      if (item.start.date) {
          // É evento de dia inteiro (YYYY-MM-DD)
          isAllDay = true;
          // Hack para timezone: criar date com horas zeradas no local time
          const parts = item.start.date.split('-');
          start = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          
          if (item.end.date) {
             const endParts = item.end.date.split('-');
             end = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]));
          } else {
             end = new Date(start);
          }
      } else {
          // Evento com hora marcada
          start = item.start.dateTime ? new Date(item.start.dateTime) : new Date();
          end = item.end.dateTime ? new Date(item.end.dateTime) : new Date();
      }
      
      return {
        id: item.id,
        title: item.summary || '(Sem título)',
        description: item.description || '',
        location: item.location || '',
        start,
        end,
        isAllDay,
        link: item.htmlLink,
        status: item.status
      };
    });

    // Remove duplicatas baseadas no ID + Data
    const uniqueEvents = Array.from(new Map(processedEvents.map(item => [item.id + item.start.toISOString(), item])).values());

    return uniqueEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

  } catch (error) {
    console.error("Erro crítico fetchCalendarEvents:", error);
    return [];
  }
};

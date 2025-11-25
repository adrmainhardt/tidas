
import { CalendarEvent } from "../types";

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

export const fetchCalendarEvents = async (auth: { token?: string | null, apiKey?: string }, calendarIds: string[]): Promise<CalendarEvent[]> => {
  try {
    const now = new Date();
    
    // Define o início do período como 00:00:00 de hoje
    const startOfPeriod = new Date(now);
    startOfPeriod.setHours(0, 0, 0, 0);
    const timeMin = startOfPeriod.toISOString();
    
    // Vai até o final do próximo mês
    const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    const timeMax = endOfNextMonth.toISOString();

    // IDs para buscar
    const targets = [...calendarIds];
    
    // Adiciona 'primary' se tiver token, mas não se for apenas API Key
    if (auth.token && !targets.includes('primary')) {
        targets.push('primary');
    }

    console.log("Buscando agendas:", targets, "Auth:", auth.token ? "Token" : "API Key");

    const allEventsPromises = targets.map(async (calId) => {
      // Se não tem token, não adianta tentar ler 'primary' (privado)
      if (!auth.token && calId === 'primary') return [];

      // URL Base
      let url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calId)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=50&_=${Date.now()}`;
      
      // Headers
      const headers: HeadersInit = {};
      
      if (auth.token) {
          headers['Authorization'] = `Bearer ${auth.token}`;
      } else if (auth.apiKey) {
          // Se não tem token, usa a API Key na URL
          url += `&key=${auth.apiKey}`;
      } else {
          // Sem auth nenhuma, pula
          return [];
      }

      try {
          const res = await fetch(url, { headers });

          if (!res.ok) {
              // Ignora erros de permissão (403) silenciosamente
              if (res.status !== 403 && res.status !== 404) {
                  console.warn(`Falha ao ler calendário ${calId}: ${res.status}`);
              }
              return [];
          }
          
          const data = await res.json();
          // Marca a origem do evento
          return (data.items || []).map((item: any) => ({ ...item, _sourceName: data.summary || calId }));
      } catch (e) {
          console.error(`Exceção ao ler calendário ${calId}`, e);
          return [];
      }
    });

    const results = await Promise.all(allEventsPromises);
    const rawEvents = results.flat();

    // Processamento e normalização dos dados
    const processedEvents: CalendarEvent[] = rawEvents.map((item: any) => {
      const startStr = item.start.dateTime || item.start.date;
      const endStr = item.end.dateTime || item.end.date;
      
      const start = startStr ? new Date(startStr) : new Date();
      if (!item.start.dateTime) start.setHours(0,0,0,0); 

      const end = endStr ? new Date(endStr) : new Date();
      if (!item.end.dateTime) end.setHours(23,59,59,999);

      const isAllDay = !item.start.dateTime;
      
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

    // Remove duplicatas
    const uniqueEvents = Array.from(new Map(processedEvents.map(item => [item.id + item.start.getTime(), item])).values());

    return uniqueEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

  } catch (error) {
    console.error("Erro crítico fetchCalendarEvents:", error);
    return [];
  }
};

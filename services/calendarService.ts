
import { CalendarEvent } from "../types";

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

export const fetchCalendarEvents = async (accessToken: string): Promise<CalendarEvent[]> => {
  try {
    const now = new Date();
    
    // Define o início do período como 00:00:00 de hoje para pegar eventos do dia inteiro atuais
    const startOfPeriod = new Date(now);
    startOfPeriod.setHours(0, 0, 0, 0);
    const timeMin = startOfPeriod.toISOString();
    
    // Vai até o final do próximo mês
    const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    const timeMax = endOfNextMonth.toISOString();

    // Lista simplificada de calendários para buscar (Principal + Feriados BR)
    // Não dependemos mais da lista 'calendarList' do usuário para evitar erros de permissão
    const calendarsToFetch: { id: string; name: string; color?: string }[] = [
        { id: 'primary', name: 'Principal' },
        { id: 'pt.brazilian#holiday@group.v.calendar.google.com', name: 'Feriados', color: '#e2e8f0' }
    ];

    console.log("Iniciando busca de agenda...");

    // Busca eventos em paralelo
    const allEventsPromises = calendarsToFetch.map(async (cal) => {
      // singleEvents=true expande eventos recorrentes
      const url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(cal.id)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=50&_=${Date.now()}`;
      
      try {
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });

          if (!res.ok) {
              // Se falhar o de feriados, não tem problema, mas loga o erro
              console.warn(`Aviso: Não foi possível ler calendário ${cal.name} (${res.status})`);
              return [];
          }
          
          const data = await res.json();
          return (data.items || []).map((item: any) => ({ ...item, _sourceName: cal.name }));
      } catch (e) {
          console.error(`Exceção ao ler calendário ${cal.name}`, e);
          return [];
      }
    });

    const results = await Promise.all(allEventsPromises);
    const rawEvents = results.flat();

    console.log(`Total de eventos encontrados: ${rawEvents.length}`);

    // Processamento e normalização dos dados
    const processedEvents: CalendarEvent[] = rawEvents.map((item: any) => {
      // Datas: Google retorna 'dateTime' para eventos pontuais e 'date' para dia inteiro
      // Fallback de segurança para data atual se vier vazio
      const startStr = item.start.dateTime || item.start.date;
      const endStr = item.end.dateTime || item.end.date;
      
      const start = startStr ? new Date(startStr) : new Date();
      // Ajuste de fuso horário para eventos de dia inteiro (geralmente vêm como UTC YYYY-MM-DD)
      if (!item.start.dateTime) {
          start.setHours(0,0,0,0); 
      }

      const end = endStr ? new Date(endStr) : new Date();
      if (!item.end.dateTime) {
          end.setHours(23,59,59,999);
      }

      const isAllDay = !item.start.dateTime;
      const isHoliday = item.id.includes('holiday') || (item._sourceName || '').toLowerCase().includes('feriado');
      
      // Limpa a descrição
      let description = item.description || '';
      if (isHoliday) description = 'Feriado Nacional';

      return {
        id: item.id,
        title: item.summary || '(Sem título)',
        description: description,
        location: item.location || '',
        start,
        end,
        isAllDay,
        link: item.htmlLink,
        status: item.status
      };
    });

    // Remove duplicatas e ordena
    const uniqueEvents = Array.from(new Map(processedEvents.map(item => [item.id + item.start.getTime(), item])).values());

    return uniqueEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

  } catch (error) {
    console.error("Erro crítico fetchCalendarEvents:", error);
    return [];
  }
};

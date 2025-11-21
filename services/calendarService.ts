
import { CalendarEvent } from "../types";

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

interface CalendarListEntry {
  id: string;
  summary: string;
  primary?: boolean;
}

export const fetchCalendarEvents = async (accessToken: string): Promise<CalendarEvent[]> => {
  try {
    const now = new Date();
    // Início do mês ATUAL (dia 1)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const timeMin = startOfMonth.toISOString();
    
    // Fim do MÊS SEGUINTE para garantir que pegue eventos futuros próximos
    const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    const timeMax = endOfNextMonth.toISOString();

    // 1. Buscar lista de calendários do usuário
    const listUrl = `${CALENDAR_API_BASE}/users/me/calendarList?minAccessRole=reader&_=${Date.now()}`;
    const listResponse = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    let calendarIds: { id: string; name: string; color?: string }[] = [];
    let holidayFound = false;

    if (listResponse.ok) {
      const listData = await listResponse.json();
      const items: CalendarListEntry[] = listData.items || [];
      
      items.forEach(cal => {
        const lowerSummary = cal.summary.toLowerCase();
        const lowerId = cal.id.toLowerCase();

        const isHoliday = 
            lowerId.includes('holiday') || 
            lowerId.includes('feriado') || 
            lowerSummary.includes('feriados') || 
            lowerSummary.includes('holidays') ||
            lowerId.includes('brazilian');
            
        if (isHoliday) holidayFound = true;

        if (cal.primary || isHoliday) {
          calendarIds.push({ 
            id: cal.id, 
            name: cal.summary,
            color: isHoliday ? '#e2e8f0' : undefined
          });
        }
      });
    } else {
      // Fallback básico se a lista falhar
      calendarIds.push({ id: 'primary', name: 'Principal' });
    }

    // 2. Se não encontrou feriados explicitamente, força a adição do calendário público BR
    if (!holidayFound) {
        calendarIds.push({ 
            id: 'pt.brazilian#holiday@group.v.calendar.google.com', 
            name: 'Feriados', 
            color: '#e2e8f0' 
        });
    }

    // Garantia de fallback se a lista vier vazia
    if (calendarIds.length === 0) {
        calendarIds.push({ id: 'primary', name: 'Principal' });
    }

    // 3. Busca eventos de todos os calendários identificados
    const allEventsPromises = calendarIds.map(async (cal) => {
      const url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(cal.id)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=100&_=${Date.now()}`;
      
      try {
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });

          if (!res.ok) {
              // Se falhar (ex: 404 no calendário de feriados), retorna vazio mas loga
              console.warn(`Falha ao ler calendário: ${cal.name} (${res.status})`);
              return [];
          }
          
          const data = await res.json();
          return (data.items || []).map((item: any) => ({ ...item, _sourceName: cal.name }));
      } catch (e) {
          console.warn(`Erro de conexão ao buscar calendário ${cal.name}`, e);
          return [];
      }
    });

    const results = await Promise.all(allEventsPromises);
    const rawEvents = results.flat();

    // 4. Processa e normaliza os dados
    const processedEvents: CalendarEvent[] = rawEvents.map((item: any) => {
      // Tratamento robusto de datas (dia inteiro vs horário específico)
      const start = item.start.dateTime ? new Date(item.start.dateTime) : new Date(item.start.date + 'T00:00:00');
      const end = item.end.dateTime ? new Date(item.end.dateTime) : new Date(item.end.date + 'T23:59:59');
      const isAllDay = !item.start.dateTime;

      // Identifica se é evento de feriado
      const isHoliday = 
          item._sourceName?.toLowerCase().includes('feriados') || 
          item._sourceName?.toLowerCase().includes('holidays') || 
          (item.kind === 'calendar#event' && !item.organizer) ||
          item.id.includes('holiday');
      
      const description = isHoliday 
        ? `Feriado` 
        : (item.description || '');

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

    // Ordena cronologicamente
    return processedEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

  } catch (error) {
    console.error("Erro crítico no calendarService:", error);
    return [];
  }
};


import { CalendarEvent } from "../types";

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

interface CalendarListEntry {
  id: string;
  summary: string;
  primary?: boolean;
}

export const fetchCalendarEvents = async (accessToken: string): Promise<CalendarEvent[]> => {
  try {
    // 1. Define intervalo: Do dia 1 do mês atual até +45 dias
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const timeMin = startOfMonth.toISOString();
    
    const nextMonth = new Date();
    nextMonth.setDate(now.getDate() + 45); 
    const timeMax = nextMonth.toISOString();

    // 2. Buscar lista de calendários para encontrar "Primary" e "Feriados"
    const listUrl = `${CALENDAR_API_BASE}/users/me/calendarList?minAccessRole=reader&_=${Date.now()}`;
    const listResponse = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    let calendarIds: { id: string; name: string; color?: string }[] = [];

    if (listResponse.ok) {
      const listData = await listResponse.json();
      const items: CalendarListEntry[] = listData.items || [];
      
      // Filtra: Calendário primário OU calendários que pareçam ser Feriados
      items.forEach(cal => {
        const isHoliday = cal.summary.toLowerCase().includes('feriados') || cal.summary.toLowerCase().includes('holidays') || cal.id.includes('holiday');
        if (cal.primary || isHoliday) {
          calendarIds.push({ 
            id: cal.id, 
            name: cal.summary,
            color: isHoliday ? '#e2e8f0' : undefined // Cor neutra para feriados visualmente
          });
        }
      });
    } else {
      // Fallback se listar calendários falhar: tenta apenas 'primary'
      calendarIds.push({ id: 'primary', name: 'Principal' });
    }

    // 3. Busca eventos de todos os calendários selecionados em paralelo
    const allEventsPromises = calendarIds.map(async (cal) => {
      const url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(cal.id)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=50&_=${Date.now()}`;
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!res.ok) return [];
      const data = await res.json();
      return (data.items || []).map((item: any) => ({ ...item, _sourceName: cal.name }));
    });

    const results = await Promise.all(allEventsPromises);
    const rawEvents = results.flat();

    // 4. Processa e normaliza os eventos
    const processedEvents: CalendarEvent[] = rawEvents.map((item: any) => {
      // Parsing seguro de datas
      const start = item.start.dateTime ? new Date(item.start.dateTime) : new Date(item.start.date + 'T00:00:00');
      const end = item.end.dateTime ? new Date(item.end.dateTime) : new Date(item.end.date + 'T23:59:59');
      const isAllDay = !item.start.dateTime;

      // Identifica se é feriado pelo nome do calendário
      const isHoliday = item._sourceName?.toLowerCase().includes('feriados') || item._sourceName?.toLowerCase().includes('holidays');
      
      // Adiciona o nome do calendário na descrição se for feriado
      const description = isHoliday 
        ? `Feriado (${item._sourceName})` 
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

    // Ordena por data
    return processedEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

  } catch (error) {
    console.error("Erro ao buscar eventos:", error);
    throw error;
  }
};

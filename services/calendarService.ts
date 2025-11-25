

import { CalendarEvent } from "../types";

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

export const fetchCalendarEvents = async (accessToken: string, calendarIds: string[]): Promise<CalendarEvent[]> => {
  try {
    const now = new Date();
    
    // Define o início do período como 00:00:00 de hoje
    const startOfPeriod = new Date(now);
    startOfPeriod.setHours(0, 0, 0, 0);
    const timeMin = startOfPeriod.toISOString();
    
    // Vai até o final do próximo mês
    const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    const timeMax = endOfNextMonth.toISOString();

    // Se a lista estiver vazia, usa o primário por padrão
    const targets = calendarIds.length > 0 ? calendarIds : ['primary'];
    
    // Adiciona sempre feriados brasileiros se não estiver na lista
    const holidaysId = 'pt-br.brazilian#holiday@group.v.calendar.google.com';
    if (!targets.includes(holidaysId) && !targets.some(id => id.includes('holiday'))) {
        targets.push(holidaysId);
    }

    console.log("Buscando agendas:", targets);

    const allEventsPromises = targets.map(async (calId) => {
      // singleEvents=true expande eventos recorrentes
      const url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calId)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=50&_=${Date.now()}`;
      
      try {
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });

          if (!res.ok) {
              console.warn(`Falha ao ler calendário ${calId}: ${res.status}`);
              return [];
          }
          
          const data = await res.json();
          // Tenta usar o summary do calendario como nome da fonte, ou o ID
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
      // Datas: Google retorna 'dateTime' para eventos pontuais e 'date' para dia inteiro
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

    // Remove duplicatas (mesmo ID e mesmo horário de início)
    const uniqueEvents = Array.from(new Map(processedEvents.map(item => [item.id + item.start.getTime(), item])).values());

    return uniqueEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

  } catch (error) {
    console.error("Erro crítico fetchCalendarEvents:", error);
    return [];
  }
};
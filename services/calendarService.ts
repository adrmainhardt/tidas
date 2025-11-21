

import { CalendarEvent } from "../types";

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3/calendars';

export const fetchCalendarEvents = async (accessToken: string): Promise<CalendarEvent[]> => {
  try {
    const now = new Date();
    
    // FIX: Buscar eventos desde 7 dias atrás.
    // Se buscarmos apenas 'past24h' ou 'now', a API pode filtrar eventos recorrentes 
    // ou eventos que começaram de manhã cedo dependendo do fuso horário UTC x Local.
    // É mais seguro baixar um pouco mais de dados e filtrar "Hoje" no frontend.
    const past7Days = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    const timeMin = past7Days.toISOString();
    
    const nextMonth = new Date();
    nextMonth.setDate(now.getDate() + 45); 
    const timeMax = nextMonth.toISOString();

    // singleEvents=true expande eventos recorrentes
    const url = `${CALENDAR_API_BASE}/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=100&_=${Date.now()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Calendar API Error:", response.status, errorText);
      if (response.status === 401) throw new Error("AUTH_EXPIRED");
      if (response.status === 403) throw new Error("API_NOT_ENABLED");
      throw new Error("Failed to fetch calendar");
    }

    const data = await response.json();
    
    if (!data.items) return [];

    return data.items.map((item: any) => {
      // Parsing seguro de datas
      // Se for dateTime, usa new Date. Se for date (dia inteiro), adiciona T00:00 para evitar inconsistência
      const start = item.start.dateTime ? new Date(item.start.dateTime) : new Date(item.start.date + 'T00:00:00');
      const end = item.end.dateTime ? new Date(item.end.dateTime) : new Date(item.end.date + 'T23:59:59');
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

  } catch (error) {
    console.error("Erro ao buscar eventos:", error);
    throw error;
  }
};
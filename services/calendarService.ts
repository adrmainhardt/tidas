
import { CalendarEvent } from "../types";

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3/calendars';

export const fetchCalendarEvents = async (accessToken: string): Promise<CalendarEvent[]> => {
  try {
    // Define intervalo: Hoje até 7 dias à frente
    const now = new Date();
    const timeMin = now.toISOString();
    
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);
    const timeMax = nextWeek.toISOString();

    const url = `${CALENDAR_API_BASE}/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=20&_=${Date.now()}`;

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


export enum SiteStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  CHECKING = 'CHECKING',
  UNKNOWN = 'UNKNOWN'
}

export interface SiteConfig {
  id: string;
  name: string;
  url: string;
  apiKey?: string; // Chave de segurança para conectar ao WP
  lastChecked?: Date;
  status: SiteStatus;
  responseTime?: number; // in ms
  onlineUsers?: number; // Quantidade de pessoas online agora
  monthlyVisitors?: number; // Quantidade total de visitantes no mês
}

export interface FormSubmission {
  id: string;
  siteId: string;
  senderName: string;
  senderEmail: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
}

export interface EmailMessage {
  id: string;
  sender: string;
  subject: string;
  snippet: string;
  body: string; // Conteúdo completo HTML ou Texto
  date: Date;
  isUnread: boolean;
  label: 'Primary' | 'Updates' | 'Promotions';
}

export interface SlackMessage {
  id: string;
  userId: string;
  userName: string;
  avatar: string;
  text: string;
  timestamp: Date;
  isRead: boolean;
  channelId: string;
}

// Tipos do Trello
export interface TrelloBoard {
  id: string;
  name: string;
}

export interface TrelloList {
  id: string;
  name: string;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  dateLastActivity: Date;
  listId: string;
  listName?: string; // Preenchido pelo frontend
  url: string;
  labels: { id: string; name: string; color: string }[];
}

// Tipos de Clima
export interface WeatherData {
  current: {
    temp: number;
    code: number;
  };
  today: {
    min: number;
    max: number;
    code: number;
  };
  tomorrow: {
    min: number;
    max: number;
    code: number;
  };
  weekSummary?: string; // Resumo textual dos próximos dias
  locationName?: string;
}

// Tipos de Calendário
export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  link?: string;
  status?: string;
}

// Preferências do Dashboard
export interface DashboardPrefs {
  showSites: boolean;
  showTrello: boolean;
  showGoogle: boolean;
  showWeather: boolean;
  showCalendar: boolean;
  googleApiKey?: string; // Nova chave para persistir a API Key pública
}

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  WEBSITES = 'WEBSITES', // Unificado (Sites + Forms)
  GOOGLE = 'GOOGLE',
  TRELLO = 'TRELLO',
  CALENDAR = 'CALENDAR'
}

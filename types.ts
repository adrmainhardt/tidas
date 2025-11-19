
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
  date: Date;
  isUnread: boolean;
  label: 'Primary' | 'Updates' | 'Promotions';
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

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  SITES = 'SITES',
  FORMS = 'FORMS',
  GMAIL = 'GMAIL',
  TRELLO = 'TRELLO'
}

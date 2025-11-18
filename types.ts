
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

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  SITES = 'SITES',
  FORMS = 'FORMS'
}

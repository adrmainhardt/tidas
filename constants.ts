
import { SiteConfig, SiteStatus, FormSubmission } from './types';

// Chave secreta definida pelo usuário
// Essa chave DEVE ser exatamente igual à variável $api_key_secret no código PHP do WordPress
const SHARED_SECRET_KEY = '157918';

export const DEFAULT_SITES: SiteConfig[] = [
  {
    id: '1',
    name: 'Tidas',
    url: 'https://www.tidas.com.br',
    apiKey: SHARED_SECRET_KEY, 
    status: SiteStatus.UNKNOWN,
    onlineUsers: 0,
    monthlyVisitors: 0,
  },
  {
    id: '2',
    name: 'Crediário Servipa',
    url: 'https://www.crediarioservipa.com.br',
    apiKey: SHARED_SECRET_KEY,
    status: SiteStatus.UNKNOWN,
    onlineUsers: 0,
    monthlyVisitors: 0,
  },
  {
    id: '3',
    name: 'Acessiva',
    url: 'https://acessiva.com.vc',
    apiKey: SHARED_SECRET_KEY,
    status: SiteStatus.UNKNOWN,
    onlineUsers: 0,
    monthlyVisitors: 0,
  }
];

// Dados iniciais de exemplo
export const MOCK_FORMS: FormSubmission[] = [];
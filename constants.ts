
import { SiteConfig, SiteStatus, FormSubmission } from './types';

// Chave secreta definida pelo usuário
// Essa chave DEVE ser exatamente igual à variável $api_key_secret no código PHP do WordPress
const SHARED_SECRET_KEY = '157918';

// IMPORTANTE: Cole sua chave da Google Gemini API aqui para funcionar no celular
// O ambiente mobile muitas vezes não carrega o process.env corretamente.
export const FALLBACK_API_KEY = 'AIzaSyCSVY3e2kD2B83ZvkylABltY_FRPfJ0qrc';

// IMPORTANTE: Substitua pelo seu Client ID do Google Cloud Console
export const GOOGLE_CLIENT_ID = '914404526546-l7d1ke1tp2uu8nrfp9a3aj8eenlpvefs.apps.googleusercontent.com';

// Chaves do Trello fornecidas
export const TRELLO_API_KEY = '5bd12042605908ade0819114a512a3b4';
export const TRELLO_TOKEN = 'ATTA939dc756fb21357676752f93741d20fb7450071699ab6d82ce75e271c5e90f1017EA19D4';

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

export const DEFAULT_NEWS_TOPICS = [
  "counter-strike", 
  "vasco", 
  "f1", 
  "rio do sul", 
  "santa catarina"
];

// Dados iniciais de exemplo
export const MOCK_FORMS: FormSubmission[] = [];
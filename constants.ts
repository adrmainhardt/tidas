export const THEME = {
  primary: '#00243a',
  secondary: '#003554', // Slightly lighter for cards
  accent: '#70d44c',
  text: '#ffffff',
  textMuted: '#94a3b8',
  danger: '#ef4444',
  warning: '#f59e0b',
};

export const LOGO_URL = "https://tidas.com.br/wp-content/uploads/2025/08/logo_tidas_rodan2.svg";

// O ID da planilha (Sheet ID) retirado do link
export const SHEET_ID = '1QIN_LjzbrnXxOg9HJ9dQ6H3Y-a_P37SfW6rD2ii3XWs';
export const OTHERS_SHEET_ID = '1X9iCDEYfGRqp9ey8prjDkwJxMHjtAWpFCOLK7RAg7HM';

// CONFIGURAÇÃO DAS ABAS (TABS) - IDs fornecidos pelo usuário
export const SHEET_TAB_IDS = {
  MARKETING: '78259475',       // Marketing
  NEW_BUSINESS: '887251014',   // Novos negócios
  WON: '293370756',            // Negócios ganhos
  LOST: '182515415',           // Negócios perdidos
  STORES_INSTALLED: '0',       // Lojas Instaladas
  NEW_OPPORTUNITIES: '422202966', // Novas Oportunidades
  GOALS: '685742372',          // Metas
  OTHERS: '1942815657'         // Niver
};

export const CURRENCY_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export const DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
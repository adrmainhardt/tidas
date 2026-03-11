import { SheetGrid, Tab, AppData } from '../types';
import { SHEET_ID, SHEET_TAB_IDS } from '../constants';

// Parser robusto para CSV que lida com aspas e vírgulas/ponto-e-vírgula dentro de células
const parseCSVToGrid = (csvText: string): SheetGrid => {
  const rows: SheetGrid = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  // Normaliza quebras de linha
  const sanitizedText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Detecta o separador (vírgula ou ponto-e-vírgula)
  // Conta ocorrências fora de aspas na primeira linha
  let firstLine = sanitizedText.split('\n')[0];
  let commaCount = 0;
  let semiCount = 0;
  let tempInQuotes = false;
  for (const char of firstLine) {
    if (char === '"') tempInQuotes = !tempInQuotes;
    if (!tempInQuotes) {
      if (char === ',') commaCount++;
      if (char === ';') semiCount++;
    }
  }
  const separator = semiCount > commaCount ? ';' : ',';

  for (let i = 0; i < sanitizedText.length; i++) {
    const char = sanitizedText[i];
    const nextChar = sanitizedText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === separator) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\n') {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }
  
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(cell => cell !== '')) {
        rows.push(currentRow);
    }
  }

  return rows;
};

// Gera dados vazios/exemplo caso falhe
const generateMockGrid = (title: string): SheetGrid => {
  return [
    [title, 'Jan', 'Fev', 'Mar', 'Total'],
    ['Origem A', '10', '20', '30', '60'],
    ['Origem B', '5', '15', '25', '45'],
    ['Total', '15', '35', '55', '105']
  ];
};

export const fetchAllSheetData = async (
  sheetId: string = SHEET_ID, 
  othersGid: string = SHEET_TAB_IDS.OTHERS,
  othersSheetId: string = SHEET_ID,
  storesGid: string = SHEET_TAB_IDS.STORES_INSTALLED,
  opportunitiesGid: string = SHEET_TAB_IDS.NEW_OPPORTUNITIES,
  goalsGid: string = SHEET_TAB_IDS.GOALS,
  marketingGid: string = SHEET_TAB_IDS.MARKETING,
  newBusinessGid: string = SHEET_TAB_IDS.NEW_BUSINESS,
  wonGid: string = SHEET_TAB_IDS.WON,
  lostGid: string = SHEET_TAB_IDS.LOST
): Promise<AppData> => {
  const getBaseUrl = (id: string) => `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=`;

  const fetchDataForTab = async (id: string, gid: string, tabName: string, retries = 2): Promise<SheetGrid> => {
    if (gid === undefined || gid === null || gid === '') return []; 
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout per attempt

      try {
        const response = await fetch(getBaseUrl(id) + gid, { 
          signal: controller.signal,
          cache: 'no-store' // Ensure we get fresh data
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const text = await response.text();
        clearTimeout(timeoutId);
        
        if (!text || text.length < 10) {
          throw new Error(`Conteúdo vazio ou inválido para aba ${tabName}`);
        }
        
        return parseCSVToGrid(text);
      } catch (error: any) {
        clearTimeout(timeoutId);
        const isLastAttempt = attempt === retries;
        
        if (isLastAttempt) {
          console.warn(`Falha definitiva ao carregar aba ${tabName} após ${retries + 1} tentativas:`, error);
          // Return empty instead of mock to allow validation in App.tsx to catch it
          return []; 
        }
        
        // Wait a bit before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
    return [];
  };

  try {
    const [marketing, newBusiness, won, lost, stores, opportunities, goals, others] = await Promise.all([
      fetchDataForTab(sheetId, marketingGid, 'Marketing'),
      fetchDataForTab(sheetId, newBusinessGid, 'Novos Negócios'),
      fetchDataForTab(sheetId, wonGid, 'Ganhos'),
      fetchDataForTab(sheetId, lostGid, 'Perdidos'),
      fetchDataForTab(othersSheetId, storesGid, 'Lojas Instaladas'),
      fetchDataForTab(othersSheetId, opportunitiesGid, 'Novas Oportunidades'),
      fetchDataForTab(othersSheetId, goalsGid, 'Metas'),
      fetchDataForTab(othersSheetId, othersGid, 'Outros'),
    ]);

    return {
      [Tab.MARKETING]: marketing,
      [Tab.NEW_BUSINESS]: newBusiness,
      [Tab.WON]: won,
      [Tab.LOST]: lost,
      [Tab.STORES_INSTALLED]: stores,
      [Tab.NEW_OPPORTUNITIES]: opportunities,
      [Tab.GOALS]: goals,
      [Tab.OTHERS]: others,
    };
  } catch (e) {
    console.error("Erro geral carregando dados", e);
    return {};
  }
};

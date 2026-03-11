
export interface DashboardMetrics {
  totalRevenue: number;
  totalLeads: number;
  totalNewBusiness: number;
  totalLost: number;
  winRate: number;
  activePipelineValue: number;
  dealsBySource: Record<string, number>;
}

// Representa a grade exata da planilha (Linhas x Colunas)
export type SheetRow = string[];
export type SheetGrid = SheetRow[];

export enum Tab {
  HOME = 'home',
  MARKETING = 'marketing',
  NEW_BUSINESS = 'new_business',
  WON = 'won',
  LOST = 'lost',
  COMMERCIAL_DATA = 'commercial_data',
  STORES_INSTALLED = 'stores_installed',
  NEW_OPPORTUNITIES = 'new_opportunities',
  GOALS = 'goals',
  OTHERS = 'others',
}

export type AppData = {
  [key in Tab]?: SheetGrid;
};
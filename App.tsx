
import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import KpiCard from './components/KpiCard';
import WeatherWidget from './components/WeatherWidget';
import SlideshowCard from './components/SlideshowCard';
import MetasSlideshowCard from './components/MetasSlideshowCard';
import SortableDashboardItem from './components/SortableDashboardItem';
import { Sparkline } from './components/Charts';
import { AppData, SheetGrid, Tab, DashboardMetrics } from './types';
import { fetchAllSheetData } from './services/dataService';
import { generateDashboardInsights } from './services/geminiService';
import { CURRENCY_FORMATTER, THEME } from './constants';
import { RefreshCw, BrainCircuit, Loader2, Info, Settings2, Check, Settings, X, Cake, Clock, Coffee, ChevronUp, ChevronDown, Eye, EyeOff, GripVertical, Bell, PlusCircle, TrendingUp, Store, Users, Target, Play, MousePointer2, Handshake, Instagram } from 'lucide-react';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  TouchSensor
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { SHEET_ID, OTHERS_SHEET_ID, SHEET_TAB_IDS } from './constants';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const saved = localStorage.getItem('activeTab');
    return (saved as Tab) || Tab.HOME;
  });

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);
  const [data, setData] = useState<AppData>(() => {
    const saved = localStorage.getItem('dashboardData');
    try {
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  const [loading, setLoading] = useState(false); // Default to false if we have saved data
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(() => localStorage.getItem('lastUpdated'));
  const loadingRef = React.useRef(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  
  // Auto-cycle state
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [cycleDuration, setCycleDuration] = useState<number>(() => {
    const saved = localStorage.getItem('cycleDuration');
    return saved ? parseInt(saved) : 300000; // Default 5 min
  });
  const PROGRESS_INTERVAL = 100; // Update progress every 100ms

  // Global Settings State
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [isSourcesCollapsed, setIsSourcesCollapsed] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const SIDEBAR_VERSION = '2.0';
    const savedVersion = localStorage.getItem('sidebarVersion');
    const saved = localStorage.getItem('isSidebarCollapsed');
    
    if (saved !== null && savedVersion === SIDEBAR_VERSION) {
      return saved === 'true';
    }
    
    localStorage.setItem('sidebarVersion', SIDEBAR_VERSION);
    return true; // Default to collapsed
  });

  const parseDate = (dateStr: string) => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  };

  const [sheetId, setSheetId] = useState<string>(() => {
    return localStorage.getItem('sheetId') || SHEET_ID;
  });
  const [othersSheetId, setOthersSheetId] = useState<string>(() => {
    return localStorage.getItem('othersSheetId') || OTHERS_SHEET_ID;
  });
  const [othersGid, setOthersGid] = useState<string>(() => {
    return localStorage.getItem('othersGid') || SHEET_TAB_IDS.OTHERS;
  });
  const [storesGid, setStoresGid] = useState<string>(() => {
    return localStorage.getItem('storesGid') || SHEET_TAB_IDS.STORES_INSTALLED;
  });
  const [opportunitiesGid, setOpportunitiesGid] = useState<string>(() => {
    return localStorage.getItem('opportunitiesGid') || SHEET_TAB_IDS.NEW_OPPORTUNITIES;
  });
  const [goalsGid, setGoalsGid] = useState<string>(() => {
    return localStorage.getItem('goalsGid') || SHEET_TAB_IDS.GOALS;
  });
  const [marketingGid, setMarketingGid] = useState<string>(() => {
    return localStorage.getItem('marketingGid') || SHEET_TAB_IDS.MARKETING;
  });
  const [newBusinessGid, setNewBusinessGid] = useState<string>(() => {
    return localStorage.getItem('newBusinessGid') || SHEET_TAB_IDS.NEW_BUSINESS;
  });
  const [wonGid, setWonGid] = useState<string>(() => {
    return localStorage.getItem('wonGid') || SHEET_TAB_IDS.WON;
  });
  const [lostGid, setLostGid] = useState<string>(() => {
    return localStorage.getItem('lostGid') || SHEET_TAB_IDS.LOST;
  });
  const [refreshInterval, setRefreshInterval] = useState<number>(() => {
    const saved = localStorage.getItem('refreshInterval');
    const val = saved ? parseInt(saved) : 900000; // Default 15 min
    return isNaN(val) || val < 60000 ? 900000 : val; // Min 1 min
  });

  // Marketing Dashboard State
  const [pinnedMarketingItems, setPinnedMarketingItems] = useState<string[]>(() => {
    const saved = localStorage.getItem('pinnedMarketingItems');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [hiddenMarketingItems, setHiddenMarketingItems] = useState<string[]>(() => {
    const saved = localStorage.getItem('hiddenMarketingItems');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [showMarketingSettings, setShowMarketingSettings] = useState(false);
  const [customMarketingTitles, setCustomMarketingTitles] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('customMarketingTitles');
    try {
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Sales Dashboard State
  const [pinnedSalesItems, setPinnedSalesItems] = useState<string[]>(() => {
    const saved = localStorage.getItem('pinnedSalesItems');
    try {
      // Default to empty as requested: "Na configuração inicial vir com todos os quadros destaques fechados"
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [hiddenSalesItems, setHiddenSalesItems] = useState<string[]>(() => {
    const saved = localStorage.getItem('hiddenSalesItems');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [showSalesSettings, setShowSalesSettings] = useState(false);
  const [customSalesTitles, setCustomSalesTitles] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('customSalesTitles');
    try {
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Finance Dashboard State
  const [pinnedFinanceItems, setPinnedFinanceItems] = useState<string[]>(() => {
    const saved = localStorage.getItem('pinnedFinanceItems');
    try {
      // Default to empty as requested
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [hiddenFinanceItems, setHiddenFinanceItems] = useState<string[]>(() => {
    const saved = localStorage.getItem('hiddenFinanceItems');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [showFinanceSettings, setShowFinanceSettings] = useState(false);
  const [spreadsheetSearchQuery, setSpreadsheetSearchQuery] = useState('');
  const [customFinanceTitles, setCustomFinanceTitles] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('customFinanceTitles');
    try {
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Lost Dashboard State
  const [pinnedLostItems, setPinnedLostItems] = useState<string[]>(() => {
    const saved = localStorage.getItem('pinnedLostItems');
    try {
      // Default to empty as requested
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [hiddenLostItems, setHiddenLostItems] = useState<string[]>(() => {
    const saved = localStorage.getItem('hiddenLostItems');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [showLostSettings, setShowLostSettings] = useState(false);
  const [customLostTitles, setCustomLostTitles] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('customLostTitles');
    try {
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Home Dashboard State
  const [homeLayout, setHomeLayout] = useState<Record<string, string[]>>(() => {
    const LAYOUT_VERSION = '20.0'; // Force reset to version 20.0
    const savedVersion = localStorage.getItem('homeLayoutVersion');
    const saved = localStorage.getItem('homeLayout');
    
    if (saved && savedVersion === LAYOUT_VERSION) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    
    // If no saved layout or version mismatch, use the new default and save version
    localStorage.setItem('homeLayoutVersion', LAYOUT_VERSION);
    return {
      negocios: [
        'Dados Comerciais - Total de Lojas Instaladas',
        'Dados Comerciais - Metas',
        'Dados Comerciais - Negócios iniciados',
        'Marketing - Oportunidades',
        'Marketing - Clientes comprando',
        'Marketing - Baixaram o App',
        'Marketing - Uso App'
      ],
      marketing: [
        'Marketing - Instagram',
        'Marketing - Visita site',
        'Marketing - Insc. do Canal (Youtube)',
        'Marketing - Visualizações do Canal'
      ],
      outros: ['Clima', 'Aniversariantes', 'Tempo de Empresa', 'Notificações']
    };
  });

  const [editingHomeTitleId, setEditingHomeTitleId] = useState<string | null>(null);

  const [hiddenHomeItems, setHiddenHomeItems] = useState<string[]>(() => {
    const saved = localStorage.getItem('hiddenHomeItems');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [showHomeSettings, setShowHomeSettings] = useState(false);
  const [customHomeTitles, setCustomHomeTitles] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('customHomeTitles');
    try {
      return saved ? JSON.parse(saved) : {
        'Marketing - Visualizações do Canal': 'Visualizações Youtube',
        'Marketing - Insc. do Canal (Youtube)': 'Inscritos Youtube',
        'Marketing - Inscritos Youtube': 'Inscritos Youtube',
        'Marketing - Visita site': 'Visita Site',
        'Marketing - Instagram': 'Instagram',
        'Marketing - Clientes comprando': 'Clientes Comprando',
        'Marketing - Oportunidades': 'Oportunidades',
        'Marketing - Uso App': 'Uso App',
        'Marketing - Baixaram o App': 'Baixaram o App',
        'Dados Comerciais - Total de Lojas Instaladas': 'Total de Lojas Instaladas',
        'Dados Comerciais - Metas': 'Meta Mês Fevereiro - SC',
        'Dados Comerciais - Negócios iniciados': 'Negócios Iniciados'
      };
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('isSidebarCollapsed', isSidebarCollapsed.toString());
  }, [isSidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem('customHomeTitles', JSON.stringify(customHomeTitles));
  }, [customHomeTitles]);

  useEffect(() => {
    localStorage.setItem('customMarketingTitles', JSON.stringify(customMarketingTitles));
  }, [customMarketingTitles]);

  useEffect(() => {
    localStorage.setItem('customSalesTitles', JSON.stringify(customSalesTitles));
  }, [customSalesTitles]);

  useEffect(() => {
    localStorage.setItem('customFinanceTitles', JSON.stringify(customFinanceTitles));
  }, [customFinanceTitles]);

  useEffect(() => {
    localStorage.setItem('pinnedMarketingItems', JSON.stringify(pinnedMarketingItems));
  }, [pinnedMarketingItems]);

  useEffect(() => {
    localStorage.setItem('pinnedSalesItems', JSON.stringify(pinnedSalesItems));
  }, [pinnedSalesItems]);

  useEffect(() => {
    localStorage.setItem('pinnedFinanceItems', JSON.stringify(pinnedFinanceItems));
  }, [pinnedFinanceItems]);

  const [showAiModal, setShowAiModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // DND Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const findContainer = (id: string) => {
    if (id in homeLayout) return id;
    return Object.keys(homeLayout).find((key) => homeLayout[key].includes(id));
  };

  const handleDragOverHome = (event: any) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId) || overId;

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    setHomeLayout((prev) => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer] || [];

      const activeIndex = activeItems.indexOf(activeId);
      const overIndex = overItems.indexOf(overId);

      let newIndex;
      if (overId in prev) {
        newIndex = overItems.length + 1;
      } else {
        const isBelowLastItem = over && overIndex === overItems.length - 1;
        const modifier = isBelowLastItem ? 1 : 0;
        newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
      }

      return {
        ...prev,
        [activeContainer]: activeItems.filter((item) => item !== activeId),
        [overContainer]: [
          ...overItems.slice(0, newIndex),
          activeId,
          ...overItems.slice(newIndex, overItems.length)
        ]
      };
    });
  };

  const handleDragEndHome = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId) || overId;

    if (!activeContainer || !overContainer || activeContainer !== overContainer) {
      return;
    }

    const activeIndex = homeLayout[activeContainer].indexOf(activeId);
    const overIndex = homeLayout[overContainer].indexOf(overId);

    if (activeIndex !== overIndex) {
      setHomeLayout((prev) => ({
        ...prev,
        [overContainer]: arrayMove(prev[overContainer], activeIndex, overIndex)
      }));
    }
  };

  const handleDragEndMarketing = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPinnedMarketingItems((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleDragEndSales = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPinnedSalesItems((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleDragEndFinance = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPinnedFinanceItems((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleDragEndLost = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPinnedLostItems((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const dataRef = React.useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Load Data
  const loadData = React.useCallback(async () => {
    if (loadingRef.current) return;
    
    // Safety timeout for the entire loading process
    const safetyTimeout = setTimeout(() => {
        if (loadingRef.current) {
            console.warn("loadData safety timeout reached. Forcing loading state to false.");
            setLoading(false);
            loadingRef.current = false;
        }
    }, 45000); // 45 seconds safety timeout

    try {
        loadingRef.current = true;
        // Only show full-screen loading if we have NO data at all
        const hasData = Object.keys(dataRef.current).length > 0;
        if (!hasData) {
            setLoading(true);
        } else {
            setIsRefreshing(true);
        }
        
        const result = await fetchAllSheetData(
            sheetId, 
            othersGid, 
            othersSheetId, 
            storesGid, 
            opportunitiesGid, 
            goalsGid,
            marketingGid,
            newBusinessGid,
            wonGid,
            lostGid
        );
        
        // Validation: Only update if we got actual data rows in at least one tab
        // to prevent clearing the dashboard on transient errors or empty responses
        const hasActualData = result && Object.keys(result).some(key => {
            const grid = result[key as Tab];
            return grid && grid.length > 1; // More than just headers
        });

        if (hasActualData) {
            setData(result);
            setRefreshError(false);
            const now = new Date().toLocaleString('pt-BR');
            setLastUpdated(now);
            localStorage.setItem('dashboardData', JSON.stringify(result));
            localStorage.setItem('lastUpdated', now);
        } else {
            console.warn("Dados recebidos parecem vazios ou inválidos. Mantendo dados anteriores.");
            if (hasData) setRefreshError(true);
        }
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        setRefreshError(true);
    } finally {
        clearTimeout(safetyTimeout);
        setLoading(false);
        setIsRefreshing(false);
        loadingRef.current = false;
    }
  }, [sheetId, othersGid, othersSheetId, storesGid, opportunitiesGid, goalsGid, marketingGid, newBusinessGid, wonGid, lostGid]);

  useEffect(() => {
    localStorage.setItem('cycleDuration', cycleDuration.toString());
  }, [cycleDuration]);

  useEffect(() => {
    localStorage.setItem('sheetId', sheetId);
  }, [sheetId]);

  useEffect(() => {
    localStorage.setItem('othersSheetId', othersSheetId);
  }, [othersSheetId]);

  useEffect(() => {
    localStorage.setItem('pinnedMarketingItems', JSON.stringify(pinnedMarketingItems));
  }, [pinnedMarketingItems]);

  useEffect(() => {
    localStorage.setItem('hiddenMarketingItems', JSON.stringify(hiddenMarketingItems));
  }, [hiddenMarketingItems]);

  useEffect(() => {
    localStorage.setItem('homeLayout', JSON.stringify(homeLayout));
  }, [homeLayout]);

  useEffect(() => {
    localStorage.setItem('hiddenHomeItems', JSON.stringify(hiddenHomeItems));
  }, [hiddenHomeItems]);

  useEffect(() => {
    localStorage.setItem('othersGid', othersGid);
  }, [othersGid]);

  useEffect(() => {
    localStorage.setItem('storesGid', storesGid);
  }, [storesGid]);

  useEffect(() => {
    localStorage.setItem('opportunitiesGid', opportunitiesGid);
  }, [opportunitiesGid]);

  useEffect(() => {
    localStorage.setItem('goalsGid', goalsGid);
  }, [goalsGid]);

  useEffect(() => {
    localStorage.setItem('marketingGid', marketingGid);
  }, [marketingGid]);

  useEffect(() => {
    localStorage.setItem('newBusinessGid', newBusinessGid);
  }, [newBusinessGid]);

  useEffect(() => {
    localStorage.setItem('wonGid', wonGid);
  }, [wonGid]);

  useEffect(() => {
    localStorage.setItem('lostGid', lostGid);
  }, [lostGid]);

  useEffect(() => {
    localStorage.setItem('pinnedSalesItems', JSON.stringify(pinnedSalesItems));
  }, [pinnedSalesItems]);

  useEffect(() => {
    localStorage.setItem('hiddenSalesItems', JSON.stringify(hiddenSalesItems));
  }, [hiddenSalesItems]);

  useEffect(() => {
    localStorage.setItem('customSalesTitles', JSON.stringify(customSalesTitles));
  }, [customSalesTitles]);

  useEffect(() => {
    localStorage.setItem('pinnedFinanceItems', JSON.stringify(pinnedFinanceItems));
  }, [pinnedFinanceItems]);

  useEffect(() => {
    localStorage.setItem('hiddenFinanceItems', JSON.stringify(hiddenFinanceItems));
  }, [hiddenFinanceItems]);

  useEffect(() => {
    localStorage.setItem('customFinanceTitles', JSON.stringify(customFinanceTitles));
  }, [customFinanceTitles]);

  useEffect(() => {
    localStorage.setItem('pinnedLostItems', JSON.stringify(pinnedLostItems));
  }, [pinnedLostItems]);

  useEffect(() => {
    localStorage.setItem('hiddenLostItems', JSON.stringify(hiddenLostItems));
  }, [hiddenLostItems]);

  useEffect(() => {
    localStorage.setItem('customLostTitles', JSON.stringify(customLostTitles));
  }, [customLostTitles]);

  useEffect(() => {
    localStorage.setItem('refreshInterval', refreshInterval.toString());
  }, [refreshInterval]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, refreshInterval);
    return () => clearInterval(interval);
  }, [loadData, refreshInterval]);

  useEffect(() => {
    if (!isPlaying) setProgress(0);
  }, [isPlaying]);

  useEffect(() => {
    setProgress(0);
  }, [activeTab]);

  useEffect(() => {
    let progressTimer: NodeJS.Timeout;

    if (isPlaying) {
      const tabs = [Tab.HOME, Tab.MARKETING, Tab.NEW_BUSINESS, Tab.WON, Tab.LOST, Tab.COMMERCIAL_DATA, Tab.OTHERS];
      
      progressTimer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            setActiveTab((current) => {
              const currentIndex = tabs.indexOf(current);
              const nextIndex = (currentIndex + 1) % tabs.length;
              return tabs[nextIndex];
            });
            return 0;
          }
          return prev + (PROGRESS_INTERVAL / cycleDuration) * 100;
        });
      }, PROGRESS_INTERVAL);
    }

    return () => {
      if (progressTimer) clearInterval(progressTimer);
    };
  }, [isPlaying, cycleDuration, activeTab]);

  // Helper to clean numeric strings from spreadsheet
  const parseNumeric = (val: string): number => {
    if (!val) return 0;
    // Remove currency symbols and spaces
    let clean = val.replace(/[R$\s]/g, '');
    
    // Detect format: 1.234,56 (BR) vs 1,234.56 (US)
    const hasComma = clean.includes(',');
    const hasDot = clean.includes('.');
    
    if (hasComma && hasDot) {
      // Both present: assume the last one is the decimal separator
      if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
        // BR format: 1.234,56
        clean = clean.replace(/\./g, '').replace(',', '.');
      } else {
        // US format: 1,234.56
        clean = clean.replace(/,/g, '');
      }
    } else if (hasComma) {
      // Only comma: could be decimal (BR) or thousands (US)
      const parts = clean.split(',');
      // If it's something like "1,234" it's ambiguous. 
      // In BR context, "1,234" is usually 1.234 (decimal).
      // But if there are multiple commas, it's definitely thousands.
      if (parts.length > 2) {
        clean = clean.replace(/,/g, '');
      } else {
        clean = clean.replace(',', '.');
      }
    } else if (hasDot) {
      // Only dot: could be decimal (US) or thousands (BR)
      const parts = clean.split('.');
      if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
        // Likely thousands separator in BR (e.g. 1.234)
        clean = clean.replace(/\./g, '');
      }
    }
    
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  // Helper to find a "Total" value in a grid
  const extractTotalFromGrid = (grid?: SheetGrid): number => {
    if (!grid || grid.length < 2) return 0;
    
    const headerRow = grid.find(row => row.some(cell => cell.toLowerCase().includes('total'))) || grid[0];
    let totalColIndex = headerRow.findIndex(cell => cell.toLowerCase().includes('total'));
    
    // Fallback: if no "Total" column, use the last column
    if (totalColIndex === -1) totalColIndex = headerRow.length - 1;

    let maxVal = 0;
    for (let i = 0; i < grid.length; i++) {
        if (grid[i] === headerRow) continue;
        
        const valStr = grid[i][totalColIndex];
        const num = parseNumeric(valStr);
        
        // If we find a row that explicitly says "Total", return its value immediately
        const rowLabel = grid[i][0]?.toLowerCase() || '';
        if (rowLabel.includes('total')) {
            return num;
        }
        
        if (num > maxVal) maxVal = num;
    }

    return maxVal;
  };

  const extractLast30DaysData = (grid?: SheetGrid, rowLabel?: string) => {
    if (!grid || grid.length < 2) return [];
    
    // Find the row that matches the label
    const row = grid.find(r => r[0]?.toLowerCase().trim() === rowLabel?.toLowerCase().trim());
    if (!row) return [];

    // Find the "Total" column to know where the daily data ends
    const headerRow = grid.find(r => r.some(cell => cell.toLowerCase().includes('total')));
    const totalIndex = headerRow ? headerRow.findIndex(cell => cell.toLowerCase().includes('total')) : -1;
    
    const endIndex = totalIndex !== -1 ? totalIndex : row.length;
    // We want the last 30 columns before Total (or end)
    const startIndex = Math.max(1, endIndex - 30);
    
    const result = [];
    for (let i = startIndex; i < endIndex; i++) {
      const valStr = row[i] || '0';
      const clean = valStr.replace(/[R$\s.]/g, '').replace(',', '.');
      const num = parseFloat(clean);
      result.push({ name: i.toString(), value: isNaN(num) ? 0 : num });
    }
    return result;
  };

  const getAvailableMarketingItems = () => {
    const grid = data[Tab.MARKETING];
    if (!grid) return [];
    // Filter out headers and empty rows
    return grid
      .filter(row => row[0] && !['Janeiro', 'Fevereiro', 'Origem', 'Total'].includes(row[0].trim()) && !row[0].toLowerCase().includes('total'))
      .map(row => row[0]);
  };

  const extractRowMetrics = (grid?: SheetGrid, rowLabel?: string) => {
    if (!grid || !rowLabel || grid.length === 0) return { total: 0, diff30: 0, sparklineData: [] };
    
    // Find the header row to get column indices
    const headerRow = grid.find(r => r.some(cell => cell && cell.toLowerCase().includes('total'))) || grid[0];
    
    // Find the "Total" column index more robustly
    let totalIndex = -1;
    for (let i = headerRow.length - 1; i >= 0; i--) {
        if (headerRow[i] && headerRow[i].toLowerCase().includes('total')) {
            totalIndex = i;
            break;
        }
    }
    
    // Fallback: if no "Total" column found, use the last non-empty column of the header
    if (totalIndex === -1) {
        for (let i = headerRow.length - 1; i >= 0; i--) {
            if (headerRow[i] && headerRow[i].trim() !== '') {
                totalIndex = i;
                break;
            }
        }
    }
    
    // Ultimate fallback
    if (totalIndex === -1) totalIndex = headerRow.length - 1;

    // Find the row. 
    let row;
    const searchLabel = rowLabel.toLowerCase().trim();
    
    if (searchLabel === 'total') {
      // Look for a row that explicitly says "Total" in the first column
      row = grid.find(r => r[0] && r[0].toLowerCase().trim() === 'total');
      if (!row) {
        const total = extractTotalFromGrid(grid);
        return { total, diff30: 0, sparklineData: [] };
      }
    } else {
      // Search for the row label primarily in the first column for better precision
      row = grid.find(r => r[0] && r[0].toLowerCase().trim().includes(searchLabel));
      
      // If not found and it's a YouTube subscriber label, try common variations
      if (!row && (searchLabel.includes('youtube') && (searchLabel.includes('insc')))) {
          row = grid.find(r => r[0] && (r[0].toLowerCase().includes('youtube') && r[0].toLowerCase().includes('insc')));
      }

      // Fallback to searching all columns if not found in the first one
      if (!row) {
        row = grid.find(r => r.some(cell => cell.toLowerCase().trim().includes(searchLabel)));
      }
    }
    
    if (!row) return { total: 0, diff30: 0, sparklineData: [] };

    // Total value
    const valStr = row[totalIndex];
    const total = parseNumeric(valStr);

    // Diff 30 days
    const endIndex = totalIndex;
    const startIndex = Math.max(1, endIndex - 30);
    
    const isCumulative = searchLabel.includes('insc. do canal') || 
                        searchLabel.includes('inscritos youtube') || 
                        searchLabel.includes('instagram') || 
                        searchLabel.includes('seguidores');

    let diff30 = 0;
    const sparklineData: { date: string; value: number }[] = [];
    
    if (isCumulative) {
      const currentVal = total;
      // Use the value from 30 columns ago (or the first data column)
      const prevVal = parseNumeric(row[startIndex] || '0');
      diff30 = currentVal - prevVal;
      
      // Still build sparkline
      for (let i = startIndex; i < endIndex; i++) {
        sparklineData.push({ date: i.toString(), value: parseNumeric(row[i] || '0') });
      }
    } else {
      for (let i = startIndex; i < endIndex; i++) {
        const vStr = row[i] || '0';
        const val = parseNumeric(vStr);
        diff30 += val;
        sparklineData.push({ date: i.toString(), value: val });
      }
    }
    
    return { total, diff30, sparklineData };
  };

  const metrics: DashboardMetrics = useMemo(() => {
    return {
      totalRevenue: extractTotalFromGrid(data[Tab.WON]),
      totalLeads: extractTotalFromGrid(data[Tab.MARKETING]),
      totalNewBusiness: extractTotalFromGrid(data[Tab.NEW_BUSINESS]),
      totalLost: extractTotalFromGrid(data[Tab.LOST]),
      activePipelineValue: 0, // Hard to calc from summary table
      dealsBySource: {},
      dealsByStage: {},
      recentDeals: [],
      monthlyRevenue: [],
      winRate: 0,
      marketingLeads: 0
    } as any; // Casting to any to satisfy the complex Interface if we don't fully populate it
  }, [data]);

  const handleAiInsights = async () => {
    setLoadingInsights(true);
    const currentData = data[activeTab] || [];
    const text = await generateDashboardInsights(activeTab, currentData);
    setInsights(text);
    setLoadingInsights(false);
  };

  useEffect(() => {
    setInsights(null);
  }, [activeTab]);

  // --- Views ---

  // 1. HOME VIEW (Summarized)
  const renderHome = () => {
    const isInitialLoading = loading && Object.keys(data).length === 0;
    if (isInitialLoading) {
      return (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center h-full bg-[#00243a] fixed inset-0 z-[200]">
              <Loader2 className="animate-spin mb-4 text-[#70d44c]" size={40} />
          </div>
      );
    }

    const othersGrid = data[Tab.OTHERS] || [];
    const othersRows = othersGrid.slice(1);
    const goalsGrid = data[Tab.GOALS] || [];
    const storesGrid = data[Tab.STORES_INSTALLED] || [];

    // Calculate store counts for Home view
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();

    const allStores = storesGrid.slice(1).filter(row => row[0] && row[0].trim() !== '' && row[2] && row[2].trim() !== '');
    const lastMonthStores = allStores.filter(row => {
        const d = parseDate(row[0]);
        return d && d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
    });

    const totalStoresCount = allStores.length;
    const lastMonthCount = lastMonthStores.length;

    const getHomeKpiData = (item: string) => {
      let grid: SheetGrid | undefined;
      let label = '';
      let isCurrency = false;

      if (item === 'Dados Comerciais - Total de Lojas Instaladas') {
        return {
          value: totalStoresCount.toLocaleString('pt-BR'),
          subValue: lastMonthCount > 0 ? `+${lastMonthCount}` : undefined,
          trend: lastMonthCount > 0 ? 'up' : 'neutral' as const,
          sparklineData: []
        };
      }

      if (item === 'Dados Comerciais - Negócios iniciados') {
        const grid = data[Tab.NEW_OPPORTUNITIES];
        if (!grid || grid.length < 4) return { value: '0', subValue: undefined, trend: 'neutral' as const, sparklineData: [] };
        
        // L3 is Row 3 (index 2), Column L (index 11)
        // L4 is Row 4 (index 3), Column L (index 11)
        const value = parseNumeric(grid[2]?.[11] || '0');
        const diff = parseNumeric(grid[3]?.[11] || '0');
        
        return {
          value: value.toLocaleString('pt-BR'),
          subValue: diff !== 0 ? `${diff > 0 ? '+' : ''}${diff.toLocaleString('pt-BR')}` : undefined,
          trend: diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral' as const,
          sparklineData: []
        };
      }

      // Handle both "Marketing" and "Merketing" (typo resilience)
      if (item.toLowerCase().includes('marketing') || item.toLowerCase().includes('merketing')) {
        grid = data[Tab.MARKETING];
        label = item.split(' - ')[1] || '';
      } else if (item.startsWith('Novos Negócios - ')) {
        grid = data[Tab.NEW_BUSINESS];
        label = item.replace('Novos Negócios - ', '');
        isCurrency = true;
      } else if (item.startsWith('Negócios ganhos - ')) {
        grid = data[Tab.WON];
        label = item.replace('Negócios ganhos - ', '');
        isCurrency = true;
      } else if (item.startsWith('Negócios Perdidos - ')) {
        grid = data[Tab.LOST];
        label = item.replace('Negócios Perdidos - ', '');
        isCurrency = true;
      }

      const { total, diff30, sparklineData } = extractRowMetrics(grid, label);
      
      // Strict check for 0 to hide difference value as requested
      const hasDiff = diff30 !== 0 && Math.abs(diff30) > 0.001;
      
      return {
        value: isCurrency ? CURRENCY_FORMATTER.format(total) : total.toLocaleString('pt-BR'),
        subValue: !hasDiff ? undefined : `${diff30 > 0 ? '+' : ''}${isCurrency ? CURRENCY_FORMATTER.format(diff30) : diff30.toLocaleString('pt-BR')}`,
        trend: diff30 > 0 ? 'up' : diff30 < 0 ? 'down' : 'neutral' as const,
        sparklineData
      };
    };

    const renderItem = (item: string, idx: number, container: string) => {
        const handleRemove = () => {
            setHomeLayout(prev => ({
                ...prev,
                [container]: prev[container].filter(i => i !== item)
            }));
        };

        if (item === 'Clima') {
            return (
              <SortableDashboardItem key="Clima" id="Clima">
                <div className="relative group/card">
                    <WeatherWidget />
                    <button 
                        onClick={handleRemove}
                        className="absolute top-3 right-3 p-1 rounded-full bg-white/0 hover:bg-white/10 text-gray-500 hover:text-white transition-all opacity-0 group-hover/card:opacity-100 z-20"
                        title="Remover destaque"
                    >
                        <X size={14} />
                    </button>
                </div>
              </SortableDashboardItem>
            );
        }

        const kpiData = getHomeKpiData(item);
        const displayTitle = customHomeTitles[item] || item
            .replace('Marketing - ', '')
            .replace('Novos Negócios - ', '')
            .replace('Negócios ganhos - ', '')
            .replace('Negócios Perdidos - ', '')
            .replace('Dados Comerciais - ', '')
            .replace('Insc. do Canal (Youtube)', 'Inscritos Youtube');

        if (item === 'Dados Comerciais - Metas') {
            const goals = [
                { 
                    title: (goalsGrid[0] && goalsGrid[0][0]) || 'META GERAL ANO SC e RS - 2026',
                    data: goalsGrid.length > 2 ? goalsGrid.slice(2, 6) : []
                },
                { 
                    title: (goalsGrid[7] && goalsGrid[7][0]) || 'META MÊS FEVEREIRO - SC',
                    data: goalsGrid.length > 9 ? goalsGrid.slice(9, 13) : []
                },
                { 
                    title: (goalsGrid[14] && goalsGrid[14][0]) || 'META MÊS FEVEREIRO - RS',
                    data: goalsGrid.length > 16 ? goalsGrid.slice(16, 20) : []
                }
            ].filter(g => g.data.length > 0);

            return (
                <SortableDashboardItem key={item} id={item} className="md:row-span-2">
                    <div className="relative group/card h-full">
                        <MetasSlideshowCard 
                            goals={goals}
                            delay={(idx + 1) * 100}
                            onClose={handleRemove}
                        />
                    </div>
                </SortableDashboardItem>
            );
        }

        if (item === 'Dados Comerciais - Total de Lojas Instaladas') {
            const kpi = getHomeKpiData(item);
            return (
                <SortableDashboardItem key={item} id={item}>
                    <div className="relative group/card">
                        <KpiCard 
                            title={displayTitle}
                            value={kpi.value}
                            subValue={kpi.subValue}
                            trend={kpi.trend}
                            icon={<Store size={24} />}
                            iconPosition="left"
                            delay={(idx + 1) * 100}
                            onClose={handleRemove}
                            isEditingTitle={editingHomeTitleId === item}
                            onTitleClick={() => setEditingHomeTitleId(item)}
                            onTitleChange={(newTitle) => setCustomHomeTitles(prev => ({ ...prev, [item]: newTitle }))}
                            onTitleBlur={() => setEditingHomeTitleId(null)}
                        />
                    </div>
                </SortableDashboardItem>
            );
        }

        if (item === 'Dados Comerciais - Negócios iniciados') {
            const kpi = getHomeKpiData(item);
            return (
                <SortableDashboardItem key={item} id={item}>
                    <div className="relative group/card">
                        <KpiCard 
                            title={displayTitle}
                            value={kpi.value}
                            subValue={kpi.subValue}
                            trend={kpi.trend}
                            icon={<Handshake size={24} />}
                            iconPosition="left"
                            delay={(idx + 1) * 100}
                            onClose={handleRemove}
                            isEditingTitle={editingHomeTitleId === item}
                            onTitleClick={() => setEditingHomeTitleId(item)}
                            onTitleChange={(newTitle) => setCustomHomeTitles(prev => ({ ...prev, [item]: newTitle }))}
                            onTitleBlur={() => setEditingHomeTitleId(null)}
                        />
                    </div>
                </SortableDashboardItem>
            );
        }

        if (['Aniversariantes', 'Tempo de Empresa', 'Notificações'].includes(item)) {
            let items: { name: string; value: string }[] = [];
            let icon = Cake;
            let iconColor = 'text-pink-400';
            let badge = undefined;
            let isNotification = false;

            if (item === 'Aniversariantes') {
                items = othersRows.map(row => ({ name: row[0] || '', value: row[1] || '' }))
                                 .filter(r => r.name.trim() !== '');
                icon = Cake;
                iconColor = 'text-pink-400';
            } else if (item === 'Tempo de Empresa') {
                items = othersRows.map(row => ({ name: row[3] || '', value: row[4] || '' }))
                                 .filter(r => r.name.trim() !== '');
                icon = Clock;
                iconColor = 'text-blue-400';
            } else if (item === 'Notificações') {
                items = othersRows.map(row => ({ name: row[9] || '', value: '' }))
                                 .filter(r => r.name.trim() !== '');
                icon = Bell;
                iconColor = 'text-yellow-400';
                badge = items.length;
                isNotification = true;
            }

            return (
              <SortableDashboardItem key={item} id={item}>
                <div className="relative group/card">
                    <SlideshowCard 
                        title={displayTitle} 
                        items={items} 
                        icon={icon} 
                        iconColor={iconColor} 
                        delay={(idx + 1) * 100} 
                        badge={badge}
                        isNotification={isNotification}
                        isEditingTitle={editingHomeTitleId === item}
                        onTitleClick={() => setEditingHomeTitleId(item)}
                        onTitleChange={(newTitle) => setCustomHomeTitles(prev => ({ ...prev, [item]: newTitle }))}
                        onTitleBlur={() => setEditingHomeTitleId(null)}
                    />
                    <button 
                        onClick={handleRemove}
                        className="absolute top-3 right-3 p-1 rounded-full bg-white/0 hover:bg-white/10 text-gray-500 hover:text-white transition-all opacity-0 group-hover/card:opacity-100 z-20"
                        title="Remover destaque"
                    >
                        <X size={14} />
                    </button>
                </div>
              </SortableDashboardItem>
            );
        }

        let icon = undefined;
        let iconPosition: 'left' | 'right' = 'right';

        const isYoutubeInscritos = item.toLowerCase().includes('inscritos youtube') || 
                                 item.toLowerCase().includes('insc. do canal') ||
                                 displayTitle.toLowerCase().includes('inscritos youtube');

        if (item.toLowerCase().includes('visita site') || displayTitle.toLowerCase().includes('visita site')) {
            icon = <MousePointer2 size={24} />;
            iconPosition = 'left';
        } else if (isYoutubeInscritos) {
            icon = <Users size={24} />;
            iconPosition = 'left';
        } else if (item.toLowerCase().includes('visualizações do canal') || displayTitle.toLowerCase().includes('visualizações youtube')) {
            icon = <Play size={24} />;
            iconPosition = 'left';
        } else if (item.toLowerCase().includes('instagram') || displayTitle.toLowerCase().includes('instagram')) {
            icon = <Instagram size={24} />;
            iconPosition = 'left';
        }

        return (
          <SortableDashboardItem key={item} id={item}>
            <div className="relative group/card">
                <KpiCard 
                    title={displayTitle} 
                    value={kpiData.value} 
                    trend={kpiData.trend} 
                    subValue={kpiData.subValue}
                    icon={icon}
                    iconPosition={iconPosition}
                    delay={(idx + 1) * 100} 
                    onClose={handleRemove}
                    isEditingTitle={editingHomeTitleId === item}
                    onTitleClick={() => setEditingHomeTitleId(item)}
                    onTitleChange={(newTitle) => setCustomHomeTitles(prev => ({ ...prev, [item]: newTitle }))}
                    onTitleBlur={() => setEditingHomeTitleId(null)}
                    chart={kpiData.sparklineData.length > 0 ? (
                      <Sparkline 
                        data={kpiData.sparklineData} 
                        color={kpiData.trend === 'up' ? '#70d44c' : kpiData.trend === 'down' ? '#ef4444' : '#94a3b8'} 
                      />
                    ) : undefined}
                />
            </div>
          </SortableDashboardItem>
        );
    };

    const negociosItems = homeLayout.negocios.filter(item => !hiddenHomeItems.includes(item));
    const marketingItems = homeLayout.marketing.filter(item => !hiddenHomeItems.includes(item));
    const outrosItems = homeLayout.outros.filter(item => !hiddenHomeItems.includes(item));

    // Get all possible items from all tabs to allow adding them
    const getAllAvailableItems = () => {
        const items: string[] = [
            'Clima', 
            'Aniversariantes', 
            'Tempo de Empresa', 
            'Notificações',
            'Dados Comerciais - Metas',
            'Dados Comerciais - Total de Lojas Instaladas',
            'Dados Comerciais - Negócios iniciados'
        ];
        
        // Add items from Marketing
        if (data[Tab.MARKETING] && data[Tab.MARKETING].length > 0) {
            data[Tab.MARKETING].slice(1).forEach(row => {
                if (row[0]) items.push(`Marketing - ${row[0]}`);
            });
        }
        // Add items from Sales
        if (data[Tab.NEW_BUSINESS] && data[Tab.NEW_BUSINESS].length > 0) {
            data[Tab.NEW_BUSINESS].slice(1).forEach(row => {
                if (row[0]) items.push(`Novos Negócios - ${row[0]}`);
            });
        }
        // Add items from Won
        if (data[Tab.WON] && data[Tab.WON].length > 0) {
            data[Tab.WON].slice(1).forEach(row => {
                if (row[0]) items.push(`Negócios ganhos - ${row[0]}`);
            });
        }
        // Add items from Lost
        if (data[Tab.LOST] && data[Tab.LOST].length > 0) {
            data[Tab.LOST].slice(1).forEach(row => {
                if (row[0]) items.push(`Negócios Perdidos - ${row[0]}`);
            });
        }
        
        return Array.from(new Set(items));
    };

    const allAvailable = getAllAvailableItems();
    const filteredAvailable = allAvailable.filter(item => {
        const isAlreadyPinned = Object.values(homeLayout).some(list => (list as string[]).includes(item));
        if (isAlreadyPinned) return false;
        if (!searchQuery) return true;
        return item.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return (
      <div className="h-full px-10 pt-10 pb-10 overflow-hidden">
        {showHomeSettings && (
            <div className="mb-6 p-6 bg-[#001a2c] rounded-xl border border-[#70d44c]/30 animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-center mb-6">
                    <h4 className="text-sm font-bold text-[#70d44c] uppercase tracking-wider">Adicionar Novos Quadros:</h4>
                    <button 
                        onClick={() => {
                            if (confirm('Deseja restaurar a ordem e visibilidade padrão?')) {
                                localStorage.removeItem('homeLayout');
                                localStorage.removeItem('hiddenHomeItems');
                                window.location.reload();
                            }
                        }}
                        className="text-[10px] text-gray-500 hover:text-white transition-colors uppercase tracking-widest font-bold"
                    >
                        Restaurar Padrões
                    </button>
                </div>
                
                <div className="mb-6">
                    <div className="relative">
                        <input 
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar quadros..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#70d44c] transition-all pl-10"
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                            <Info size={18} />
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-6 max-h-[200px] overflow-y-auto custom-scrollbar p-1">
                    {filteredAvailable.length > 0 ? filteredAvailable.map(item => (
                        <button
                            key={item}
                            onClick={() => {
                                setHomeLayout(prev => ({
                                    ...prev,
                                    negocios: [...prev.negocios, item]
                                }));
                            }}
                            className="px-3 py-1.5 bg-white/5 hover:bg-[#70d44c]/10 border border-white/10 hover:border-[#70d44c]/30 rounded-lg text-[10px] text-gray-400 hover:text-white transition-all flex items-center gap-2"
                        >
                            <Settings size={12} />
                            {customHomeTitles[item] || item.replace('Marketing - ', '').replace('Novos Negócios - ', '').replace('Negócios ganhos - ', '').replace('Negócios Perdidos - ', '').replace('Dados Comerciais - ', '')}
                        </button>
                    )) : (
                        <p className="text-xs text-gray-600 italic py-2">Nenhum quadro encontrado ou todos já adicionados.</p>
                    )}
                </div>
            </div>
        )}

        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragOver={handleDragOverHome}
          onDragEnd={handleDragEndHome}
        >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[40px] items-stretch">
                {/* Column 1 & 2: Negócios */}
                <div className="lg:col-span-2 flex flex-col gap-[28px]">
                    <div className="flex items-center h-6 mb-1">
                        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] px-2 border-l-2 border-[#70d44c]/30">NEGÓCIOS</h3>
                    </div>
                    <SortableContext id="negocios" items={negociosItems} strategy={rectSortingStrategy}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-[40px] auto-rows-[165px]">
                            {negociosItems.map((item, idx) => renderItem(item, idx, 'negocios'))}
                        </div>
                    </SortableContext>
                </div>

                {/* Column 3: Marketing */}
                <div className="flex flex-col gap-[28px]">
                    <div className="flex items-center h-6 mb-1">
                        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] px-2 border-l-2 border-[#70d44c]/30">MARKETING</h3>
                    </div>
                    <SortableContext id="marketing" items={marketingItems} strategy={verticalListSortingStrategy}>
                        <div className="grid grid-cols-1 gap-[40px] auto-rows-[165px]">
                            {marketingItems.map((item, idx) => renderItem(item, idx, 'marketing'))}
                        </div>
                    </SortableContext>
                </div>

                {/* Column 4: Outros */}
                <div className="flex flex-col gap-[28px]">
                    <div className="flex justify-between items-center h-6 mb-1">
                        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] px-2 border-l-2 border-[#70d44c]/30">OUTROS</h3>
                        <button 
                            onClick={() => {
                                setEditingHomeTitleId(null);
                                setShowHomeSettings(!showHomeSettings);
                            }}
                            title="Configurar Quadros"
                            className={`p-1 rounded-lg transition-colors flex items-center justify-center ${showHomeSettings ? 'text-[#70d44c]' : 'text-gray-500 hover:text-white'}`}
                        >
                            <Settings size={18} />
                        </button>
                    </div>
                    <SortableContext id="outros" items={outrosItems} strategy={verticalListSortingStrategy}>
                        <div className="grid grid-cols-1 gap-[40px] auto-rows-[165px]">
                            {outrosItems.map((item, idx) => renderItem(item, idx, 'outros'))}
                        </div>
                    </SortableContext>
                </div>
            </div>
        </DndContext>
      </div>
    );
  };

  // 2. SPREADSHEET VIEW (Renders raw grid)
  const renderSpreadsheetView = (
    title: string, 
    grid?: SheetGrid, 
    badgeColor: string = 'bg-gray-500', 
    tab?: Tab,
    pinnedItems: string[] = [],
    setPinnedItems: (items: string[]) => void = () => {},
    hiddenItems: string[] = [],
    setHiddenItems: (items: string[]) => void = () => {},
    customTitles: Record<string, string> = {},
    setCustomTitles: (titles: Record<string, string>) => void = () => {},
    showSettings: boolean = false,
    setShowSettings: (show: boolean) => void = () => {},
    onDragEnd: (event: DragEndEvent) => void = () => {}
  ) => {
    if ((!grid || grid.length === 0) && loading) {
        return (
            <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center h-full">
                <Loader2 className="animate-spin mb-4 text-[#70d44c]" size={40} />
                <p>Carregando dados da planilha...</p>
            </div>
        );
    }

    const togglePin = (item: string) => {
        if (pinnedItems.includes(item)) {
            setPinnedItems(pinnedItems.filter(i => i !== item));
        } else {
            setPinnedItems([...pinnedItems, item]);
        }
    };

    const availableItems = grid.slice(1)
        .map(row => row[0])
        .filter(label => label && label.trim() !== '' && !pinnedItems.includes(label))
        .filter(label => !spreadsheetSearchQuery || label.toLowerCase().includes(spreadsheetSearchQuery.toLowerCase()));

    return (
        <div className="flex flex-col h-full p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-3 text-white">
                    <span className={`w-2 h-8 ${badgeColor} rounded-full block`}></span>
                    {title}
                </h2>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setShowSettings(!showSettings)}
                        title="Configurar Topo"
                        className={`p-2 rounded-lg transition-colors flex items-center justify-center ${showSettings ? 'bg-[#70d44c] text-[#00243a]' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                    >
                        <Settings size={20} />
                    </button>
                </div>
            </div>

            {showSettings && (
                <div className="mb-6 p-6 bg-[#001a2c] rounded-xl border border-[#70d44c]/30 animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-sm font-bold text-[#70d44c] uppercase tracking-wider">Adicionar Novos Quadros:</h4>
                        <button 
                            onClick={() => {
                                if (confirm('Restaurar destaques padrão?')) {
                                    if (tab === Tab.MARKETING) {
                                        localStorage.removeItem('pinnedMarketingItems');
                                        localStorage.removeItem('hiddenMarketingItems');
                                    } else if (tab === Tab.NEW_BUSINESS) {
                                        localStorage.removeItem('pinnedSalesItems');
                                        localStorage.removeItem('hiddenSalesItems');
                                    } else if (tab === Tab.WON) {
                                        localStorage.removeItem('pinnedFinanceItems');
                                        localStorage.removeItem('hiddenFinanceItems');
                                    } else if (tab === Tab.LOST) {
                                        localStorage.removeItem('pinnedLostItems');
                                        localStorage.removeItem('hiddenLostItems');
                                    }
                                    window.location.reload();
                                }
                            }}
                            className="text-[10px] text-gray-500 hover:text-white transition-colors uppercase tracking-widest font-bold"
                        >
                            Restaurar Padrões
                        </button>
                    </div>

                    {/* Search for adding new items */}
                    <div className="mb-4">
                        <div className="relative">
                            <input 
                                type="text"
                                value={spreadsheetSearchQuery}
                                onChange={(e) => setSpreadsheetSearchQuery(e.target.value)}
                                placeholder="Buscar itens para destacar..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-[#70d44c] transition-all pl-9"
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                                <Settings size={14} />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-6 max-h-[120px] overflow-y-auto custom-scrollbar p-1">
                        {availableItems.length > 0 ? availableItems.map(item => (
                            <button
                                key={item}
                                onClick={() => togglePin(item)}
                                className="px-3 py-1.5 bg-white/5 hover:bg-[#70d44c]/10 border border-white/10 hover:border-[#70d44c]/30 rounded-lg text-[10px] text-gray-400 hover:text-white transition-all flex items-center gap-2"
                            >
                                <Settings size={12} />
                                {item}
                            </button>
                        )) : (
                            <p className="text-[10px] text-gray-600 italic">Nenhum item disponível para adicionar.</p>
                        )}
                    </div>

                    <div className="border-t border-white/5 pt-6">
                        <h4 className="text-sm font-bold text-[#70d44c] uppercase tracking-wider mb-4">Gerenciar Títulos:</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {pinnedItems.map(item => (
                                <div key={item} className="flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/10">
                                    <span className="text-[10px] text-gray-500 truncate w-24 shrink-0">{item}</span>
                                    <input 
                                        type="text"
                                        value={customTitles[item] || ''}
                                        onChange={(e) => setCustomTitles({...customTitles, [item]: e.target.value})}
                                        onKeyDown={(e) => e.stopPropagation()}
                                        placeholder="Título personalizado..."
                                        className="flex-1 bg-transparent border-b border-white/10 focus:border-[#70d44c] text-[10px] outline-none px-1"
                                    />
                                    <button 
                                        onClick={() => setPinnedItems(pinnedItems.filter(i => i !== item))}
                                        className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                                        title="Remover"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            
            <div className="mb-8">
                <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onDragEnd}
                >
                    <SortableContext 
                        items={pinnedItems.filter(item => !hiddenItems.includes(item))}
                        strategy={rectSortingStrategy}
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
                            {pinnedItems.filter(item => !hiddenItems.includes(item)).map((item, idx) => {
                                const { total, diff30, sparklineData } = extractRowMetrics(grid, item);
                                const isCurrency = tab !== Tab.MARKETING;
                                const trend = diff30 > 0 ? 'up' : diff30 < 0 ? 'down' : 'neutral' as const;
                                
                                // Hide difference if it's 0
                                const hasDiff = diff30 !== 0 && Math.abs(diff30) > 0.001;
                                const subValue = hasDiff 
                                    ? `${diff30 > 0 ? '+' : ''}${isCurrency ? CURRENCY_FORMATTER.format(diff30) : diff30.toLocaleString('pt-BR')}`
                                    : undefined;

                                return (
                                    <SortableDashboardItem key={item} id={item}>
                                        <KpiCard
                                            title={customTitles[item] || item}
                                            value={isCurrency ? CURRENCY_FORMATTER.format(total) : total.toLocaleString('pt-BR')}
                                            trend={trend}
                                            subValue={subValue}
                                            delay={idx * 100}
                                            chart={sparklineData.length > 0 ? (
                                                <Sparkline 
                                                    data={sparklineData} 
                                                    color={trend === 'up' ? '#70d44c' : trend === 'down' ? '#ef4444' : '#94a3b8'} 
                                                />
                                            ) : undefined}
                                            onClose={() => setHiddenItems([...hiddenItems, item])}
                                            isEditingTitle={false} // Inline editing only on Home for now
                                        />
                                    </SortableDashboardItem>
                                );
                            })}
                        </div>
                    </SortableContext>
                </DndContext>
            </div>
            
            <div className="flex-1 overflow-auto bg-[#001524] rounded-xl border border-white/10 shadow-xl custom-scrollbar relative">
                <table className="w-full border-collapse text-left whitespace-nowrap">
                    <tbody>
                        {grid.map((row, rowIndex) => {
                            const isHeader = row.some(c => ['Janeiro', 'Fevereiro', 'Origem', 'Total'].includes(c.trim()));
                            const isSectionHeader = row[0] && row.slice(1).every(c => !c);
                            const isTotalRow = row[0]?.toLowerCase().includes('total') || row.includes('Total');
                            const rowLabel = row[0] || '';
                            const isPinned = pinnedItems.includes(rowLabel);

                            return (
                                <tr 
                                    key={rowIndex} 
                                    onClick={() => !isHeader && !isSectionHeader && togglePin(rowLabel)}
                                    className={`
                                        border-b border-white/5 transition-colors
                                        ${isHeader ? 'bg-[#003554] text-[#70d44c] font-bold sticky top-0 z-10' : ''}
                                        ${isSectionHeader ? 'bg-[#00243a] text-white font-bold text-lg mt-4' : ''}
                                        ${isTotalRow ? 'bg-[#70d44c]/10 text-white font-bold' : 'text-gray-300 hover:bg-white/5 cursor-pointer'}
                                    `}
                                >
                                    {row.map((cell, cellIndex) => (
                                        <td 
                                            key={cellIndex} 
                                            className={`
                                                px-4 py-3 text-sm border-r border-white/5
                                                ${cellIndex === 0 ? 'sticky left-0 bg-inherit z-0 font-medium min-w-[120px]' : 'min-w-[80px]'}
                                                ${!isNaN(parseFloat(cell.replace(/[R$.]/g, '').replace(',', '.'))) && cellIndex > 0 ? 'text-right font-mono' : ''}
                                            `}
                                        >
                                            <div className="flex items-center gap-2">
                                                {cellIndex === 0 && !isHeader && !isSectionHeader && (
                                                    <div className={`w-1.5 h-1.5 rounded-full ${isPinned ? 'bg-[#70d44c] shadow-[0_0_5px_#70d44c]' : 'bg-white/10'}`}></div>
                                                )}
                                                {cell}
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
  };

  const renderOthersView = () => {
    const grid = data[Tab.OTHERS];
    const isInitialLoading = loading && Object.keys(data).length === 0;
    
    if (isInitialLoading) {
        return (
            <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center h-full">
                <Loader2 className="animate-spin mb-4 text-[#70d44c]" size={40} />
                <p className="text-lg">Carregando informações...</p>
            </div>
        );
    }

    if (!grid || grid.length <= 1) {
        return (
            <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center h-full">
                <Info className="mb-4 text-yellow-500" size={48} />
                <p className="text-xl font-bold text-white mb-2">Nenhum dado encontrado</p>
                <p className="max-w-md">Verifique se a aba "Niver" na sua planilha Google possui dados e se o ID da planilha está correto nas configurações.</p>
                <p className="text-sm text-gray-400 mt-4 bg-white/5 p-3 rounded-lg border border-white/10">
                    <strong>Dica:</strong> Certifique-se que a planilha está compartilhada como <br/>
                    <span className="text-[#70d44c]">"Qualquer pessoa com o link pode ler"</span>.
                </p>
                <button 
                    onClick={loadData}
                    className="mt-6 px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all flex items-center gap-2"
                >
                    <RefreshCw size={16} />
                    Tentar Novamente
                </button>
            </div>
        );
    }

    const header = grid[0];
    const rows = grid.slice(1);

    // Filter rows that have content in their respective columns
    const bdays = rows
        .map(row => [row[0] || '', row[1] || ''])
        .filter(r => r[0].trim() !== '' || r[1].trim() !== '');
        
    const tenure = rows
        .map(row => [row[3] || '', row[4] || ''])
        .filter(r => r[0].trim() !== '' || r[1].trim() !== '');

    const coffee = rows
        .map(row => [row[6] || '', row[7] || ''])
        .filter(r => r[0].trim() !== '' || r[1].trim() !== '');

    return (
        <div className="flex flex-col h-full p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-3 text-white">
                    <span className="w-2 h-8 bg-emerald-400 rounded-full block"></span>
                    Equipe & Comemorações
                </h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-hidden">
                {/* Section 1: Aniversariantes & Café */}
                <div className="flex flex-col gap-6 overflow-hidden">
                    {/* Aniversariantes */}
                    <div className="flex flex-col bg-[#001524] rounded-xl border border-white/10 shadow-xl overflow-hidden flex-1">
                        <div className="p-4 bg-[#003554] border-b border-white/10 flex items-center gap-2">
                            <div className="p-2 bg-[#70d44c]/20 rounded-lg">
                                <Cake className="text-[#70d44c]" size={20} />
                            </div>
                            <h3 className="font-bold text-white uppercase tracking-wider text-sm">Aniversariantes do Mês</h3>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full text-left">
                                <thead className="bg-white/5 text-[#70d44c] text-xs uppercase tracking-widest">
                                    <tr>
                                        <th className="px-6 py-3 border-b border-white/5">{header[0] || 'Nome'}</th>
                                        <th className="px-6 py-3 border-b border-white/5 text-right">{header[1] || 'Data'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {bdays.length > 0 ? bdays.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 text-sm text-white font-medium">{row[0]}</td>
                                            <td className="px-6 py-4 text-sm text-gray-400 text-right">{row[1]}</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={2} className="px-6 py-8 text-center text-gray-500 text-sm italic">
                                                Nenhum aniversariante listado
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Café dos Aniversariantes */}
                    <div className="flex flex-col bg-[#001524] rounded-xl border border-white/10 shadow-xl overflow-hidden flex-none">
                        <div className="p-4 bg-[#003554] border-b border-white/10 flex items-center gap-2">
                            <div className="p-2 bg-[#70d44c]/20 rounded-lg">
                                <Coffee className="text-[#70d44c]" size={20} />
                            </div>
                            <h3 className="font-bold text-white uppercase tracking-wider text-sm">Café dos Aniversariantes</h3>
                        </div>
                        <div className="overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-white/5 text-[#70d44c] text-xs uppercase tracking-widest">
                                    <tr>
                                        <th className="px-6 py-3 border-b border-white/5">{header[6] || 'Data'}</th>
                                        <th className="px-6 py-3 border-b border-white/5 text-right">{header[7] || 'Horário'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {coffee.length > 0 ? coffee.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 text-sm text-white font-medium">{row[0]}</td>
                                            <td className="px-6 py-4 text-sm text-gray-400 text-right">{row[1]}</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={2} className="px-6 py-8 text-center text-gray-500 text-sm italic">
                                                Nenhum café agendado
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Section 2: Tempo de Empresa */}
                <div className="flex flex-col bg-[#001524] rounded-xl border border-white/10 shadow-xl overflow-hidden">
                    <div className="p-4 bg-[#003554] border-b border-white/10 flex items-center gap-2">
                        <div className="p-2 bg-[#70d44c]/20 rounded-lg">
                            <Clock className="text-[#70d44c]" size={20} />
                        </div>
                        <h3 className="font-bold text-white uppercase tracking-wider text-sm">Tempo de Empresa</h3>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-white/5 text-[#70d44c] text-xs uppercase tracking-widest">
                                <tr>
                                    <th className="px-6 py-3 border-b border-white/5">{header[3] || 'Colaborador'}</th>
                                    <th className="px-6 py-3 border-b border-white/5 text-right">{header[4] || 'Tempo'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {tenure.length > 0 ? tenure.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 text-sm text-white font-medium">{row[0]}</td>
                                        <td className="px-6 py-4 text-sm text-gray-400 text-right">{row[1]}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={2} className="px-6 py-8 text-center text-gray-500 text-sm italic">
                                            Nenhum dado de tempo de empresa
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  // 4. COMMERCIAL DATA VIEW
   const renderCommercialDataView = () => {
    const isInitialLoading = loading && Object.keys(data).length === 0;
    if (isInitialLoading) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                <Loader2 className="animate-spin mr-2" size={24} />
                Carregando dados comerciais...
            </div>
        );
    }
    const storesGrid = data[Tab.STORES_INSTALLED] || [];
    const opportunitiesGrid = data[Tab.NEW_OPPORTUNITIES] || [];
    const goalsGrid = data[Tab.GOALS] || [];

    // Extract "Novas Oportunidades" Titles
    const planoCompletoTitle = (opportunitiesGrid[0] && opportunitiesGrid[0][0]) || 'PLANO COMPLETO';
    const planoDigitalTitle = (opportunitiesGrid[21] && opportunitiesGrid[21][0]) || 'CREDIÁRIO DIGITAL';
    
    // Extract "Novas Oportunidades" Data
    const planoCompletoData = opportunitiesGrid.length > 5 ? opportunitiesGrid.slice(5, 16) : [];
    const planoDigitalData = opportunitiesGrid.length > 26 ? opportunitiesGrid.slice(26, 37) : [];

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();

    // Filter stores list - focus on last month as requested
    const allStores = storesGrid.slice(1).filter(row => row[0] && row[0].trim() !== '' && row[2] && row[2].trim() !== '');
    
    // Stores from last month (e.g., February if today is March)
    const lastMonthStores = allStores.filter(row => {
        const d = parseDate(row[0]);
        return d && d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
    });

    const totalStoresCount = allStores.length;
    const lastMonthCount = lastMonthStores.length;

    return (
      <div className="h-full p-6 overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-8 shrink-0">
          <h2 className="text-2xl font-bold flex items-center gap-3 text-white">
            <span className="w-2 h-8 bg-[#70d44c] rounded-full block"></span>
            Dados Comerciais
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch flex-1 min-h-0 overflow-hidden">
          {/* Coluna 1: Metas */}
          <div className="space-y-6 h-full overflow-y-auto custom-scrollbar pr-2 pb-6">
            <div className="bg-gradient-to-br from-[#001a2c]/80 to-[#003554]/40 backdrop-blur-md border border-[#70d44c]/15 p-6 rounded-2xl shadow-xl">
               <h3 className="text-lg font-bold text-white mb-6 border-b border-white/10 pb-4">
                 {(goalsGrid[0] && goalsGrid[0][0]) || 'META GERAL ANO SC e RS - 2026'}
               </h3>
               <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                   <thead>
                     <tr className="text-gray-400 border-b border-white/10">
                       <th className="pb-3 font-medium"></th>
                       <th className="pb-3 font-medium text-right">Real</th>
                       <th className="pb-3 font-medium text-right">Meta</th>
                       <th className="pb-3 font-medium text-right">%</th>
                     </tr>
                   </thead>
                    <tbody className="text-gray-200">
                      {goalsGrid.length > 2 ? goalsGrid.slice(2, 6).map((row, idx) => {
                        const percent = parseFloat(row[3]?.replace(',', '.') || '0');
                        const isPositive = !isNaN(percent) && percent >= 100;
                        return (
                          <tr key={idx} className="border-b border-white/5 last:border-0">
                            <td className="py-3 font-medium">{row[0] || '-'}</td>
                            <td className="py-3 text-right">{row[1] || '0'}</td>
                            <td className="py-3 text-right">{row[2] || '0'}</td>
                            <td className={`py-3 text-right font-bold ${isPositive ? 'text-[#70d44c]' : 'text-yellow-400'}`}>
                              {row[3] || '0'}{row[3] && row[3] !== '-' ? '%' : ''}
                            </td>
                          </tr>
                        );
                      }) : (
                         <tr><td colSpan={4} className="py-4 text-center text-gray-500 italic">Sem dados</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
             </div>

             <div className="bg-gradient-to-br from-[#001a2c]/80 to-[#003554]/40 backdrop-blur-md border border-[#70d44c]/15 p-6 rounded-2xl shadow-xl">
                <h3 className="text-lg font-bold text-white mb-6 border-b border-white/10 pb-4">
                  {(goalsGrid[7] && goalsGrid[7][0]) || 'META MÊS JANEIRO - SC'}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="text-gray-400 border-b border-white/10">
                        <th className="pb-3 font-medium"></th>
                        <th className="pb-3 font-medium text-right">Real</th>
                        <th className="pb-3 font-medium text-right">Meta</th>
                        <th className="pb-3 font-medium text-right">%</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-200">
                      {goalsGrid.length > 9 ? goalsGrid.slice(9, 13).map((row, idx) => {
                        const percent = parseFloat(row[3]?.replace(',', '.') || '0');
                        const isPositive = !isNaN(percent) && percent >= 100;
                        return (
                          <tr key={idx} className="border-b border-white/5 last:border-0">
                            <td className="py-3 font-medium">{row[0] || '-'}</td>
                            <td className="py-3 text-right">{row[1] || '0'}</td>
                            <td className="py-3 text-right">{row[2] || '0'}</td>
                            <td className={`py-3 text-right font-bold ${isPositive ? 'text-[#70d44c]' : 'text-yellow-400'}`}>
                              {row[3] || '0'}{row[3] && row[3] !== '-' ? '%' : ''}
                            </td>
                          </tr>
                        );
                      }) : (
                         <tr><td colSpan={4} className="py-4 text-center text-gray-600">Sem dados</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
             </div>

             <div className="bg-gradient-to-br from-[#001a2c]/80 to-[#003554]/40 backdrop-blur-md border border-[#70d44c]/15 p-6 rounded-2xl shadow-xl">
                <h3 className="text-lg font-bold text-white mb-6 border-b border-white/10 pb-4">
                  {(goalsGrid[14] && goalsGrid[14][0]) || 'META MÊS JANEIRO - RS'}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="text-gray-400 border-b border-white/10">
                        <th className="pb-3 font-medium"></th>
                        <th className="pb-3 font-medium text-right">Real</th>
                        <th className="pb-3 font-medium text-right">Meta</th>
                        <th className="pb-3 font-medium text-right">%</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-200">
                      {goalsGrid.length > 16 ? goalsGrid.slice(16, 20).map((row, idx) => {
                        const percent = parseFloat(row[3]?.replace(',', '.') || '0');
                        const isPositive = !isNaN(percent) && percent >= 100;
                        return (
                          <tr key={idx} className="border-b border-white/5 last:border-0">
                            <td className="py-3 font-medium">{row[0] || '-'}</td>
                            <td className="py-3 text-right">{row[1] || '0'}</td>
                            <td className="py-3 text-right">{row[2] || '0'}</td>
                            <td className={`py-3 text-right font-bold ${isPositive ? 'text-[#70d44c]' : 'text-yellow-400'}`}>
                              {row[3] || '0'}{row[3] && row[3] !== '-' ? '%' : ''}
                            </td>
                          </tr>
                        );
                      }) : (
                         <tr><td colSpan={4} className="py-4 text-center text-gray-600">Sem dados</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
             </div>
          </div>

          {/* Coluna 2: Oportunidades */}
          <div className="space-y-6 h-full overflow-y-auto custom-scrollbar pr-2 pb-6">
             <div className="bg-gradient-to-br from-[#001a2c]/80 to-[#003554]/40 backdrop-blur-md border border-[#70d44c]/15 p-6 rounded-2xl shadow-xl">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 border-b border-white/10 pb-4">
                  <Users size={20} className="text-[#70d44c]" />
                  {planoCompletoTitle}
                </h3>
                <div className="space-y-4">
                   {planoCompletoData.length > 0 ? planoCompletoData.map((row, idx) => (
                     <div key={idx} className="flex items-center justify-between group">
                        <span className="text-sm text-gray-400 group-hover:text-white transition-colors">{row[0]}</span>
                        <div className="flex items-center gap-3">
                           <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-[#70d44c]" 
                                style={{ width: `${Math.min(100, (parseInt(row[1]) || 0) * 2)}%` }}
                              />
                           </div>
                           <span className="text-sm font-bold text-white w-6 text-right">{row[1]}</span>
                        </div>
                     </div>
                   )) : (
                      <p className="text-center text-gray-500 py-4 italic">Sem dados</p>
                   )}
                </div>
             </div>

             <div className="bg-gradient-to-br from-[#001a2c]/80 to-[#003554]/40 backdrop-blur-md border border-[#70d44c]/15 p-6 rounded-2xl shadow-xl">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 border-b border-white/10 pb-4">
                  <Users size={20} className="text-[#70d44c]" />
                  {planoDigitalTitle}
                </h3>
                <div className="space-y-4">
                   {planoDigitalData.length > 0 ? planoDigitalData.map((row, idx) => (
                     <div key={idx} className="flex items-center justify-between group">
                        <span className="text-sm text-gray-400 group-hover:text-white transition-colors">{row[0]}</span>
                        <div className="flex items-center gap-3">
                           <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-[#70d44c]" 
                                style={{ width: `${Math.min(100, (parseInt(row[1]) || 0) * 2)}%` }}
                              />
                           </div>
                           <span className="text-sm font-bold text-white w-6 text-right">{row[1]}</span>
                        </div>
                     </div>
                   )) : (
                      <p className="text-center text-gray-500 py-4 italic">Sem dados</p>
                   )}
                </div>
             </div>
          </div>

          {/* Coluna 3: Lojas Instaladas */}
          <div className="h-full flex flex-col space-y-6 min-h-0">
             {/* Total Lojas KPI Card */}
             <div className="shrink-0">
               <KpiCard 
                  title="Total de lojas instaladas"
                  value={totalStoresCount}
                  subValue={lastMonthCount > 0 ? `+${lastMonthCount}` : undefined}
                  trend={lastMonthCount > 0 ? 'up' : 'neutral'}
                  icon={<Store size={24} />}
                  iconPosition="left"
                  delay={100}
               />
             </div>

             <div className="bg-gradient-to-br from-[#001a2c]/80 to-[#003554]/40 backdrop-blur-md border border-[#70d44c]/15 p-6 pb-0 rounded-2xl shadow-xl flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4 shrink-0">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <div className="relative">
                            <Store size={20} className="text-[#70d44c]" />
                            {lastMonthCount > 0 && (
                                <span className="absolute -top-3 -right-3 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white shadow-lg shadow-red-500/20 border-2 border-[#001a2c]">
                                    {lastMonthCount}
                                </span>
                            )}
                        </div>
                        Lojas instaladas
                    </h3>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mb-4">
                  <table className="w-full text-sm text-left">
                    <tbody className="text-gray-300">
                      {lastMonthStores.length > 0 ? lastMonthStores.map((row, idx) => (
                        <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-3 pr-2 whitespace-nowrap">{row[0]}</td>
                          <td className="py-3 font-medium text-white">{row[2]}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={2} className="py-8 text-center text-gray-500 italic">Nenhuma loja instalada no último mês</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
             </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen w-screen bg-[#00243a] font-sans text-white overflow-hidden">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isPlaying={isPlaying}
        progress={progress}
        onTogglePlay={() => {
            const nextPlaying = !isPlaying;
            setIsPlaying(nextPlaying);
            if (nextPlaying) setIsSidebarCollapsed(true);
        }}
        onShowAi={() => {
            setShowAiModal(true);
            if (!insights) handleAiInsights();
        }}
        onShowSettings={() => {
            setEditingHomeTitleId(null);
            setShowGlobalSettings(true);
        }}
        onRefresh={loadData}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        lastUpdated={lastUpdated}
        isRefreshing={isRefreshing}
        refreshError={refreshError}
      />
      
      <main className="flex-1 relative flex flex-col">
        {/* Global Settings Modal (Slide-over) */}
        {showGlobalSettings && (
            <div className="fixed inset-0 z-[100] flex justify-start">
                {/* Backdrop with blur */}
                <div 
                    className="absolute inset-0 bg-black/40 backdrop-blur-md animate-in fade-in duration-300"
                    onClick={() => setShowGlobalSettings(false)}
                />
                
                {/* Slide-over panel */}
                <div className="relative w-full max-w-md bg-[#001a2c] h-full shadow-2xl border-r border-white/10 flex flex-col animate-in slide-in-from-left duration-500">
                    <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-[#003554] to-[#001a2c]">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <Settings className="text-[#70d44c]" size={20} />
                            Configurações Gerais
                        </h3>
                        <button onClick={() => setShowGlobalSettings(false)} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                        {/* Fontes Section */}
                        <div className="space-y-6">
                            <button 
                                onClick={() => setIsSourcesCollapsed(!isSourcesCollapsed)}
                                className="w-full flex items-center justify-between text-sm font-bold text-[#70d44c] border-b border-white/10 pb-2 mb-4 hover:text-white transition-colors"
                            >
                                <span>Fontes</span>
                                {isSourcesCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                            </button>
                            
                            {!isSourcesCollapsed && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">ID da Planilha Google (Principal)</label>
                                        <input 
                                            type="text" 
                                            value={sheetId}
                                            onChange={(e) => setSheetId(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#70d44c] transition-all"
                                            placeholder="Insira o ID da planilha..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">ID da Planilha (Outros/Niver)</label>
                                        <input 
                                            type="text" 
                                            value={othersSheetId}
                                            onChange={(e) => setOthersSheetId(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#70d44c] transition-all"
                                            placeholder="Insira o ID da planilha de Outros..."
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">GID da aba "Marketing"</label>
                                        <input 
                                            type="text" 
                                            value={marketingGid}
                                            onChange={(e) => setMarketingGid(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#70d44c] transition-all"
                                            placeholder="Ex: 78259475"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">GID da aba "Novos Negócios"</label>
                                        <input 
                                            type="text" 
                                            value={newBusinessGid}
                                            onChange={(e) => setNewBusinessGid(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#70d44c] transition-all"
                                            placeholder="Ex: 887251014"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">GID da aba "Ganhos"</label>
                                        <input 
                                            type="text" 
                                            value={wonGid}
                                            onChange={(e) => setWonGid(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#70d44c] transition-all"
                                            placeholder="Ex: 293370756"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">GID da aba "Perdidos"</label>
                                        <input 
                                            type="text" 
                                            value={lostGid}
                                            onChange={(e) => setLostGid(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#70d44c] transition-all"
                                            placeholder="Ex: 182515415"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">GID da aba "Outros"</label>
                                        <input 
                                            type="text" 
                                            value={othersGid}
                                            onChange={(e) => setOthersGid(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#70d44c] transition-all"
                                            placeholder="Ex: 1942815657"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">GID da aba "Lojas Instaladas"</label>
                                        <input 
                                            type="text" 
                                            value={storesGid}
                                            onChange={(e) => setStoresGid(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#70d44c] transition-all"
                                            placeholder="Ex: 0"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">GID da aba "Novas Oportunidades"</label>
                                        <input 
                                            type="text" 
                                            value={opportunitiesGid}
                                            onChange={(e) => setOpportunitiesGid(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#70d44c] transition-all"
                                            placeholder="Ex: 0"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">GID da aba "Metas"</label>
                                        <input 
                                            type="text" 
                                            value={goalsGid}
                                            onChange={(e) => setGoalsGid(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#70d44c] transition-all"
                                            placeholder="Ex: 0"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Tempo Section */}
                        <div className="space-y-6">
                            <h4 className="text-sm font-bold text-[#70d44c] border-b border-white/10 pb-2 mb-4">Tempo</h4>
                            
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Tempo de Apresentação (Ciclo)</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { label: '1 min', value: 60000 },
                                        { label: '5 min', value: 300000 },
                                        { label: '15 min', value: 900000 },
                                        { label: '30 min', value: 1800000 }
                                    ].map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setCycleDuration(opt.value)}
                                            className={`px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                                                cycleDuration === opt.value 
                                                ? 'bg-[#70d44c]/10 border-[#70d44c] text-[#70d44c]' 
                                                : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Intervalo de Atualização</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { label: '1 min', value: 60000 },
                                        { label: '10 min', value: 600000 },
                                        { label: '1 hora', value: 3600000 },
                                        { label: '12 horas', value: 43200000 }
                                    ].map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setRefreshInterval(opt.value)}
                                            className={`px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                                                refreshInterval === opt.value 
                                                ? 'bg-[#70d44c]/10 border-[#70d44c] text-[#70d44c]' 
                                                : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 bg-[#001524] border-t border-white/10">
                        <button 
                            onClick={async () => {
                                try {
                                    // Explicitly save to localStorage
                                    localStorage.setItem('sheetId', sheetId);
                                    localStorage.setItem('othersSheetId', othersSheetId);
                                    localStorage.setItem('othersGid', othersGid);
                                    localStorage.setItem('storesGid', storesGid);
                                    localStorage.setItem('opportunitiesGid', opportunitiesGid);
                                    localStorage.setItem('goalsGid', goalsGid);
                                    localStorage.setItem('marketingGid', marketingGid);
                                    localStorage.setItem('newBusinessGid', newBusinessGid);
                                    localStorage.setItem('wonGid', wonGid);
                                    localStorage.setItem('lostGid', lostGid);
                                    localStorage.setItem('cycleDuration', cycleDuration.toString());
                                    localStorage.setItem('refreshInterval', refreshInterval.toString());
                                    localStorage.setItem('homeLayout', JSON.stringify(homeLayout));
                                    localStorage.setItem('hiddenHomeItems', JSON.stringify(hiddenHomeItems));
                                    localStorage.setItem('customHomeTitles', JSON.stringify(customHomeTitles));
                                    localStorage.setItem('activeTab', activeTab);
                                    
                                    // Save spreadsheet highlights
                                    localStorage.setItem('pinnedMarketingItems', JSON.stringify(pinnedMarketingItems));
                                    localStorage.setItem('hiddenMarketingItems', JSON.stringify(hiddenMarketingItems));
                                    localStorage.setItem('customMarketingTitles', JSON.stringify(customMarketingTitles));
                                    
                                    localStorage.setItem('pinnedSalesItems', JSON.stringify(pinnedSalesItems));
                                    localStorage.setItem('hiddenSalesItems', JSON.stringify(hiddenSalesItems));
                                    localStorage.setItem('customSalesTitles', JSON.stringify(customSalesTitles));
                                    
                                    localStorage.setItem('pinnedFinanceItems', JSON.stringify(pinnedFinanceItems));
                                    localStorage.setItem('hiddenFinanceItems', JSON.stringify(hiddenFinanceItems));
                                    localStorage.setItem('customFinanceTitles', JSON.stringify(customFinanceTitles));

                                    localStorage.setItem('pinnedLostItems', JSON.stringify(pinnedLostItems));
                                    localStorage.setItem('hiddenLostItems', JSON.stringify(hiddenLostItems));
                                    localStorage.setItem('customLostTitles', JSON.stringify(customLostTitles));
                                    
                                    setShowGlobalSettings(false);
                                    
                                    // Instead of full reload, just trigger a data refresh
                                    // This is more reliable and provides better UX
                                    await loadData();
                                    
                                    // Optional: if GIDs changed, some internal states might need reset
                                    // but loadData should handle the main data update.
                                } catch (e) {
                                    console.error("Erro ao salvar configurações:", e);
                                    alert("Erro ao salvar configurações. Verifique o console.");
                                }
                            }}
                            className="w-full py-4 bg-[#70d44c] text-[#001a2c] font-bold rounded-xl hover:bg-[#62ba42] transition-all shadow-lg shadow-[#70d44c]/10"
                        >
                            Salvar e Atualizar
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative">
            {/* Background gradients */}
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#70d44c] opacity-[0.03] blur-[100px] pointer-events-none rounded-full translate-x-[-50%] translate-y-[-50%]" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#003554] opacity-[0.2] blur-[100px] pointer-events-none rounded-full translate-x-[20%] translate-y-[20%]" />

            {activeTab === Tab.HOME && renderHome()}
            {activeTab === Tab.MARKETING && renderSpreadsheetView(
                "Marketing", 
                data[Tab.MARKETING], 
                'bg-purple-400', 
                Tab.MARKETING,
                pinnedMarketingItems,
                setPinnedMarketingItems,
                hiddenMarketingItems,
                setHiddenMarketingItems,
                customMarketingTitles,
                setCustomMarketingTitles,
                showMarketingSettings,
                setShowMarketingSettings,
                handleDragEndMarketing
            )}
            {activeTab === Tab.NEW_BUSINESS && renderSpreadsheetView(
                "Novos Negócios", 
                data[Tab.NEW_BUSINESS], 
                'bg-blue-400', 
                Tab.NEW_BUSINESS,
                pinnedSalesItems,
                setPinnedSalesItems,
                hiddenSalesItems,
                setHiddenSalesItems,
                customSalesTitles,
                setCustomSalesTitles,
                showSalesSettings,
                setShowSalesSettings,
                handleDragEndSales
            )}
            {activeTab === Tab.WON && renderSpreadsheetView(
                "Negócios Ganhos", 
                data[Tab.WON], 
                'bg-[#70d44c]', 
                Tab.WON,
                pinnedFinanceItems,
                setPinnedFinanceItems,
                hiddenFinanceItems,
                setHiddenFinanceItems,
                customFinanceTitles,
                setCustomFinanceTitles,
                showFinanceSettings,
                setShowFinanceSettings,
                handleDragEndFinance
            )}
            {activeTab === Tab.LOST && renderSpreadsheetView(
                "Negócios Perdidos", 
                data[Tab.LOST], 
                'bg-red-500', 
                Tab.LOST,
                pinnedLostItems,
                setPinnedLostItems,
                hiddenLostItems,
                setHiddenLostItems,
                customLostTitles,
                setCustomLostTitles,
                showLostSettings,
                setShowLostSettings,
                handleDragEndLost
            )}
            {activeTab === Tab.COMMERCIAL_DATA && renderCommercialDataView()}
            {activeTab === Tab.OTHERS && renderOthersView()}
        </div>

        {/* AI Modal (Global) */}
        {showAiModal && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                <div 
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
                    onClick={() => setShowAiModal(false)}
                />
                <div className="relative w-full max-w-2xl bg-[#001a2c] border border-[#70d44c]/30 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                    <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-[#003554] to-[#001a2c]">
                        <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                            <BrainCircuit className="text-[#70d44c]" />
                            Análise Inteligente (AI)
                        </h3>
                        <button onClick={() => setShowAiModal(false)} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                    <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                        {loadingInsights ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 className="animate-spin text-[#70d44c] mb-4" size={48} />
                                <p className="text-gray-400 animate-pulse">A IA está processando os dados do dashboard...</p>
                            </div>
                        ) : insights ? (
                            <div className="prose prose-invert max-w-none">
                                <div className="bg-white/5 p-6 rounded-xl border border-white/10 text-gray-200 leading-relaxed whitespace-pre-wrap">
                                    {insights}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <p className="text-gray-400 mb-6">Nenhuma análise gerada ainda.</p>
                                <button 
                                    onClick={handleAiInsights}
                                    className="px-8 py-3 bg-[#70d44c] text-[#001a2c] font-bold rounded-xl hover:bg-[#62ba42] transition-all shadow-lg shadow-[#70d44c]/20"
                                >
                                    Gerar Nova Análise
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="p-6 bg-[#001524] border-t border-white/10 flex justify-between items-center">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Powered by Gemini AI</p>
                        <button 
                            onClick={handleAiInsights}
                            disabled={loadingInsights}
                            className="text-xs font-bold text-[#70d44c] hover:underline disabled:opacity-50"
                        >
                            {insights ? 'Recalcular Análise' : ''}
                        </button>
                    </div>
                </div>
            </div>
        )}
      </main>
    </div>
  );
};

export default App;
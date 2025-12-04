
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_SITES, MOCK_FORMS, GOOGLE_CLIENT_ID, TRELLO_API_KEY, TRELLO_TOKEN, FALLBACK_API_KEY, DEFAULT_NEWS_TOPICS } from './constants';
import { SiteConfig, SiteStatus, ViewState, FormSubmission, EmailMessage, TrelloBoard, TrelloList, TrelloCard, WeatherData, DashboardPrefs, CalendarEvent, NewsArticle } from './types';
import MonitorCard from './components/MonitorCard';
import InboxItem from './components/InboxItem';
import EmailItem from './components/EmailItem';
import FormDetailsModal from './components/FormDetailsModal';
import EmailDetailsModal from './components/EmailDetailsModal';
import TrelloCardItem from './components/TrelloCardItem';
import WeatherWidget from './components/WeatherWidget';
import CalendarEventItem from './components/CalendarEventItem'; 
import SideMenu from './components/SideMenu'; 
import ConfigModal from './components/ConfigModal'; 
import TabNav from './components/TabNav';
import NewsCard from './components/NewsCard';
import NewsWidget from './components/NewsWidget';
import { fetchFormsFromWP, fetchSiteStats } from './services/wpService';
import { fetchGmailMessages } from './services/gmailService';
import { fetchBoards, fetchLists, fetchCardsFromList } from './services/trelloService';
import { generateDashboardInsight } from './services/geminiService'; 
import { fetchNewsWithAI } from './services/newsService';
import { fetchWeather, fetchLocationName, getWeatherInfo } from './services/weatherService';
import { fetchCalendarEvents } from './services/calendarService'; 
import { Activity, RefreshCw, AlertTriangle, WifiOff, Trash2, BarChart3, Mail, LogIn, LogOut, Copy, Info, Check, Trello, Settings, CheckSquare, ExternalLink, HelpCircle, Bell, Sparkles, X, Globe, MessageSquareText, Save, Send, User, ChevronDown, ChevronUp, AlertOctagon, Menu, Calendar, Star, Key, Newspaper, PlusCircle } from 'lucide-react';

declare global {
  interface Window {
    google?: any;
  }
}

function usePersistedState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      if (typeof window === 'undefined') return initialValue;
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Erro ao recuperar chave ${key}:`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(state));
      }
    } catch (error) {
      console.warn(`Erro ao salvar chave ${key}:`, error);
    }
  }, [key, state]);

  return [state, setState];
}

const playNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const audioCtx = new AudioContext();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3);

    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.3);
  } catch (e) {
    console.error("Erro ao reproduzir som:", e);
  }
};

const TRELLO_COLORS = ['blue', 'amber', 'emerald', 'purple', 'rose', 'cyan', 'indigo', 'lime'];

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [sites, setSites] = useState<SiteConfig[]>(DEFAULT_SITES);
  const [forms, setForms] = useState<FormSubmission[]>(MOCK_FORMS);
  const [isLoadingForms, setIsLoadingForms] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weatherPermissionDenied, setWeatherPermissionDenied] = useState(false);

  // Calendar State
  const [calendarIds, setCalendarIds] = usePersistedState<string[]>('monitor_calendar_ids_v4', [
      'teenfotos@gmail.com',
      '1f8c739170fec62adf69574e232ec995685e6efc65e6fee560895d12f5f1afab@group.calendar.google.com',
      'hgmvbnhlrf4ufbjbg74m1sn004n9i34u@import.calendar.google.com' // Feriados
  ]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);

  // News State
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const [lastNewsFetch, setLastNewsFetch] = usePersistedState<number>('monitor_last_news_fetch', 0);
  const [newsError, setNewsError] = useState<string | null>(null);

  const [googleToken, setGoogleToken] = usePersistedState<string | null>('monitor_google_token_v2', null);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [authError, setAuthError] = useState<boolean>(false); 
  const [authErrorType, setAuthErrorType] = useState<string | null>(null);
  const [apiNotEnabled, setApiNotEnabled] = useState<boolean>(false);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  
  const tokenClient = useRef<any>(null);

  const [websiteSubTab, setWebsiteSubTab] = useState<'status' | 'forms'>('status');

  const [insightResult, setInsightResult] = useState<string | null>(null);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);

  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // v15: Added dashboardOrder
  const [dashPrefs, setDashPrefs] = usePersistedState<DashboardPrefs>('dashboard_prefs_v15', {
      showSites: true,
      showTrello: true,
      showGoogle: true,
      showWeather: true,
      showCalendar: true,
      googleApiKey: FALLBACK_API_KEY,
      newsTopics: DEFAULT_NEWS_TOPICS,
      dashboardOrder: ['insight', 'news', 'weather', 'notifications', 'shortcuts', 'sites_list']
  });

  const [trelloKey, setTrelloKey] = usePersistedState<string>('monitor_trello_key_v3', TRELLO_API_KEY);
  const [trelloToken, setTrelloToken] = usePersistedState<string>('monitor_trello_token_v3', TRELLO_TOKEN);
  const [trelloBoardId, setTrelloBoardId] = usePersistedState<string>('monitor_trello_board_v3', '');
  const [trelloListIds, setTrelloListIds] = usePersistedState<string[]>('monitor_trello_lists_v3', []);
  const [trelloLastView, setTrelloLastView] = usePersistedState<string>('monitor_trello_last_view_v3', new Date(0).toISOString());
  
  const [trelloBadgeCount, setTrelloBadgeCount] = useState(0);
  const [trelloCards, setTrelloCards] = useState<TrelloCard[]>([]);
  const [availableBoards, setAvailableBoards] = useState<TrelloBoard[]>([]);
  const [availableLists, setAvailableLists] = useState<TrelloList[]>([]);
  const [isLoadingTrello, setIsLoadingTrello] = useState(false);
  const [isSelectingLists, setIsSelectingLists] = useState(false); 
  const [activeTrelloFilter, setActiveTrelloFilter] = useState<string>('ALL');

  const [readFormIds, setReadFormIds] = usePersistedState<string[]>('monitor_read_forms_v2', []);
  const [deletedFormIds, setDeletedFormIds] = usePersistedState<string[]>('monitor_deleted_forms_v2', []);

  const deletedIdsRef = useRef<string[]>([]);
  const readIdsRef = useRef<string[]>([]);
  const sitesRef = useRef<SiteConfig[]>(DEFAULT_SITES);
  const prevEmailIdsRef = useRef<string[]>([]);
  const prevTrelloCardIdsRef = useRef<string[]>([]);

  // Gesture State
  const touchStartRef = useRef<{x: number, y: number} | null>(null);
  const touchEndRef = useRef<{x: number, y: number} | null>(null);

  useEffect(() => { deletedIdsRef.current = deletedFormIds || []; }, [deletedFormIds]);
  useEffect(() => { readIdsRef.current = readFormIds || []; }, [readFormIds]);
  useEffect(() => { sitesRef.current = sites; }, [sites]);

  useEffect(() => {
    if (trelloKey && trelloToken && trelloListIds.length === 0) {
        setIsSelectingLists(true);
        loadTrelloBoards();
    }
  }, [trelloKey, trelloToken, trelloListIds.length]);

  useEffect(() => {
    if (currentView === ViewState.TRELLO) {
      setTrelloLastView(new Date().toISOString());
      setTrelloBadgeCount(0);
    }
  }, [currentView]);

  // Fetch News logic
  const loadNews = async (force: boolean = false, append: boolean = false) => {
    // Evita fetch excessivo (cache de 1 hora) se não for force e não for append
    if (!force && !append && newsArticles.length > 0 && (Date.now() - lastNewsFetch < 3600000)) {
        return;
    }
    
    setIsLoadingNews(true);
    setNewsError(null);

    try {
        const effectiveKey = (dashPrefs.googleApiKey && dashPrefs.googleApiKey.trim() !== '') 
                             ? dashPrefs.googleApiKey 
                             : FALLBACK_API_KEY;

        // Se for append (carregar mais), embaralhamos os tópicos para tentar pegar coisas diferentes
        let topicsToFetch = [...(dashPrefs.newsTopics || DEFAULT_NEWS_TOPICS)];
        if (append) {
            topicsToFetch = topicsToFetch.sort(() => Math.random() - 0.5);
        }

        const newArticles = await fetchNewsWithAI(topicsToFetch, effectiveKey);
        
        if (newArticles.length > 0) {
            if (append) {
                setNewsArticles(prev => {
                    const existingTitles = new Set(prev.map(a => a.title));
                    const filteredNew = newArticles.filter(a => !existingTitles.has(a.title));
                    return [...prev, ...filteredNew];
                });
            } else {
                setNewsArticles(newArticles);
            }
            setLastNewsFetch(Date.now());
        }
    } catch (e: any) {
        console.error("Erro ao carregar notícias:", e);
        setNewsError(e.message || "Falha ao carregar notícias");
    } finally {
        setIsLoadingNews(false);
    }
  };

  useEffect(() => {
    if (currentView === ViewState.NEWS) {
        loadNews();
    }
  }, [currentView, dashPrefs.newsTopics]);

  // Carregar notícias na inicialização para o Widget
  useEffect(() => {
    if (newsArticles.length === 0) {
        loadNews();
    }
  }, []); // Run once on mount

  useEffect(() => {
    const initGoogleAuth = () => {
      if (window.google && window.google.accounts && !tokenClient.current) {
        try {
          tokenClient.current = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.events.readonly',
            prompt: 'consent', 
            callback: (response: any) => {
              if (response.access_token) {
                setGoogleToken(response.access_token);
                setAuthError(false);
                setAuthErrorType(null);
                setApiNotEnabled(false);
                fetchGoogleData(response.access_token);
                updateCalendar(response.access_token);
              }
            },
            error_callback: (error: any) => {
                console.error("Google Auth Error:", error);
                setAuthError(true);
                if (error.type === 'popup_closed_by_user') setAuthErrorType('popup_closed');
                else setAuthErrorType(error.type || 'generic');
            }
          });
          setIsGoogleReady(true);
        } catch (e) {
          console.error("Erro ao inicializar Google Auth:", e);
        }
      }
    };

    const timer = setInterval(() => {
      if (window.google) {
        initGoogleAuth();
        clearInterval(timer);
      }
    }, 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  const loadWeather = useCallback(() => {
    if (!('geolocation' in navigator)) return;
    
    setLoadingWeather(true);
    setWeatherPermissionDenied(false);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const weatherData = await fetchWeather(latitude, longitude);
          const locationName = await fetchLocationName(latitude, longitude);
          
          if (weatherData) {
            setWeather({ ...weatherData, locationName });
          }
        } catch (e) {
          // Falha silenciosa
        } finally {
          setLoadingWeather(false);
        }
      },
      (error) => {
        console.warn("Geo Error:", error);
        setLoadingWeather(false);
        if (error.code === error.PERMISSION_DENIED) {
          setWeatherPermissionDenied(true);
        }
      }
    );
  }, []);

  useEffect(() => {
    if (dashPrefs.showWeather) {
      loadWeather();
    }
  }, [loadWeather, dashPrefs.showWeather]);

  const updateCalendar = async (token?: string | null) => {
    setIsLoadingCalendar(true);
    try {
        const effectiveKey = (dashPrefs.googleApiKey && dashPrefs.googleApiKey.trim() !== '') 
                             ? dashPrefs.googleApiKey 
                             : FALLBACK_API_KEY;

        const events = await fetchCalendarEvents(
            { 
              token: token || googleToken, 
              apiKey: effectiveKey
            }, 
            calendarIds
        );
        setCalendarEvents(events);
    } catch (e) {
        console.error("Erro calendário:", e);
    } finally {
        setIsLoadingCalendar(false);
    }
  };

  const handleAddCalendar = (id: string) => {
      if (!calendarIds.includes(id)) {
          setCalendarIds(prev => [...prev, id]);
          setTimeout(() => updateCalendar(), 500);
      }
  };

  const handleRemoveCalendar = (id: string) => {
      setCalendarIds(prev => prev.filter(c => c !== id));
      setTimeout(() => updateCalendar(), 500);
  };

  const handleUpdateApiKey = (key: string) => {
    setDashPrefs(prev => ({ ...prev, googleApiKey: key }));
    setTimeout(() => {
      fetchCalendarEvents({ token: googleToken, apiKey: key }, calendarIds)
        .then(events => setCalendarEvents(events))
        .finally(() => setIsLoadingCalendar(false));
    }, 100);
  };

  const handleAddNewsTopic = (topic: string) => {
     setDashPrefs(prev => ({ 
        ...prev, 
        newsTopics: [...(prev.newsTopics || []), topic] 
     }));
     // Force refresh news
     setTimeout(() => loadNews(true), 100);
  };

  const handleRemoveNewsTopic = (topic: string) => {
     setDashPrefs(prev => ({ 
        ...prev, 
        newsTopics: (prev.newsTopics || []).filter(t => t !== topic) 
     }));
     // Force refresh news
     setTimeout(() => loadNews(true), 100);
  };

  const handleReorderDashboard = (newOrder: string[]) => {
      setDashPrefs(prev => ({ ...prev, dashboardOrder: newOrder }));
  };

  const checkSiteStatus = async (site: SiteConfig): Promise<SiteConfig> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const startTime = performance.now();

    try {
      const stats = await fetchSiteStats(site);
      const endTime = performance.now();
      clearTimeout(timeoutId);
      const latency = Math.round(endTime - startTime);

      if (latency > 3000 && (site.responseTime || 0) < 3000 && site.status === SiteStatus.ONLINE) {
        sendNotification('Instabilidade', `O site ${site.name} está lento.`);
      }

      if (stats) {
        return { ...site, status: SiteStatus.ONLINE, lastChecked: new Date(), responseTime: latency, onlineUsers: stats.online, monthlyVisitors: stats.monthly };
      }

      await fetch(site.url, { method: 'HEAD', mode: 'no-cors', signal: controller.signal });
      const fallbackLatency = Math.round(performance.now() - startTime);

      return { ...site, status: SiteStatus.ONLINE, lastChecked: new Date(), responseTime: fallbackLatency, onlineUsers: site.onlineUsers || 0, monthlyVisitors: site.monthlyVisitors || 0 };
    } catch (error) {
      if (site.status === SiteStatus.ONLINE || site.status === SiteStatus.CHECKING) {
         sendNotification('Site Offline!', `URGENTE: ${site.name} fora do ar.`);
      }
      return { ...site, status: SiteStatus.OFFLINE, lastChecked: new Date(), onlineUsers: 0, monthlyVisitors: site.monthlyVisitors };
    }
  };

  const handleRefreshSite = async (id: string) => {
    setSites(prev => prev.map(s => s.id === id ? { ...s, status: SiteStatus.CHECKING } : s));
    const site = sites.find(s => s.id === id);
    if (site) {
      const updatedSite = await checkSiteStatus(site);
      setSites(prev => prev.map(s => s.id === id ? updatedSite : s));
    }
  };

  const checkAllSites = useCallback(async () => {
    setSites(prev => prev.map(s => ({ ...s, status: SiteStatus.CHECKING })));
    const results = await Promise.all(sitesRef.current.map(site => checkSiteStatus(site)));
    setSites(results);
  }, []);

  const syncForms = async () => {
    setIsLoadingForms(true);
    try {
      const results = await Promise.all(sitesRef.current.map(site => fetchFormsFromWP(site)));
      const fetchedForms = results.flat();
      
      if (fetchedForms.length > 0) {
        setForms(currentForms => {
          const currentDeletedIds = deletedIdsRef.current || [];
          const currentReadIds = readIdsRef.current || [];
          
          const activeForms = fetchedForms.filter(f => 
            !currentDeletedIds.includes(f.id) && !isNaN(f.timestamp.getTime())
          );
          
          const processedForms = activeForms.map(f => ({
            ...f,
            isRead: currentReadIds.includes(f.id) ? true : f.isRead
          }));

          const previousIds = currentForms.map(c => c.id);
          const newArrivals = processedForms.filter(p => 
            !previousIds.includes(p.id) && !p.isRead && !currentDeletedIds.includes(p.id)
          );
          
          if (newArrivals.length > 0) {
             sendNotification('Novo Formulário', `Você recebeu ${newArrivals.length} nova(s) mensagem(ns).`);
          }

          return processedForms.sort((a, b) => {
            if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
            return b.timestamp.getTime() - a.timestamp.getTime();
          });
        });
      }
    } catch (e) {
      console.error("Erro forms", e);
    } finally {
      setIsLoadingForms(false);
    }
  };

  const fetchGoogleData = async (tokenOverride?: string) => {
    if (!tokenOverride && !googleToken) return;
    
    setIsLoadingGoogle(true);
    try {
      const currentToken = tokenOverride || googleToken;

      if (currentToken) {
          const messages = await fetchGmailMessages(currentToken, 80);
          setApiNotEnabled(false);

          const currentUnread = messages.filter(m => m.isUnread);
          const newUnread = currentUnread.filter(m => !prevEmailIdsRef.current.includes(m.id));

          if (prevEmailIdsRef.current.length > 0 && newUnread.length > 0) {
             sendNotification('Novo E-mail', `${newUnread.length} novo(s) e-mail(s).`);
          }
          prevEmailIdsRef.current = messages.map(m => m.id);
          setEmails(messages);
      }
    } catch (error: any) {
      console.error("Erro Google:", error);
      if (error.message === 'API_NOT_ENABLED') {
        setApiNotEnabled(true);
      } else if (error.message === 'AUTH_EXPIRED') {
        console.warn("Token expirado");
      }
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  const handleConnectGoogle = () => {
    if (tokenClient.current) {
      setAuthError(false); 
      tokenClient.current.requestAccessToken();
    } else {
      alert("Google Auth carregando...");
    }
  };

  const handleDisconnectGoogle = () => {
    setGoogleToken(null);
    setEmails([]);
    setCalendarEvents([]); 
    setAuthError(false);
    if (window.google && googleToken) {
      try { window.google.accounts.oauth2.revoke(googleToken, () => {}); } catch (e) {}
    }
    fetchGoogleData(undefined);
  };

  const loadTrelloBoards = async () => {
    if (!trelloKey || !trelloToken) return;
    setIsLoadingTrello(true);
    try {
      const boards = await fetchBoards(trelloKey, trelloToken);
      setAvailableBoards(boards);
    } catch (e) {
      alert('Erro Trello. Verifique chaves.');
    } finally {
      setIsLoadingTrello(false);
    }
  };

  const loadTrelloLists = async (boardId: string) => {
    setIsLoadingTrello(true);
    try {
      const lists = await fetchLists(trelloKey, trelloToken, boardId);
      setAvailableLists(lists);
      return lists;
    } catch (e) { return []; } finally { setIsLoadingTrello(false); }
  };

  const fetchTrelloCards = async () => {
    if (!trelloKey || !trelloToken || !trelloListIds.length) return;
    setIsLoadingTrello(true);
    try {
      let currentLists = availableLists;
      if (availableLists.length === 0 && trelloBoardId) {
         currentLists = await loadTrelloLists(trelloBoardId);
      }

      const allCards: TrelloCard[] = [];
      const promises = trelloListIds.map(async listId => {
          const cards = await fetchCardsFromList(trelloKey, trelloToken, listId);
          const listName = currentLists.find(l => l.id === listId)?.name || 'Lista';
          return cards.map(c => ({ ...c, listName }));
      });

      const results = await Promise.all(promises);
      results.forEach(listCards => allCards.push(...listCards));
      
      const newCards = allCards.filter(c => !prevTrelloCardIdsRef.current.includes(c.id));
      if (newCards.length > 0 && prevTrelloCardIdsRef.current.length > 0) {
         sendNotification('Trello', `${newCards.length} cartões novos.`);
      }

      if (currentView !== ViewState.TRELLO) {
        const lastViewDate = new Date(trelloLastView);
        const unreadCards = allCards.filter(c => new Date(c.dateLastActivity) > lastViewDate);
        setTrelloBadgeCount(unreadCards.length);
      } else {
        setTrelloBadgeCount(0);
      }

      prevTrelloCardIdsRef.current = allCards.map(c => c.id);
      setTrelloCards(allCards.sort((a, b) => b.dateLastActivity.getTime() - a.dateLastActivity.getTime()));
    } catch (e) { console.error("Erro Trello", e); } finally { setIsLoadingTrello(false); }
  };

  const handleGenerateInsight = async () => {
    setIsLoadingInsight(true);
    setInsightResult(null); 
    setInsightError(null);
    
    let weatherText = "Clima não informado (ative a localização).";
    
    if (weather) {
        const currentInfo = getWeatherInfo(weather.current.code);
        const todayInfo = getWeatherInfo(weather.today.code);
        
        const weekContext = weather.weekSummary 
            ? `PREVISÃO SEMANAL: ${weather.weekSummary}` 
            : "Sem previsão estendida.";

        weatherText = `
          Local: ${weather.locationName || 'Atual'}. 
          Agora: ${weather.current.temp}°C (${currentInfo.label}).
          Hoje: Max ${weather.today.max}° / Min ${weather.today.min}° (${todayInfo.label}).
          ${weekContext}
        `;
    }

    const nextEvent = calendarEvents.find(e => e.start > new Date());

    const context = {
        sites: sites.map(s => `${s.name}: ${s.status}`),
        forms: forms.filter(f => !f.isRead).slice(0, 3).map(f => `${f.senderName}: ${f.message.substring(0, 50)}...`),
        emails: emails.filter(e => e.isUnread).slice(0, 5).map(e => e.subject),
        trello: trelloBadgeCount,
        weather: weatherText,
        calendar: nextEvent ? `Próximo evento: ${nextEvent.title} às ${nextEvent.start.toLocaleTimeString()}` : "Sem eventos próximos."
    };

    try {
        const result = await generateDashboardInsight(context as any); 
        setInsightResult(result);
    } catch (error: any) {
        console.error("Falha ao gerar insight na UI:", error);
        setInsightError(error.message || "Erro desconhecido.");
    } finally {
        setIsLoadingInsight(false);
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        setNotifPermission(permission);
        if (permission === 'granted') {
          sendNotification('Notificações Ativadas', 'Você receberá alertas.');
        }
      } catch (error) {
        console.error('Erro ao solicitar permissão:', error);
      }
    }
  };

  const sendNotification = (title: string, body: string) => {
    if (notifPermission !== 'granted') return;
    playNotificationSound();
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
         new Notification(title, { 
           body, 
           icon: 'https://tidas.com.br/wp-content/uploads/2025/11/icoapp.png',
           tag: 'tidas-notification',
           requireInteraction: false
         });
         if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      }
    } catch (e) {
      console.warn('Falha notificação:', e);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
       if (isMounted) {
         await checkAllSites();
         await syncForms();
         fetchGoogleData(googleToken || undefined);
         updateCalendar(googleToken || undefined);
         
         if (trelloKey && trelloToken && trelloListIds.length > 0) {
            try {
               const promises = trelloListIds.map(id => fetchCardsFromList(trelloKey, trelloToken, id));
               const results = await Promise.all(promises);
               const allCards = results.flat();
               prevTrelloCardIdsRef.current = allCards.map(c => c.id);
               setTrelloCards(allCards.sort((a, b) => b.dateLastActivity.getTime() - a.dateLastActivity.getTime()));
            } catch(e) {}
         }
       }
    };
    init();

    const intervalId = setInterval(async () => {
      if (isMounted) {
        await syncForms();
        setSites(await Promise.all(sitesRef.current.map(site => checkSiteStatus(site))));
        fetchGoogleData(googleToken || undefined);
        updateCalendar(googleToken || undefined);
        if (trelloKey && trelloToken && trelloListIds.length > 0) fetchTrelloCards();
      }
    }, 10000);

    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            console.log("App foreground: refreshing data...");
            checkAllSites();
            updateCalendar();
            if (dashPrefs.showWeather) loadWeather();
        }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => { 
        isMounted = false; 
        clearInterval(intervalId); 
        document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [googleToken, dashPrefs.showWeather, loadWeather, calendarIds]);

  // Touch Handlers for Page Swiping (Android Style)
  const handleTouchStart = (e: React.TouchEvent) => {
      touchStartRef.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY };
      touchEndRef.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      touchEndRef.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY };
  };

  const handleTouchEnd = () => {
      if (!touchStartRef.current || !touchEndRef.current) return;
      
      const xDiff = touchStartRef.current.x - touchEndRef.current.x;
      const yDiff = touchStartRef.current.y - touchEndRef.current.y;
      
      const minSwipeDistance = 60;
      const maxVerticalVariance = 50;

      // Ensure horizontal swipe is dominant and significant
      if (Math.abs(xDiff) > minSwipeDistance && Math.abs(yDiff) < maxVerticalVariance) {
          // Swipe Right (Finger moves Left to Right, xDiff < 0) -> Open News
          if (xDiff < 0) {
              if (currentView === ViewState.DASHBOARD) {
                   setCurrentView(ViewState.NEWS);
              }
          }
          // Swipe Left (Finger moves Right to Left, xDiff > 0) -> Close News (Go Back)
          else {
              if (currentView === ViewState.NEWS) {
                   setCurrentView(ViewState.DASHBOARD);
              }
          }
      }
      
      touchStartRef.current = null;
      touchEndRef.current = null;
  };

  const handleMarkAsRead = (id: string) => {
    if (!readFormIds.includes(id)) {
      setReadFormIds(prev => [...prev, id]);
      setForms(prev => prev.map(f => f.id === id ? { ...f, isRead: true } : f).sort((a, b) => a.isRead ? 1 : -1));
    }
  };

  const handleDismissForm = (id: string) => {
    setDeletedFormIds(prev => [...prev, id]);
    setForms(prev => prev.filter(f => !f.isRead));
  };

  const handleClearRead = () => {
    const readIds = forms.filter(f => f.isRead).map(f => f.id);
    setDeletedFormIds(prev => [...prev, ...readIds]);
    setForms(prev => prev.filter(f => !f.isRead));
  };

  const copyOrigin = () => {
    navigator.clipboard.writeText(window.location.origin).then(() => {
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
    });
  };

  const handleNavigation = (view: string, subTab?: string) => {
    setCurrentView(view as ViewState);
    if (view === ViewState.WEBSITES && subTab) setWebsiteSubTab(subTab as any);
  };

  const renderDashboard = () => {
    const blocks: Record<string, React.ReactElement | null> = {
      insight: (
        <div key="insight" 
            onClick={() => !isLoadingInsight && handleGenerateInsight()}
            className="bg-gradient-to-r from-indigo-900/80 to-slate-800 p-3 rounded-2xl border border-indigo-500/20 shadow-lg relative overflow-hidden group cursor-pointer hover:bg-slate-800/50 transition-all active:scale-[0.99]"
        >
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
            
            <div className="flex justify-between items-center mb-1 relative z-10">
                <div className="flex items-center gap-2">
                    <div className="p-1 bg-yellow-400/10 rounded-lg">
                        <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                    </div>
                    <h3 className="font-bold text-slate-100 text-xs uppercase tracking-wide">Insight do Dia</h3>
                </div>
                {isLoadingInsight && <span className="text-[10px] text-indigo-300 animate-pulse">Gerando...</span>}
            </div>

            <div className="relative z-10 mt-1">
                {insightError ? (
                    <div className="p-2 bg-rose-500/10 rounded border border-rose-500/20">
                        <p className="text-[10px] text-rose-300 font-bold mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Erro ao gerar:</p>
                        <p className="text-[10px] text-rose-400 leading-tight break-words">{insightError}</p>
                    </div>
                ) : insightResult ? (
                    <p className="text-xs text-slate-300 leading-relaxed animate-fade-in whitespace-pre-line">
                        {insightResult}
                    </p>
                ) : (
                    <p className="text-xs text-slate-400 italic">
                        Toque aqui para gerar um resumo com IA (Clima semanal, E-mails e Alertas).
                    </p>
                )}
            </div>
        </div>
      ),
      news: (
        <NewsWidget 
            key="news"
            articles={newsArticles} 
            isLoading={isLoadingNews} 
            onNavigate={() => setCurrentView(ViewState.NEWS)} 
        />
      ),
      weather: dashPrefs.showWeather ? (
          <div key="weather" className="-mt-2">
              <WeatherWidget 
                weather={weather} 
                loading={loadingWeather} 
                permissionDenied={weatherPermissionDenied}
                onRequestPermission={loadWeather}
              />
          </div>
      ) : null,
      notifications: notifPermission === 'default' ? (
           <button key="notif" onClick={requestNotificationPermission} className="w-full bg-blue-600/20 text-blue-300 text-xs font-bold p-3 rounded-xl border border-blue-600/30 flex items-center justify-center gap-2">
              <Bell className="w-4 h-4" /> ATIVAR NOTIFICAÇÕES
           </button>
      ) : null,
      shortcuts: (
        <div key="shortcuts" className="grid grid-cols-2 gap-4">
          {dashPrefs.showSites && (
            <div onClick={() => handleNavigation(ViewState.WEBSITES, 'status')} className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-sm cursor-pointer active:scale-95 transition-all">
              <div className="flex items-center gap-2 mb-2 text-brand-400"><Globe className="w-4 h-4" /><span className="text-xs font-semibold">SITES & FORMS</span></div>
              <div className="flex justify-between items-end">
                <div className="text-2xl font-bold text-slate-100">{forms.filter(f => !f.isRead).length}</div>
                {sites.some(s => s.status === SiteStatus.OFFLINE) && <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />}
              </div>
            </div>
          )}
          
          {dashPrefs.showTrello && (
            <div onClick={() => setCurrentView(ViewState.TRELLO)} className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-sm cursor-pointer active:scale-95 transition-all">
              <div className="flex items-center gap-2 mb-2 text-blue-400"><Trello className="w-4 h-4" /><span className="text-xs font-semibold">TRELLO</span></div>
              <div className="text-2xl font-bold text-slate-100">{trelloCards.length}</div>
            </div>
          )}

          {dashPrefs.showGoogle && (
            <div onClick={() => handleNavigation(ViewState.GOOGLE)} className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-sm cursor-pointer active:scale-95 transition-all">
              <div className="flex items-center gap-2 mb-2 text-red-400"><Mail className="w-4 h-4" /><span className="text-xs font-semibold">E-MAIL</span></div>
              <div className="text-2xl font-bold text-slate-100">
                  {googleToken ? emails.filter(e => e.isUnread).length : <LogIn className="w-5 h-5 text-slate-500" />}
              </div>
            </div>
          )}

           {dashPrefs.showCalendar && (
            <div onClick={() => handleNavigation(ViewState.CALENDAR)} className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-sm cursor-pointer active:scale-95 transition-all">
              <div className="flex items-center gap-2 mb-2 text-purple-400"><Calendar className="w-4 h-4" /><span className="text-xs font-semibold">AGENDA</span></div>
              <div className="text-2xl font-bold text-slate-100">
                  {calendarEvents.filter(e => e.start >= new Date() && e.start.getDate() === new Date().getDate()).length}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Eventos hoje</div>
            </div>
          )}
        </div>
      ),
      sites_list: dashPrefs.showSites ? (
          <div key="sites_list" className="mb-6">
            <div className="flex justify-between items-center mb-4 px-1">
                <h3 className="text-lg font-bold text-slate-100">Status dos Sites</h3>
                <button onClick={checkAllSites} className="p-2 bg-brand-secondary/20 text-brand-secondary rounded-full hover:bg-brand-secondary/30"><RefreshCw className="w-4 h-4" /></button>
            </div>
            {sites.map(site => <MonitorCard key={site.id} site={site} onRefresh={handleRefreshSite} minimal={true} />)}
          </div>
      ) : null
    };

    const currentOrder = dashPrefs.dashboardOrder || ['insight', 'news', 'weather', 'notifications', 'shortcuts', 'sites_list'];

    return (
      <div className="space-y-6 animate-fade-in pt-4 pb-32">
        {currentOrder.map(id => blocks[id] || null)}
      </div>
    );
  };

  const renderNewsHub = () => {
      return (
          <div className="pb-32 animate-fade-in flex flex-col h-full pt-4">
              <div className="flex justify-between items-center mb-4 px-1">
                  <div className="flex items-center gap-2">
                       <h2 className="text-xl font-bold text-slate-100">Notícias</h2>
                       <span className="text-[10px] bg-cyan-900 text-cyan-200 px-2 py-0.5 rounded-full border border-cyan-800">Discover</span>
                  </div>
                  <div className="flex gap-2">
                       <button onClick={() => setIsConfigModalOpen(true)} className="p-2 text-slate-500 hover:text-slate-300"><Settings className="w-5 h-5" /></button>
                       <button onClick={() => loadNews(true)} className={`p-2 bg-cyan-500/20 text-cyan-400 rounded-full ${isLoadingNews ? 'animate-spin' : ''}`}><RefreshCw className="w-4 h-4" /></button>
                  </div>
              </div>

              <div className="space-y-4">
                  
                  {/* Error State */}
                  {newsError && (
                      <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl mb-4">
                          <h3 className="text-rose-400 font-bold flex items-center gap-2"><AlertOctagon className="w-4 h-4"/> Erro ao carregar</h3>
                          <p className="text-rose-300 text-xs mt-1">{newsError}</p>
                          <p className="text-slate-500 text-[10px] mt-2">Verifique sua API Key nas configurações (precisa estar ativa para Google Search).</p>
                      </div>
                  )}

                  {isLoadingNews && newsArticles.length === 0 && (
                      <div className="flex flex-col items-center py-10">
                          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                          <p className="text-sm text-slate-500">Buscando atualizações com IA...</p>
                      </div>
                  )}

                  {!isLoadingNews && !newsError && newsArticles.length === 0 && (
                      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 text-center">
                          <Newspaper className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                          <p className="text-slate-300 font-bold">Sem notícias recentes.</p>
                          <p className="text-xs text-slate-500 mt-1">Verifique sua API Key ou adicione mais tópicos.</p>
                      </div>
                  )}

                  {newsArticles.map(article => (
                      <NewsCard key={article.id} article={article} />
                  ))}

                  {/* Load More Button */}
                  {newsArticles.length > 0 && !newsError && (
                      <button 
                        onClick={() => loadNews(true, true)}
                        disabled={isLoadingNews}
                        className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                      >
                         {isLoadingNews ? (
                             <>
                                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                                Carregando mais...
                             </>
                         ) : (
                             <>
                                <PlusCircle className="w-4 h-4" /> Carregar Mais
                             </>
                         )}
                      </button>
                  )}
              </div>
          </div>
      );
  };

  const renderWebsiteHub = () => {
    const unreadForms = forms.filter(f => !f.isRead).length;
    const offlineSites = sites.filter(s => s.status === SiteStatus.OFFLINE).length;

    return (
        <div className="pb-32 animate-fade-in flex flex-col h-full pt-4">
             <div className="flex flex-col mb-4 px-1">
                 <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-100">Meus Sites</h2>
                    <div className="flex gap-2">
                         {websiteSubTab === 'forms' && (
                             <>
                               {forms.some(f => f.isRead) && <button onClick={handleClearRead} className="p-2 text-slate-500 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>}
                               <button onClick={syncForms} className={`p-2 bg-brand-secondary/20 text-brand-secondary rounded-full ${isLoadingForms ? 'animate-spin' : ''}`}><RefreshCw className="w-4 h-4" /></button>
                             </>
                         )}
                         {websiteSubTab === 'status' && (
                              <button onClick={checkAllSites} className="p-2 bg-brand-secondary/20 text-brand-secondary rounded-full hover:bg-brand-secondary/30"><RefreshCw className="w-4 h-4" /></button>
                         )}
                    </div>
                 </div>
                 
                 <div className="bg-slate-800 p-1 rounded-xl flex gap-1">
                     <button 
                        onClick={() => setWebsiteSubTab('status')} 
                        className={`flex-1 py-2 rounded-lg text-xs font-bold flex justify-center items-center gap-2 transition-colors ${websiteSubTab === 'status' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'}`}
                     >
                        <Globe className="w-3.5 h-3.5" /> Status
                        {offlineSites > 0 && <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded-full animate-pulse">{offlineSites}</span>}
                     </button>
                     <button 
                        onClick={() => setWebsiteSubTab('forms')} 
                        className={`flex-1 py-2 rounded-lg text-xs font-bold flex justify-center items-center gap-2 transition-colors ${websiteSubTab === 'forms' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'}`}
                     >
                        <MessageSquareText className="w-3.5 h-3.5" /> Formulários
                        {unreadForms > 0 && <span className="bg-blue-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{unreadForms}</span>}
                     </button>
                 </div>
             </div>

             {websiteSubTab === 'status' && (
                <div>
                    {sites.map(site => <MonitorCard key={site.id} site={site} onRefresh={handleRefreshSite} />)}
                </div>
             )}

             {websiteSubTab === 'forms' && (
                <div className="overflow-x-hidden">
                     {forms.length === 0 && <div className="text-center py-10 text-slate-500"><WifiOff className="w-10 h-10 mx-auto mb-3 opacity-50" /><p>Nenhuma mensagem.</p></div>}
                     {forms.map(f => <InboxItem key={f.id} form={f} siteName={sites.find(s => s.id === f.siteId)?.name || 'Site'} onSelect={() => {setSelectedFormId(f.id); handleMarkAsRead(f.id);}} onDismiss={() => handleDismissForm(f.id)} />)}
                </div>
             )}
        </div>
    );
  };

  const renderGoogleLogin = (serviceName: string) => (
    <div className="flex flex-col items-center justify-center flex-1 px-6 text-center animate-fade-in py-10">
      <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-xl border border-slate-700">
        <LogIn className="w-10 h-10 text-blue-500" />
      </div>
      <h2 className="text-2xl font-bold text-slate-100 mb-2">Conectar Google</h2>
      <p className="text-slate-400 mb-8 max-w-xs text-sm">
        Faça login para acessar seu {serviceName}.
      </p>

      {apiNotEnabled && (
        <div className="w-full bg-slate-800/80 border border-slate-700 p-4 rounded-lg mb-6 text-left">
           <p className="text-xs text-slate-400 mb-2">API não ativada no Cloud Console.</p>
           <div className="flex items-center gap-2 bg-black/30 p-2 rounded border border-slate-700/50">
              <code className="text-[9px] text-slate-300 break-all font-mono">{window.location.origin}</code>
              <button onClick={copyOrigin} className="p-1 hover:bg-white/10 rounded"><Copy className="w-3 h-3" /></button>
           </div>
        </div>
      )}

      <button onClick={handleConnectGoogle} disabled={!isGoogleReady} className="w-full bg-white text-slate-900 font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-100 disabled:opacity-50">
        {isGoogleReady ? <> <img src="https://www.google.com/favicon.ico" className="w-4 h-4"/> Entrar com Google </> : 'Carregando...'}
      </button>
      <p className="text-[10px] text-slate-500 mt-4">O login expira em 1h por segurança.</p>
    </div>
  );

  const renderGoogleHub = () => {
    return (
        <div className="pb-32 animate-fade-in flex flex-col h-full pt-4">
             <div className="flex flex-col mb-4 px-1">
                 <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-100">E-mails</h2>
                    {googleToken ? (
                      <div className="flex gap-2">
                          <button onClick={handleDisconnectGoogle} className="p-2 text-slate-500 hover:text-rose-400"><LogOut className="w-5 h-5" /></button>
                          <button onClick={() => fetchGoogleData(googleToken)} className={`p-2 bg-blue-500/20 text-blue-400 rounded-full ${isLoadingGoogle ? 'animate-spin' : ''}`}><RefreshCw className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <button onClick={handleConnectGoogle} className="px-3 py-1 bg-blue-600/20 text-blue-400 text-xs rounded-lg hover:bg-blue-600/30 flex items-center gap-1"><LogIn className="w-3 h-3"/> Conectar Conta</button>
                    )}
                 </div>
             </div>

             {!googleToken ? renderGoogleLogin('Gmail') : (
                  <div>
                      {emails.length === 0 && !isLoadingGoogle && <div className="text-center py-10 text-slate-500"><Check className="w-8 h-8 text-emerald-500/50 mx-auto mb-2"/><p>Caixa limpa!</p></div>}
                      {emails.map(email => <EmailItem key={email.id} email={email} onSelect={() => {setSelectedEmailId(email.id); setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isUnread: false } : e));}} onDismiss={() => setEmails(prev => prev.filter(e => e.id !== email.id))} />)}
                  </div>
             )}
        </div>
    );
  };

  const renderCalendarHub = () => {
    const groupedEvents: { [key: string]: CalendarEvent[] } = {};
    const todayStr = new Date().toLocaleDateString();

    calendarEvents.forEach(event => {
      const dateKey = event.start.toLocaleDateString();
      if (!groupedEvents[dateKey]) groupedEvents[dateKey] = [];
      groupedEvents[dateKey].push(event);
    });

    const hasEvents = calendarEvents.length > 0;
    const hasApiKey = (dashPrefs.googleApiKey && dashPrefs.googleApiKey.length > 10) || (FALLBACK_API_KEY && FALLBACK_API_KEY.length > 10);

    return (
      <div className="pb-32 animate-fade-in flex flex-col h-full pt-4">
        <div className="flex justify-between items-center mb-4 px-1">
          <h2 className="text-xl font-bold text-slate-100">Agenda</h2>
          <div className="flex gap-2">
             <button onClick={() => setIsConfigModalOpen(true)} className="p-2 text-slate-500 hover:text-slate-300"><Settings className="w-5 h-5" /></button>
             <button onClick={() => updateCalendar()} className={`p-2 bg-purple-500/20 text-purple-400 rounded-full ${isLoadingCalendar ? 'animate-spin' : ''}`}><RefreshCw className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Warning se não tiver eventos e faltar chave */}
        {!hasEvents && !isLoadingCalendar && !hasApiKey && !googleToken && (
             <div className="bg-amber-900/20 border border-amber-500/30 p-4 rounded-xl mb-6 mx-1">
                 <div className="flex items-start gap-3">
                     <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                     <div>
                         <h3 className="text-sm font-bold text-amber-200 mb-1">Configuração Necessária</h3>
                         <p className="text-xs text-amber-100/80 mb-2 leading-relaxed">
                             Para ver agendas públicas (como Feriados) sem login, você precisa adicionar uma <strong>Google API Key</strong>.
                         </p>
                         <button onClick={() => setIsConfigModalOpen(true)} className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded font-bold">
                             Adicionar Key
                         </button>
                     </div>
                 </div>
             </div>
        )}

        {/* Mensagem de ajuda caso não apareça nada, mesmo com API Key */}
        {!hasEvents && !isLoadingCalendar && (hasApiKey || googleToken) && (
             <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl mb-6 mx-1 text-center">
                 <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                 <p className="text-sm font-bold text-slate-300">Nenhum evento encontrado</p>
                 <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-xs mx-auto">
                    Se você adicionou agendas (ex: Gmail pessoal), elas precisam ser <strong>Públicas</strong> ou você deve fazer <strong>Login com Google</strong> na aba E-mail.
                 </p>
                 {!googleToken && (
                     <button onClick={() => handleNavigation(ViewState.GOOGLE)} className="mt-3 text-xs bg-blue-600/20 text-blue-300 px-3 py-1.5 rounded-full font-bold border border-blue-600/30">
                        Ir para Login
                     </button>
                 )}
             </div>
        )}

        <div className="space-y-6">
           {Object.keys(groupedEvents).map(dateKey => {
             const firstEvent = groupedEvents[dateKey][0];
             const dateObj = firstEvent.start;
             
             const weekday = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
             const formattedDate = dateObj.toLocaleDateString('pt-BR');
             const displayDate = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${formattedDate}`;

             const isToday = dateKey === todayStr;
             return (
               <div key={dateKey} className={`rounded-xl ${isToday ? 'bg-blue-900/10 border border-blue-500/30 p-2 -mx-2' : ''}`}>
                  <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 sticky top-0 py-2 backdrop-blur-sm z-10 flex items-center gap-2
                      ${isToday ? 'text-blue-300' : 'text-slate-500 bg-brand-900/90'}`}>
                    {displayDate}
                    {isToday && <span className="bg-blue-500 text-white text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-1"><Star className="w-2.5 h-2.5 fill-current"/> HOJE</span>}
                  </h3>
                  <div className="space-y-3">
                    {groupedEvents[dateKey].map(event => (
                      <CalendarEventItem key={event.id + event.start.getTime()} event={event} />
                    ))}
                  </div>
               </div>
             );
           })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-brand-900 text-slate-200 font-sans selection:bg-brand-secondary/30">
      
      <header className="fixed top-0 w-full z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 pt-safe-area shadow-sm">
         <div className="flex justify-between items-center px-4 h-16 max-w-md mx-auto">
             <button onClick={() => setIsSideMenuOpen(true)} className="p-2 -ml-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors">
                <Menu className="w-6 h-6" />
             </button>

             <div className="flex items-center justify-center cursor-pointer" onClick={() => setCurrentView(ViewState.DASHBOARD)}>
                 <img src="https://tidas.com.br/wp-content/uploads/2025/08/logo_tidas_rodan2.svg" alt="Tidas" className="h-[1.6rem] w-auto drop-shadow-md" />
             </div>

             <button onClick={() => setIsConfigModalOpen(true)} className="p-2 -mr-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors">
                <Settings className="w-6 h-6" />
             </button>
         </div>
      </header>

      <main 
        className="max-w-md mx-auto min-h-screen relative pt-[calc(4rem+env(safe-area-inset-top,20px))] px-4 pb-safe-area"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {currentView === ViewState.DASHBOARD && renderDashboard()}
        {currentView === ViewState.WEBSITES && renderWebsiteHub()}
        {currentView === ViewState.GOOGLE && renderGoogleHub()}
        {currentView === ViewState.CALENDAR && renderCalendarHub()}
        {currentView === ViewState.NEWS && renderNewsHub()}
        {currentView === ViewState.TRELLO && (
            <>
              {!trelloKey || !trelloToken ? (
                  <div className="pb-32 animate-fade-in px-4 pt-4">
                    <h2 className="text-xl font-bold text-slate-100 mb-4">Configurar Trello</h2>
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-4">
                        <input type="text" value={trelloKey} onChange={e => setTrelloKey(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm" placeholder="API Key" />
                        <a href="https://trello.com/app-key" target="_blank" className="text-xs text-blue-400 flex items-center gap-1"><ExternalLink className="w-3 h-3"/> Obter Key</a>
                        <input type="text" value={trelloToken} onChange={e => setTrelloToken(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm" placeholder="Token" disabled={!trelloKey} />
                        {trelloKey && <a href={`https://trello.com/1/authorize?expiration=never&scope=read,write,account&response_type=token&name=Tidas&key=${trelloKey}`} target="_blank" className="text-xs text-emerald-400 flex items-center gap-1"><ExternalLink className="w-3 h-3"/> Gerar Token</a>}
                        <button onClick={loadTrelloBoards} disabled={!trelloKey || !trelloToken} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl mt-2">Conectar</button>
                    </div>
                  </div>
              ) : !trelloBoardId || isSelectingLists ? (
                  <div className="pb-32 animate-fade-in px-4 pt-4">
                      <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold text-slate-100">Configurar Listas</h2><button onClick={() => setTrelloKey('')} className="text-xs text-rose-400">Sair</button></div>
                      {!trelloBoardId && availableBoards.map(b => <button key={b.id} onClick={() => {setTrelloBoardId(b.id); loadTrelloLists(b.id);}} className="w-full text-left p-3 bg-slate-800 mb-2 rounded-lg">{b.name}</button>)}
                      {trelloBoardId && (
                          <>
                            <div className="max-h-[60vh] overflow-y-auto mb-4">
                                {availableLists.map(l => (
                                    <button key={l.id} onClick={() => setTrelloListIds(prev => prev.includes(l.id) ? prev.filter(id => id !== l.id) : [...prev, l.id])} className={`w-full flex justify-between p-3 mb-2 rounded-lg border ${trelloListIds.includes(l.id) ? 'bg-blue-500/20 border-blue-500' : 'bg-slate-800 border-slate-700'}`}>
                                        <span>{l.name}</span>{trelloListIds.includes(l.id) && <CheckSquare className="w-4 h-4 text-blue-400" />}
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => {setIsSelectingLists(false); fetchTrelloCards();}} className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl">Salvar</button>
                          </>
                      )}
                  </div>
              ) : (
                  <div className="pb-32 animate-fade-in pt-4">
                      <div className="flex justify-between items-center mb-4 px-1">
                          <div className="flex items-center gap-2"><h2 className="text-xl font-bold text-slate-100">Trello</h2><span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded-full">{trelloCards.length}</span></div>
                          <div className="flex gap-2"><button onClick={() => setIsSelectingLists(true)} className="p-2 text-slate-400"><Settings className="w-5 h-5" /></button><button onClick={fetchTrelloCards} className={`p-2 bg-blue-500/20 text-blue-400 rounded-full ${isLoadingTrello ? 'animate-spin' : ''}`}><RefreshCw className="w-4 h-4" /></button></div>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-4 mb-2 px-1 scrollbar-hide">
                          <button onClick={() => setActiveTrelloFilter('ALL')} className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold ${activeTrelloFilter === 'ALL' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>Todos</button>
                          {trelloListIds.map(id => <button key={id} onClick={() => setActiveTrelloFilter(id)} className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold ${activeTrelloFilter === id ? 'bg-slate-200 text-slate-900' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>{availableLists.find(l => l.id === id)?.name || 'Lista'}</button>)}
                      </div>
                      {trelloCards.filter(c => activeTrelloFilter === 'ALL' || c.listId === activeTrelloFilter).map((c, i) => <TrelloCardItem key={c.id} card={c} listColorName={TRELLO_COLORS[trelloListIds.indexOf(c.listId) % TRELLO_COLORS.length]} />)}
                  </div>
              )}
            </>
        )}
      </main>
      
      <SideMenu 
        isOpen={isSideMenuOpen}
        onClose={() => setIsSideMenuOpen(false)}
        onNavigate={handleNavigation}
        onGenerateInsight={handleGenerateInsight}
        badges={{
          forms: forms.filter(f => !f.isRead).length,
          emails: emails.filter(e => e.isUnread).length,
          trello: trelloBadgeCount
        }}
      />

      <ConfigModal 
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        preferences={dashPrefs}
        onTogglePreference={(key) => setDashPrefs(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))}
        onReorderDashboard={handleReorderDashboard}
        onUpdateApiKey={handleUpdateApiKey}
        notificationsEnabled={notifPermission === 'granted'}
        onToggleNotifications={requestNotificationPermission}
        locationEnabled={!weatherPermissionDenied}
        onToggleLocation={loadWeather}
        calendarIds={calendarIds}
        onAddCalendar={handleAddCalendar}
        onRemoveCalendar={handleRemoveCalendar}
        onAddNewsTopic={handleAddNewsTopic}
        onRemoveNewsTopic={handleRemoveNewsTopic}
      />

      <TabNav 
        currentView={currentView}
        onChangeView={setCurrentView}
        badges={{
           sites: sites.some(s => s.status === SiteStatus.OFFLINE),
           forms: forms.filter(f => !f.isRead).length,
           google: emails.filter(e => e.isUnread).length,
           trello: trelloBadgeCount
        }}
      />

      {selectedFormId && (
        <FormDetailsModal form={forms.find(f => f.id === selectedFormId)!} siteName={sites.find(s => s.id === forms.find(f => f.id === selectedFormId)?.siteId)?.name || 'Site'} onClose={() => setSelectedFormId(null)} />
      )}

      {selectedEmailId && (
        <EmailDetailsModal email={emails.find(e => e.id === selectedEmailId)!} onClose={() => setSelectedEmailId(null)} />
      )}

    </div>
  );
};

export default App;

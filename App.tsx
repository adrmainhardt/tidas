
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_SITES, MOCK_FORMS, GOOGLE_CLIENT_ID } from './constants';
import { SiteConfig, SiteStatus, ViewState, FormSubmission, EmailMessage, TrelloBoard, TrelloList, TrelloCard, CalendarEvent, WeatherData } from './types';
import MonitorCard from './components/MonitorCard';
import InboxItem from './components/InboxItem';
import EmailItem from './components/EmailItem';
import TabNav from './components/TabNav';
import FormDetailsModal from './components/FormDetailsModal';
import EmailDetailsModal from './components/EmailDetailsModal';
import TrelloCardItem from './components/TrelloCardItem';
import CalendarEventItem from './components/CalendarEventItem';
import WeatherWidget from './components/WeatherWidget';
import { fetchFormsFromWP, fetchSiteStats } from './services/wpService';
import { fetchGmailMessages } from './services/gmailService';
import { fetchCalendarEvents } from './services/calendarService';
import { fetchBoards, fetchLists, fetchCardsFromList } from './services/trelloService';
import { generateDashboardInsight } from './services/geminiService';
import { fetchWeather, fetchLocationName } from './services/weatherService';
import { Activity, RefreshCw, AlertTriangle, WifiOff, Trash2, BarChart3, Mail, LogIn, LogOut, Copy, Info, Check, Trello, Settings, CheckSquare, ExternalLink, HelpCircle, Bell, CalendarDays, Calendar, Sparkles, X, Globe, MessageSquareText, Save, Send, User, ChevronDown, ChevronUp, AlertOctagon } from 'lucide-react';

// Declaração global para o Google Identity Services
declare global {
  interface Window {
    google?: any;
  }
}

// Hook para persistência com segurança extra contra falhas de localStorage
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

// Função simples para feedback sonoro (Bip suave)
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

// Função auxiliar para comparar datas (ignora hora)
const isSameDay = (d1: Date, d2: Date) => {
  return d1.getDate() === d2.getDate() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getFullYear() === d2.getFullYear();
};

const isTomorrow = (d1: Date, now: Date) => {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isSameDay(d1, tomorrow);
};

// Cores para as listas do Trello (cíclico)
const TRELLO_COLORS = ['blue', 'amber', 'emerald', 'purple', 'rose', 'cyan', 'indigo', 'lime'];

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [sites, setSites] = useState<SiteConfig[]>(DEFAULT_SITES);
  const [forms, setForms] = useState<FormSubmission[]>(MOCK_FORMS);
  const [isLoadingForms, setIsLoadingForms] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  
  // Notification Permission State
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');

  // Weather State
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weatherPermissionDenied, setWeatherPermissionDenied] = useState(false);

  // Google Services States (Gmail + Calendar)
  const [googleToken, setGoogleToken] = usePersistedState<string | null>('monitor_google_token', null);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [authError, setAuthError] = useState<boolean>(false); 
  const [authErrorType, setAuthErrorType] = useState<string | null>(null);
  const [apiNotEnabled, setApiNotEnabled] = useState<boolean>(false);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  
  // Google SubTabs (Mail, Calendar)
  const [googleSubTab, setGoogleSubTab] = useState<'mail' | 'calendar'>('mail');
  const tokenClient = useRef<any>(null);

  // Website Hub States (Status + Forms)
  const [websiteSubTab, setWebsiteSubTab] = useState<'status' | 'forms'>('status');

  // Insight AI States
  const [insightResult, setInsightResult] = useState<string | null>(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);
  const [showInsightModal, setShowInsightModal] = useState(false);

  // Trello States
  const [trelloKey, setTrelloKey] = usePersistedState<string>('monitor_trello_key', '');
  const [trelloToken, setTrelloToken] = usePersistedState<string>('monitor_trello_token', '');
  const [trelloBoardId, setTrelloBoardId] = usePersistedState<string>('monitor_trello_board', '');
  const [trelloListIds, setTrelloListIds] = usePersistedState<string[]>('monitor_trello_lists', []);
  const [trelloLastView, setTrelloLastView] = usePersistedState<string>('monitor_trello_last_view', new Date(0).toISOString());
  const [trelloBadgeCount, setTrelloBadgeCount] = useState(0);
  const [trelloCards, setTrelloCards] = useState<TrelloCard[]>([]);
  const [availableBoards, setAvailableBoards] = useState<TrelloBoard[]>([]);
  const [availableLists, setAvailableLists] = useState<TrelloList[]>([]);
  const [isLoadingTrello, setIsLoadingTrello] = useState(false);
  const [isSelectingLists, setIsSelectingLists] = useState(false); 
  const [activeTrelloFilter, setActiveTrelloFilter] = useState<string>('ALL');

  // Persistência de estados de leitura e exclusão
  const [readFormIds, setReadFormIds] = usePersistedState<string[]>('monitor_read_forms_v2', []);
  const [deletedFormIds, setDeletedFormIds] = usePersistedState<string[]>('monitor_deleted_forms_v2', []);

  // Refs
  const deletedIdsRef = useRef<string[]>([]);
  const readIdsRef = useRef<string[]>([]);
  const sitesRef = useRef<SiteConfig[]>(DEFAULT_SITES);
  const prevEmailIdsRef = useRef<string[]>([]);
  const prevTrelloCardIdsRef = useRef<string[]>([]);

  useEffect(() => { deletedIdsRef.current = deletedFormIds || []; }, [deletedFormIds]);
  useEffect(() => { readIdsRef.current = readFormIds || []; }, [readFormIds]);
  useEffect(() => { sitesRef.current = sites; }, [sites]);

  useEffect(() => {
    if (trelloListIds.length === 0) setIsSelectingLists(true);
  }, [trelloListIds.length]);

  useEffect(() => {
    if (currentView === ViewState.TRELLO) {
      setTrelloLastView(new Date().toISOString());
      setTrelloBadgeCount(0);
    }
  }, [currentView]);

  // Inicializa Google Identity Services
  useEffect(() => {
    const initGoogleAuth = () => {
      if (window.google && window.google.accounts && !tokenClient.current) {
        try {
          tokenClient.current = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            // Scopes para Gmail e Calendar juntos
            scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly',
            prompt: 'consent', 
            callback: (response: any) => {
              if (response.access_token) {
                setGoogleToken(response.access_token);
                setAuthError(false);
                setAuthErrorType(null);
                setApiNotEnabled(false);
                fetchGoogleData(response.access_token);
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

  // Notificações
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  // Weather Logic
  const loadWeather = useCallback(() => {
    if (!('geolocation' in navigator)) return;
    
    setLoadingWeather(true);
    setWeatherPermissionDenied(false);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const weatherData = await fetchWeather(latitude, longitude);
        const locationName = await fetchLocationName(latitude, longitude);
        
        if (weatherData) {
          setWeather({ ...weatherData, locationName });
        }
        setLoadingWeather(false);
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
    loadWeather();
  }, [loadWeather]);

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
    playNotificationSound();
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
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

  // Site Checker
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

  // Forms Sync
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

  // Google Data Fetch (Gmail + Calendar)
  const fetchGoogleData = async (tokenOverride?: string) => {
    const token = tokenOverride || googleToken;
    if (!token) return;
    
    setIsLoadingGoogle(true);
    try {
      // Fetch Gmail
      const messages = await fetchGmailMessages(token, 80);
      setApiNotEnabled(false);

      const currentUnread = messages.filter(m => m.isUnread);
      const newUnread = currentUnread.filter(m => !prevEmailIdsRef.current.includes(m.id));

      if (prevEmailIdsRef.current.length > 0 && newUnread.length > 0) {
         sendNotification('Novo E-mail', `${newUnread.length} novo(s) e-mail(s).`);
      }
      prevEmailIdsRef.current = messages.map(m => m.id);
      setEmails(messages);

      // Fetch Calendar
      const calendarEvents = await fetchCalendarEvents(token);
      setEvents(calendarEvents);

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
    setEvents([]);
    setAuthError(false);
    if (window.google && googleToken) {
      try { window.google.accounts.oauth2.revoke(googleToken, () => {}); } catch (e) {}
    }
  };

  // Trello Logic
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

  // Insight Generation
  const handleGenerateInsight = async () => {
    setIsLoadingInsight(true);
    setShowInsightModal(true);
    setInsightResult(null); // Limpa resultado anterior
    
    const now = new Date();
    const todayEvents = events.filter(e => isSameDay(e.start, now));
    
    const context = {
        sites: sites.map(s => `${s.name}: ${s.status}`),
        forms: forms.filter(f => !f.isRead).slice(0, 3).map(f => `${f.senderName}: ${f.message.substring(0, 50)}...`),
        emails: emails.filter(e => e.isUnread).slice(0, 5).map(e => e.subject),
        events: todayEvents.map(e => `${e.title} às ${e.start.getHours()}:${e.start.getMinutes()}`),
        trello: trelloBadgeCount
    };

    const result = await generateDashboardInsight(context);
    setInsightResult(result);
    setIsLoadingInsight(false);
  };

  // Init Loop
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
       if (isMounted) {
         await checkAllSites();
         await syncForms();
         if (googleToken) fetchGoogleData(googleToken);
         
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
        if (googleToken) fetchGoogleData(googleToken);
        if (trelloKey && trelloToken && trelloListIds.length > 0) fetchTrelloCards();
      }
    }, 10000);

    return () => { isMounted = false; clearInterval(intervalId); };
  }, [googleToken]); 

  // Handlers
  const handleMarkAsRead = (id: string) => {
    if (!readFormIds.includes(id)) {
      setReadFormIds(prev => [...prev, id]);
      setForms(prev => prev.map(f => f.id === id ? { ...f, isRead: true } : f).sort((a, b) => a.isRead ? 1 : -1));
    }
  };

  const handleDismissForm = (id: string) => {
    setDeletedFormIds(prev => [...prev, id]);
    setForms(prev => prev.filter(f => f.id !== id));
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

  // Views Renderers
  const renderDashboard = () => {
    const now = new Date();
    const todayEventsCount = events.filter(e => isSameDay(e.start, now)).length;

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex justify-center items-center mb-2">
           <img src="https://tidas.com.br/wp-content/uploads/2025/08/logo_tidas_rodan2.svg" alt="Tidas" onClick={() => setCurrentView(ViewState.DASHBOARD)} className="h-[1.6rem] w-auto drop-shadow-md cursor-pointer" />
        </div>

        {/* INSIGHT BUTTON */}
        <button 
            onClick={handleGenerateInsight}
            className="w-full relative overflow-hidden group bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-xl shadow-lg shadow-purple-900/20 flex items-center justify-between border border-white/10"
        >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-3 z-10">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <Sparkles className="w-5 h-5 text-yellow-300" />
                </div>
                <div className="text-left">
                    <h3 className="font-bold text-sm leading-tight">Insight do Dia</h3>
                    <p className="text-[10px] text-white/80">Resumo inteligente dos seus dados</p>
                </div>
            </div>
            <RefreshCw className="w-4 h-4 text-white/50" />
        </button>
        
        {notifPermission === 'default' && (
           <button onClick={requestNotificationPermission} className="w-full bg-blue-600/20 text-blue-300 text-xs font-bold p-3 rounded-xl border border-blue-600/30 flex items-center justify-center gap-2">
              <Bell className="w-4 h-4" /> ATIVAR NOTIFICAÇÕES
           </button>
        )}

        {/* Grid de Serviços */}
        <div className="grid grid-cols-2 gap-4">
          {/* Forms & Sites Combined Entry */}
          <div onClick={() => setCurrentView(ViewState.WEBSITES)} className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-sm cursor-pointer active:scale-95 transition-all">
            <div className="flex items-center gap-2 mb-2 text-brand-400"><Globe className="w-4 h-4" /><span className="text-xs font-semibold">SITES & FORMS</span></div>
            <div className="flex justify-between items-end">
               <div className="text-2xl font-bold text-slate-100">{forms.filter(f => !f.isRead).length}</div>
               {sites.some(s => s.status === SiteStatus.OFFLINE) && <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />}
            </div>
          </div>
          <div onClick={() => setCurrentView(ViewState.TRELLO)} className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-sm cursor-pointer active:scale-95 transition-all">
             <div className="flex items-center gap-2 mb-2 text-blue-400"><Trello className="w-4 h-4" /><span className="text-xs font-semibold">TRELLO</span></div>
             <div className="text-2xl font-bold text-slate-100">{trelloBadgeCount > 0 ? trelloBadgeCount : <Check className="w-6 h-6 text-emerald-500" />}</div>
          </div>
          {/* Google Card Unificado */}
          <div onClick={() => setCurrentView(ViewState.GOOGLE)} className="col-span-2 bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-sm cursor-pointer active:scale-95 transition-all flex justify-between items-center">
                <div className="flex flex-col gap-1">
                     <div className="flex items-center gap-2 text-red-400"><Mail className="w-4 h-4" /><span className="text-xs font-semibold">GOOGLE</span></div>
                     <div className="text-sm text-slate-400">
                         {googleToken ? (
                             <>
                                 <span className="font-bold text-slate-200">{emails.filter(e => e.isUnread).length}</span> emails • <span className="font-bold text-slate-200">{todayEventsCount}</span> eventos hoje
                             </>
                         ) : 'Conectar'}
                     </div>
                </div>
                {!googleToken && <LogIn className="w-5 h-5 text-slate-500" />}
          </div>
        </div>

        {/* WIDGET DE CLIMA (Movido para baixo da Grid Google) */}
        <WeatherWidget 
          weather={weather} 
          loading={loadingWeather} 
          permissionDenied={weatherPermissionDenied}
          onRequestPermission={loadWeather}
        />

        {/* Lista de Sites na Home (Minimal) */}
        <div className="pb-20">
           <div className="flex justify-between items-center mb-4 px-1">
              <h3 className="text-lg font-bold text-slate-100">Status dos Sites</h3>
              <button onClick={checkAllSites} className="p-2 bg-brand-secondary/20 text-brand-secondary rounded-full hover:bg-brand-secondary/30"><RefreshCw className="w-4 h-4" /></button>
           </div>
           {sites.map(site => <MonitorCard key={site.id} site={site} onRefresh={handleRefreshSite} minimal={true} />)}
        </div>
      </div>
    );
  };

  const renderWebsiteHub = () => {
    const unreadForms = forms.filter(f => !f.isRead).length;
    const offlineSites = sites.filter(s => s.status === SiteStatus.OFFLINE).length;

    return (
        <div className="pb-20 animate-fade-in flex flex-col h-full">
             {/* Header with Toggle */}
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

             {/* Content Area */}
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
    const unreadEmails = emails.filter(e => e.isUnread).length;
    
    const now = new Date();
    
    // Agrupamento de Eventos
    const todayEvents = events.filter(e => isSameDay(e.start, now));
    const tomorrowEvents = events.filter(e => isTomorrow(e.start, now));
    const monthEvents = events.filter(e => !isSameDay(e.start, now) && !isTomorrow(e.start, now));

    return (
        <div className="pb-20 animate-fade-in flex flex-col h-full">
             {/* Header with Toggle */}
             <div className="flex flex-col mb-4 px-1">
                 <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-100">Workspace</h2>
                    {googleToken && (
                      <div className="flex gap-2">
                          <button onClick={handleDisconnectGoogle} className="p-2 text-slate-500 hover:text-rose-400"><LogOut className="w-5 h-5" /></button>
                          <button onClick={() => fetchGoogleData(googleToken)} className={`p-2 bg-blue-500/20 text-blue-400 rounded-full ${isLoadingGoogle ? 'animate-spin' : ''}`}><RefreshCw className="w-4 h-4" /></button>
                      </div>
                    )}
                 </div>
                 
                 <div className="bg-slate-800 p-1 rounded-xl flex gap-1">
                     <button 
                        onClick={() => setGoogleSubTab('mail')} 
                        className={`flex-1 py-2 rounded-lg text-xs font-bold flex justify-center items-center gap-2 transition-colors ${googleSubTab === 'mail' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'}`}
                     >
                        <Mail className="w-3.5 h-3.5" /> E-mails
                        {unreadEmails > 0 && <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{unreadEmails}</span>}
                     </button>
                     <button 
                        onClick={() => setGoogleSubTab('calendar')} 
                        className={`flex-1 py-2 rounded-lg text-xs font-bold flex justify-center items-center gap-2 transition-colors ${googleSubTab === 'calendar' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'}`}
                     >
                        <CalendarDays className="w-3.5 h-3.5" /> Agenda
                        {todayEvents.length > 0 && <span className="bg-blue-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{todayEvents.length}</span>}
                     </button>
                 </div>
             </div>

             {/* Content Area */}
             {googleSubTab === 'mail' && (
                !googleToken ? renderGoogleLogin('Gmail e Agenda') : (
                  <div>
                      {emails.length === 0 && !isLoadingGoogle && <div className="text-center py-10 text-slate-500"><Check className="w-8 h-8 text-emerald-500/50 mx-auto mb-2"/><p>Caixa limpa!</p></div>}
                      {emails.map(email => <EmailItem key={email.id} email={email} onSelect={() => {setSelectedEmailId(email.id); setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isUnread: false } : e));}} onDismiss={() => setEmails(prev => prev.filter(e => e.id !== email.id))} />)}
                  </div>
                )
             )}

             {googleSubTab === 'calendar' && (
                !googleToken ? renderGoogleLogin('Gmail e Agenda') : (
                  <div>
                       {events.length === 0 && !isLoadingGoogle && (
                           <div className="mb-6 p-4 bg-slate-800/50 rounded-xl text-center border border-slate-700/50">
                               <p className="text-sm text-slate-400">Nenhum evento encontrado para este mês.</p>
                           </div>
                       )}

                       {/* Eventos de Hoje */}
                       {todayEvents.length > 0 && (
                         <div className="mb-6">
                           <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500"></div> Hoje
                           </h3>
                           {todayEvents.map(evt => <CalendarEventItem key={evt.id} event={evt} />)}
                         </div>
                       )}

                       {/* Eventos de Amanhã */}
                       {tomorrowEvents.length > 0 && (
                         <div className="mb-6">
                           <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-indigo-500"></div> Amanhã
                           </h3>
                           {tomorrowEvents.map(evt => <CalendarEventItem key={evt.id} event={evt} />)}
                         </div>
                       )}

                       {/* Próximos Eventos (Mês) */}
                       {monthEvents.length > 0 && (
                         <div className="mb-6">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1 mt-4 border-t border-slate-700/50 pt-4">
                               Este Mês
                            </h3>
                            {monthEvents.map(evt => <CalendarEventItem key={evt.id} event={evt} />)}
                         </div>
                       )}
                  </div>
                )
             )}
        </div>
    );
  };

  return (
    <div className="min-h-screen bg-brand-900 text-slate-200 font-sans selection:bg-brand-secondary/30">
      <main className="max-w-md mx-auto min-h-screen relative pt-safe-area px-4 pb-safe-area mt-4">
        {currentView === ViewState.DASHBOARD && renderDashboard()}
        {currentView === ViewState.WEBSITES && renderWebsiteHub()}
        {currentView === ViewState.TRELLO && (
            <>
              {!trelloKey || !trelloToken ? (
                  <div className="pb-20 animate-fade-in px-4">
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
                  <div className="pb-20 animate-fade-in px-4">
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
                  <div className="pb-20 animate-fade-in">
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
        {/* NOVA VIEW GOOGLE */}
        {currentView === ViewState.GOOGLE && renderGoogleHub()}
      </main>
      
      <TabNav 
        currentView={currentView} 
        onChangeView={setCurrentView}
        badges={{
          sites: sites.some(s => s.status === SiteStatus.OFFLINE),
          forms: forms.filter(f => !f.isRead).length,
          google: emails.filter(e => e.isUnread).length + events.filter(e => isSameDay(e.start, new Date())).length,
          trello: trelloBadgeCount
        }}
      />

      {selectedFormId && (
        <FormDetailsModal form={forms.find(f => f.id === selectedFormId)!} siteName={sites.find(s => s.id === forms.find(f => f.id === selectedFormId)?.siteId)?.name || 'Site'} onClose={() => setSelectedFormId(null)} />
      )}

      {selectedEmailId && (
        <EmailDetailsModal email={emails.find(e => e.id === selectedEmailId)!} onClose={() => setSelectedEmailId(null)} />
      )}

      {/* MODAL DE INSIGHT AI */}
      {showInsightModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-fade-in">
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setShowInsightModal(false)}></div>
              <div className="relative bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl border border-slate-700 overflow-hidden min-h-[300px] flex flex-col">
                  <div className="p-5 border-b border-slate-700 bg-gradient-to-r from-indigo-900 to-slate-800 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-yellow-300" />
                          <h3 className="font-bold text-lg text-slate-100">Insight do Dia</h3>
                      </div>
                      <button onClick={() => setShowInsightModal(false)} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
                  </div>
                  <div className="p-6 flex-1 flex items-center justify-center">
                      {isLoadingInsight ? (
                          <div className="text-center space-y-4">
                              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                              <p className="text-slate-400 text-sm animate-pulse">Analisando seus dados...</p>
                          </div>
                      ) : (
                          <div className="prose prose-invert prose-sm w-full">
                             {/* Se falhar, mostra mensagem amigável, senão o resultado */}
                             {insightResult ? (
                                <div className="whitespace-pre-wrap text-slate-200 leading-relaxed">{insightResult}</div>
                             ) : (
                                <p className="text-rose-400 text-center">Ocorreu um erro ao gerar o insight. Tente novamente.</p>
                             )}
                          </div>
                      )}
                  </div>
                  {!isLoadingInsight && (
                      <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex justify-end">
                          <button onClick={() => setShowInsightModal(false)} className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-bold rounded-lg">Fechar</button>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

export default App;


import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_SITES, MOCK_FORMS, GOOGLE_CLIENT_ID, TRELLO_API_KEY, TRELLO_TOKEN } from './constants';
import { SiteConfig, SiteStatus, ViewState, FormSubmission, EmailMessage, TrelloBoard, TrelloList, TrelloCard, CalendarEvent, WeatherData, DashboardPrefs } from './types';
import MonitorCard from './components/MonitorCard';
import InboxItem from './components/InboxItem';
import EmailItem from './components/EmailItem';
import FormDetailsModal from './components/FormDetailsModal';
import EmailDetailsModal from './components/EmailDetailsModal';
import TrelloCardItem from './components/TrelloCardItem';
import CalendarEventItem from './components/CalendarEventItem';
import WeatherWidget from './components/WeatherWidget';
import SideMenu from './components/SideMenu'; 
import ConfigModal from './components/ConfigModal'; 
import { fetchFormsFromWP, fetchSiteStats } from './services/wpService';
import { fetchGmailMessages } from './services/gmailService';
import { fetchCalendarEvents } from './services/calendarService';
import { fetchBoards, fetchLists, fetchCardsFromList } from './services/trelloService';
import { generateDashboardInsight } from './services/geminiService';
import { fetchWeather, fetchLocationName } from './services/weatherService';
import { Activity, RefreshCw, AlertTriangle, WifiOff, Trash2, BarChart3, Mail, LogIn, LogOut, Copy, Info, Check, Trello, Settings, CheckSquare, ExternalLink, HelpCircle, Bell, CalendarDays, Calendar, Sparkles, X, Globe, MessageSquareText, Save, Send, User, ChevronDown, ChevronUp, AlertOctagon, Menu } from 'lucide-react';

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

  const [googleToken, setGoogleToken] = usePersistedState<string | null>('monitor_google_token_v2', null);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [authError, setAuthError] = useState<boolean>(false); 
  const [authErrorType, setAuthErrorType] = useState<string | null>(null);
  const [apiNotEnabled, setApiNotEnabled] = useState<boolean>(false);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  
  const [googleSubTab, setGoogleSubTab] = useState<'mail' | 'calendar'>('mail');
  const tokenClient = useRef<any>(null);

  const [websiteSubTab, setWebsiteSubTab] = useState<'status' | 'forms'>('status');

  const [insightResult, setInsightResult] = useState<string | null>(null);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);

  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const [dashPrefs, setDashPrefs] = usePersistedState<DashboardPrefs>('dashboard_prefs_v4', {
      showSites: true,
      showTrello: true,
      showGoogle: true,
      showWeather: true,
      calendarMode: 'api',
      calendarEmbedUrl: ''
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

  useEffect(() => {
    const initGoogleAuth = () => {
      if (window.google && window.google.accounts && !tokenClient.current) {
        try {
          tokenClient.current = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
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
    if (dashPrefs.showWeather) {
      loadWeather();
    }
  }, [loadWeather, dashPrefs.showWeather]);

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
    const token = tokenOverride || googleToken;
    if (!token) return;
    
    setIsLoadingGoogle(true);
    try {
      const messages = await fetchGmailMessages(token, 80);
      setApiNotEnabled(false);

      const currentUnread = messages.filter(m => m.isUnread);
      const newUnread = currentUnread.filter(m => !prevEmailIdsRef.current.includes(m.id));

      if (prevEmailIdsRef.current.length > 0 && newUnread.length > 0) {
         sendNotification('Novo E-mail', `${newUnread.length} novo(s) e-mail(s).`);
      }
      prevEmailIdsRef.current = messages.map(m => m.id);
      setEmails(messages);

      // Só busca eventos se estiver no modo API
      if (dashPrefs.calendarMode === 'api') {
          const calendarEvents = await fetchCalendarEvents(token);
          setEvents(calendarEvents);
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
    setEvents([]);
    setAuthError(false);
    if (window.google && googleToken) {
      try { window.google.accounts.oauth2.revoke(googleToken, () => {}); } catch (e) {}
    }
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
    
    const now = new Date();
    const todayEvents = events.filter(e => isSameDay(e.start, now));
    
    const context = {
        sites: sites.map(s => `${s.name}: ${s.status}`),
        forms: forms.filter(f => !f.isRead).slice(0, 3).map(f => `${f.senderName}: ${f.message.substring(0, 50)}...`),
        emails: emails.filter(e => e.isUnread).slice(0, 5).map(e => e.subject),
        events: todayEvents.map(e => `${e.title} às ${e.start.getHours()}:${e.start.getMinutes()}`),
        trello: trelloBadgeCount
    };

    try {
        const result = await generateDashboardInsight(context);
        setInsightResult(result);
    } catch (error: any) {
        console.error("Falha ao gerar insight na UI:", error);
        setInsightError(error.message || "Erro desconhecido.");
    } finally {
        setIsLoadingInsight(false);
    }
  };

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
    if (view === ViewState.GOOGLE && subTab) setGoogleSubTab(subTab as any);
  };

  const renderDashboard = () => {
    const now = new Date();
    const todayEventsCount = events.filter(e => isSameDay(e.start, now)).length;

    return (
      <div className="space-y-6 animate-fade-in pt-4">
        
        {/* Insight do Dia Widget */}
        <div 
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
                    <p className="text-xs text-rose-300 font-medium">
                        {insightError}
                    </p>
                ) : insightResult ? (
                    <p className="text-xs text-slate-300 leading-relaxed animate-fade-in">
                        {insightResult}
                    </p>
                ) : (
                    <p className="text-xs text-slate-400 italic">
                        Toque aqui para gerar um resumo...
                    </p>
                )}
            </div>
        </div>

        {notifPermission === 'default' && (
           <button onClick={requestNotificationPermission} className="w-full bg-blue-600/20 text-blue-300 text-xs font-bold p-3 rounded-xl border border-blue-600/30 flex items-center justify-center gap-2">
              <Bell className="w-4 h-4" /> ATIVAR NOTIFICAÇÕES
           </button>
        )}

        <div className="grid grid-cols-2 gap-4">
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
            <>
              <div onClick={() => handleNavigation(ViewState.GOOGLE, 'mail')} className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-sm cursor-pointer active:scale-95 transition-all">
                <div className="flex items-center gap-2 mb-2 text-red-400"><Mail className="w-4 h-4" /><span className="text-xs font-semibold">E-MAIL</span></div>
                <div className="text-2xl font-bold text-slate-100">
                    {googleToken ? emails.filter(e => e.isUnread).length : <LogIn className="w-5 h-5 text-slate-500" />}
                </div>
              </div>

              <div onClick={() => handleNavigation(ViewState.GOOGLE, 'calendar')} className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-sm cursor-pointer active:scale-95 transition-all">
                <div className="flex items-center gap-2 mb-2 text-indigo-400"><CalendarDays className="w-4 h-4" /><span className="text-xs font-semibold">AGENDA</span></div>
                <div className="text-2xl font-bold text-slate-100">
                    {dashPrefs.calendarMode === 'embed' ? (
                        <ExternalLink className="w-5 h-5 text-slate-300" />
                    ) : (
                        googleToken ? todayEventsCount : <LogIn className="w-5 h-5 text-slate-500" />
                    )}
                </div>
              </div>
            </>
          )}
        </div>

        {dashPrefs.showSites && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4 px-1">
                <h3 className="text-lg font-bold text-slate-100">Status dos Sites</h3>
                <button onClick={checkAllSites} className="p-2 bg-brand-secondary/20 text-brand-secondary rounded-full hover:bg-brand-secondary/30"><RefreshCw className="w-4 h-4" /></button>
            </div>
            {sites.map(site => <MonitorCard key={site.id} site={site} onRefresh={handleRefreshSite} minimal={true} />)}
          </div>
        )}

        {dashPrefs.showWeather && (
          <div className="pb-10">
              <WeatherWidget 
                weather={weather} 
                loading={loadingWeather} 
                permissionDenied={weatherPermissionDenied}
                onRequestPermission={loadWeather}
              />
          </div>
        )}
        
        {!dashPrefs.showSites && !dashPrefs.showTrello && !dashPrefs.showGoogle && !dashPrefs.showWeather && (
            <div className="text-center py-20 text-slate-500">
                <p>Personalize sua tela inicial no menu de configurações.</p>
            </div>
        )}
      </div>
    );
  };

  const renderWebsiteHub = () => {
    const unreadForms = forms.filter(f => !f.isRead).length;
    const offlineSites = sites.filter(s => s.status === SiteStatus.OFFLINE).length;

    return (
        <div className="pb-20 animate-fade-in flex flex-col h-full pt-4">
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
    const unreadEmails = emails.filter(e => e.isUnread).length;
    const now = new Date();
    const groupedEvents: { [key: string]: CalendarEvent[] } = {};
    events.forEach(evt => {
        const dateKey = evt.start.toDateString();
        if (!groupedEvents[dateKey]) groupedEvents[dateKey] = [];
        groupedEvents[dateKey].push(evt);
    });
    const sortedDateKeys = Object.keys(groupedEvents).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    return (
        <div className="pb-20 animate-fade-in flex flex-col h-full pt-4">
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
                     </button>
                 </div>
             </div>

             {googleSubTab === 'mail' && (
                !googleToken ? renderGoogleLogin('Gmail') : (
                  <div>
                      {emails.length === 0 && !isLoadingGoogle && <div className="text-center py-10 text-slate-500"><Check className="w-8 h-8 text-emerald-500/50 mx-auto mb-2"/><p>Caixa limpa!</p></div>}
                      {emails.map(email => <EmailItem key={email.id} email={email} onSelect={() => {setSelectedEmailId(email.id); setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isUnread: false } : e));}} onDismiss={() => setEmails(prev => prev.filter(e => e.id !== email.id))} />)}
                  </div>
                )
             )}

             {googleSubTab === 'calendar' && (
                dashPrefs.calendarMode === 'embed' ? (
                    <div className="h-[70vh] bg-white rounded-lg overflow-hidden border border-slate-700 relative">
                        {!dashPrefs.calendarEmbedUrl ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-800 p-6 text-center">
                                <Calendar className="w-12 h-12 text-slate-400 mb-4" />
                                <h3 className="font-bold mb-2">Agenda não configurada</h3>
                                <p className="text-sm text-slate-500 mb-4">
                                    Para visualizar sua agenda aqui, vá nas configurações do app e cole a URL de Incorporação (Embed) do Google Calendar.
                                </p>
                                <button onClick={() => setIsConfigModalOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">
                                    Configurar Agora
                                </button>
                            </div>
                        ) : (
                            <iframe 
                                src={dashPrefs.calendarEmbedUrl} 
                                style={{border: 0}} 
                                width="100%" 
                                height="100%" 
                                frameBorder="0" 
                                scrolling="no"
                            ></iframe>
                        )}
                    </div>
                ) : (
                    !googleToken ? renderGoogleLogin('Agenda') : (
                      <div className="space-y-6">
                           {events.length === 0 && !isLoadingGoogle && (
                               <div className="mb-6 p-6 bg-slate-800/50 rounded-xl text-center border border-slate-700/50 flex flex-col items-center">
                                   <CalendarDays className="w-10 h-10 text-slate-600 mb-3" />
                                   <p className="text-sm text-slate-400">Sua agenda está livre ou não pôde ser carregada via API.</p>
                                   <button onClick={() => fetchGoogleData(googleToken)} className="mt-4 text-xs text-blue-400 hover:underline">Tentar novamente</button>
                                   <button onClick={() => setDashPrefs(p => ({ ...p, calendarMode: 'embed' }))} className="mt-4 text-xs text-slate-500 hover:text-white border border-slate-700 px-3 py-1 rounded">
                                       Mudar para Modo Incorporado
                                   </button>
                               </div>
                           )}
    
                           {sortedDateKeys.map(dateKey => {
                               const dateObj = new Date(dateKey);
                               const isToday = isSameDay(dateObj, now);
                               const isTmrw = isTomorrow(dateObj, now);
                               
                               let label = dateObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', weekday: 'long' });
                               let badgeColor = 'bg-slate-700';
                               
                               if (isToday) {
                                   label = "Hoje";
                                   badgeColor = "bg-blue-600";
                               } else if (isTmrw) {
                                   label = "Amanhã";
                                   badgeColor = "bg-indigo-600";
                               }
    
                               return (
                                   <div key={dateKey}>
                                       <div className="flex items-center gap-3 mb-3 px-1">
                                           <span className={`text-[10px] font-bold text-white px-2 py-0.5 rounded-md uppercase tracking-wide ${badgeColor}`}>
                                               {label === "Hoje" || label === "Amanhã" ? label : dateObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).toUpperCase()}
                                           </span>
                                           {label !== "Hoje" && label !== "Amanhã" && (
                                               <span className="text-xs text-slate-500 capitalize">
                                                   {dateObj.toLocaleDateString('pt-BR', { weekday: 'long' })}
                                               </span>
                                           )}
                                           <div className="h-px bg-slate-800 flex-1"></div>
                                       </div>
                                       {groupedEvents[dateKey].map(evt => (
                                           <CalendarEventItem key={evt.id} event={evt} />
                                       ))}
                                   </div>
                               );
                           })}
                      </div>
                    )
                )
             )}
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
                 <img src="https://tidas.com.br/wp-content/uploads/2025/08/logo_tidas_rodan2.svg" alt="Tidas" className="h-6 w-auto drop-shadow-md" />
             </div>

             <button onClick={() => setIsConfigModalOpen(true)} className="p-2 -mr-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors">
                <Settings className="w-6 h-6" />
             </button>
         </div>
      </header>

      <main className="max-w-md mx-auto min-h-screen relative pt-[calc(4rem+env(safe-area-inset-top,20px))] px-4 pb-safe-area">
        {currentView === ViewState.DASHBOARD && renderDashboard()}
        {currentView === ViewState.WEBSITES && renderWebsiteHub()}
        {currentView === ViewState.TRELLO && (
            <>
              {!trelloKey || !trelloToken ? (
                  <div className="pb-20 animate-fade-in px-4 pt-4">
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
                  <div className="pb-20 animate-fade-in px-4 pt-4">
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
                  <div className="pb-20 animate-fade-in pt-4">
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
        {currentView === ViewState.GOOGLE && renderGoogleHub()}
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
        notificationsEnabled={notifPermission === 'granted'}
        onToggleNotifications={requestNotificationPermission}
        locationEnabled={!weatherPermissionDenied}
        onToggleLocation={loadWeather}
        onUpdateCalendar={(mode, url) => setDashPrefs(prev => ({ ...prev, calendarMode: mode, calendarEmbedUrl: url }))}
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

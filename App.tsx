import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_SITES, MOCK_FORMS, GOOGLE_CLIENT_ID } from './constants';
import { SiteConfig, SiteStatus, ViewState, FormSubmission, EmailMessage, TrelloBoard, TrelloList, TrelloCard } from './types';
import MonitorCard from './components/MonitorCard';
import InboxItem from './components/InboxItem';
import EmailItem from './components/EmailItem';
import TabNav from './components/TabNav';
import FormDetailsModal from './components/FormDetailsModal';
import EmailDetailsModal from './components/EmailDetailsModal';
import TrelloCardItem from './components/TrelloCardItem';
import { fetchFormsFromWP, fetchSiteStats } from './services/wpService';
import { fetchGmailMessages } from './services/gmailService';
import { fetchBoards, fetchLists, fetchCardsFromList } from './services/trelloService';
import { Activity, RefreshCw, AlertTriangle, WifiOff, Trash2, BarChart3, Mail, LogIn, LogOut, Star, Copy, Info, Check, ShieldCheck, Trello, Settings, CheckSquare, ExternalLink, Filter, HelpCircle, Bell } from 'lucide-react';

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

  // Gmail States
  const [gmailToken, setGmailToken] = usePersistedState<string | null>('monitor_gmail_token', null);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [isLoadingGmail, setIsLoadingGmail] = useState(false);
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [authError, setAuthError] = useState<boolean>(false); 
  const [authErrorType, setAuthErrorType] = useState<string | null>(null);
  const [apiNotEnabled, setApiNotEnabled] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState(false);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const tokenClient = useRef<any>(null);

  // Trello States
  const [trelloKey, setTrelloKey] = usePersistedState<string>('monitor_trello_key', '');
  const [trelloToken, setTrelloToken] = usePersistedState<string>('monitor_trello_token', '');
  const [trelloBoardId, setTrelloBoardId] = usePersistedState<string>('monitor_trello_board', '');
  const [trelloListIds, setTrelloListIds] = usePersistedState<string[]>('monitor_trello_lists', []);
  const [trelloBadgeCount, setTrelloBadgeCount] = useState(0);
  
  // Trello Data (Não persistido para evitar cache velho)
  const [trelloCards, setTrelloCards] = useState<TrelloCard[]>([]);
  const [availableBoards, setAvailableBoards] = useState<TrelloBoard[]>([]);
  const [availableLists, setAvailableLists] = useState<TrelloList[]>([]);
  const [isLoadingTrello, setIsLoadingTrello] = useState(false);
  const [isConfiguringTrello, setIsConfiguringTrello] = useState(false);
  const [isSelectingLists, setIsSelectingLists] = useState(false); 
  const [activeTrelloFilter, setActiveTrelloFilter] = useState<string>('ALL');

  // Persistência de estados de leitura e exclusão
  const [readFormIds, setReadFormIds] = usePersistedState<string[]>('monitor_read_forms_v2', []);
  const [deletedFormIds, setDeletedFormIds] = usePersistedState<string[]>('monitor_deleted_forms_v2', []);

  // Refs para evitar Stale Closures no setInterval/async functions
  const deletedIdsRef = useRef<string[]>([]);
  const readIdsRef = useRef<string[]>([]);
  const sitesRef = useRef<SiteConfig[]>(DEFAULT_SITES);
  
  // Refs para detecção de novos itens (Notificações)
  const prevEmailIdsRef = useRef<string[]>([]);
  const prevTrelloCardIdsRef = useRef<string[]>([]);

  // Mantém os refs sempre atualizados
  useEffect(() => { deletedIdsRef.current = deletedFormIds || []; }, [deletedFormIds]);
  useEffect(() => { readIdsRef.current = readFormIds || []; }, [readFormIds]);
  useEffect(() => { sitesRef.current = sites; }, [sites]);

  // Força o modo de seleção se não houver listas selecionadas
  useEffect(() => {
    if (trelloListIds.length === 0) {
      setIsSelectingLists(true);
    }
  }, [trelloListIds.length]);

  // Reset Trello badge quando abre a view
  useEffect(() => {
    if (currentView === ViewState.TRELLO) {
      setTrelloBadgeCount(0);
    }
  }, [currentView]);

  // Inicializa Google Identity Services (OAuth)
  useEffect(() => {
    const initGoogleAuth = () => {
      if (window.google && window.google.accounts && !tokenClient.current) {
        try {
          tokenClient.current = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/gmail.readonly',
            prompt: 'consent',
            callback: (response: any) => {
              if (response.access_token) {
                setGmailToken(response.access_token);
                setAuthError(false);
                setAuthErrorType(null);
                setApiNotEnabled(false);
                fetchGmail(response.access_token);
              }
            },
            error_callback: (error: any) => {
                console.error("Google Auth Error:", error);
                setAuthError(true);
                
                if (error.type === 'popup_closed_by_user') {
                   setAuthErrorType('popup_closed');
                } else {
                   setAuthErrorType(error.type || 'generic');
                }
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

  // Verificar status de permissão de notificação
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        setNotifPermission(permission);
        if (permission === 'granted') {
          new Notification('Notificações Ativadas', {
            body: 'Você receberá alertas de sites, emails e trello.',
            icon: 'https://tidas.com.br/wp-content/uploads/2025/11/icoapp.png'
          });
        }
      } catch (error) {
        console.error('Erro ao solicitar permissão:', error);
      }
    } else {
      alert('Seu navegador não suporta notificações.');
    }
  };

  const sendNotification = (title: string, body: string) => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
         // Em mobile, a notificação pode não aparecer se o app não estiver em "background" ou se o SO bloquear.
         // Service Workers seriam ideais, mas em client-side puro, tentamos o padrão.
         const n = new Notification(title, { 
           body, 
           icon: 'https://tidas.com.br/wp-content/uploads/2025/11/icoapp.png',
           tag: 'tidas-notification'
         });
         // Algumas versões do Android requerem vibração explícita
         if (navigator.vibrate) navigator.vibrate(200);
      }
    } catch (e) {
      console.warn('Falha ao enviar notificação:', e);
    }
  };

  const checkSiteStatus = async (site: SiteConfig): Promise<SiteConfig> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    const startTime = performance.now();

    try {
      const stats = await fetchSiteStats(site);
      
      const endTime = performance.now();
      clearTimeout(timeoutId);
      const latency = Math.round(endTime - startTime);

      if (latency > 3000 && (site.responseTime || 0) < 3000 && site.status === SiteStatus.ONLINE) {
        sendNotification('Instabilidade Detectada', `O site ${site.name} está respondendo muito lentamente (${latency}ms).`);
      }

      if (stats) {
        return {
          ...site,
          status: SiteStatus.ONLINE,
          lastChecked: new Date(),
          responseTime: latency,
          onlineUsers: stats.online,
          monthlyVisitors: stats.monthly
        };
      }

      await fetch(site.url, { 
        method: 'HEAD', 
        mode: 'no-cors',
        signal: controller.signal 
      });
      
      const fallbackLatency = Math.round(performance.now() - startTime);

      if (fallbackLatency > 3000 && (site.responseTime || 0) < 3000 && site.status === SiteStatus.ONLINE) {
        sendNotification('Instabilidade Detectada', `O site ${site.name} está respondendo muito lentamente (${fallbackLatency}ms).`);
      }

      return {
        ...site,
        status: SiteStatus.ONLINE,
        lastChecked: new Date(),
        responseTime: fallbackLatency,
        onlineUsers: site.onlineUsers || 0,
        monthlyVisitors: site.monthlyVisitors || 0
      };

    } catch (error) {
      if (site.status === SiteStatus.ONLINE || site.status === SiteStatus.CHECKING) {
         sendNotification('Site Offline!', `URGENTE: O site ${site.name} parou de responder ou está fora do ar.`);
      }

      return {
        ...site,
        status: SiteStatus.OFFLINE,
        lastChecked: new Date(),
        onlineUsers: 0,
        monthlyVisitors: site.monthlyVisitors
      };
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
    const currentSites = sitesRef.current;
    const updatedSitesResults = await Promise.all(currentSites.map(site => checkSiteStatus(site)));
    setSites(updatedSitesResults);
  }, []);

  const syncForms = async () => {
    setIsLoadingForms(true);
    try {
      const promises = sitesRef.current.map(site => fetchFormsFromWP(site));
      const results = await Promise.all(promises);
      const fetchedForms = results.flat();
      
      if (fetchedForms.length > 0) {
        setForms(currentForms => {
          const currentDeletedIds = deletedIdsRef.current || [];
          const currentReadIds = readIdsRef.current || [];
          
          const activeForms = fetchedForms.filter(f => 
            !currentDeletedIds.includes(f.id) && 
            f.timestamp instanceof Date && !isNaN(f.timestamp.getTime())
          );
          
          const processedForms = activeForms.map(f => ({
            ...f,
            isRead: currentReadIds.includes(f.id) ? true : f.isRead
          }));

          const previousIds = currentForms.map(c => c.id);
          const newArrivals = processedForms.filter(p => 
            !previousIds.includes(p.id) && 
            !p.isRead && 
            !currentDeletedIds.includes(p.id)
          );
          
          if (newArrivals.length > 0) {
             sendNotification('Novo Formulário', `Você recebeu ${newArrivals.length} nova(s) mensagem(ns).`);
          }

          return processedForms.sort((a, b) => {
            if (a.isRead !== b.isRead) {
              return a.isRead ? 1 : -1;
            }
            return b.timestamp.getTime() - a.timestamp.getTime();
          });
        });
      }
    } catch (e) {
      console.error("Erro crítico ao sincronizar forms", e);
    } finally {
      setIsLoadingForms(false);
    }
  };

  const fetchGmail = async (tokenOverride?: string) => {
    const token = tokenOverride || gmailToken;
    if (!token) return;
    
    setIsLoadingGmail(true);

    try {
      const messages = await fetchGmailMessages(token, 80);
      setApiNotEnabled(false);

      const currentUnread = messages.filter(m => m.isUnread);
      const newUnread = currentUnread.filter(m => !prevEmailIdsRef.current.includes(m.id));

      if (prevEmailIdsRef.current.length > 0 && newUnread.length > 0) {
         sendNotification('Novo E-mail', `Você recebeu ${newUnread.length} novo(s) e-mail(s) importante(s).`);
      }
      
      prevEmailIdsRef.current = messages.map(m => m.id);
      setEmails(messages);
    } catch (error: any) {
      console.error("Erro ao carregar Gmail:", error);
      if (error.message === 'API_NOT_ENABLED' || (error.message && error.message.includes('403'))) {
        setApiNotEnabled(true);
      } else if (error.message === 'AUTH_EXPIRED') {
        setGmailToken(null);
        setApiNotEnabled(false);
      }
    } finally {
      setIsLoadingGmail(false);
    }
  };

  const loadTrelloBoards = async () => {
    if (!trelloKey || !trelloToken) return;
    setIsLoadingTrello(true);
    try {
      const boards = await fetchBoards(trelloKey, trelloToken);
      setAvailableBoards(boards);
    } catch (e) {
      console.error(e);
      alert('Erro ao carregar quadros. Verifique suas chaves.');
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
    } catch (e) {
      console.error(e);
      return [];
    } finally {
      setIsLoadingTrello(false);
    }
  };

  const fetchTrelloCards = async () => {
    if (!trelloKey || !trelloToken || !trelloListIds.length) return;
    setIsLoadingTrello(true);
    try {
      let currentAvailableLists = availableLists;
      if (availableLists.length === 0 && trelloBoardId) {
         currentAvailableLists = await loadTrelloLists(trelloBoardId);
      }

      const allCards: TrelloCard[] = [];
      const promises = trelloListIds.map(async listId => {
          const cards = await fetchCardsFromList(trelloKey, trelloToken, listId);
          const listName = currentAvailableLists.find(l => l.id === listId)?.name || 'Lista';
          return cards.map(c => ({ ...c, listName }));
      });

      const results = await Promise.all(promises);
      results.forEach(listCards => allCards.push(...listCards));
      
      const newCards = allCards.filter(c => !prevTrelloCardIdsRef.current.includes(c.id));
      
      if (newCards.length > 0) {
         if (prevTrelloCardIdsRef.current.length > 0) {
            sendNotification('Trello: Nova Atividade', `${newCards.length} novo(s) cartão(ões) adicionado(s).`);
         }
         // Incrementa badge se não estiver na view do Trello
         if (currentView !== ViewState.TRELLO) {
            setTrelloBadgeCount(prev => prev + newCards.length);
         }
      }

      prevTrelloCardIdsRef.current = allCards.map(c => c.id);
      setTrelloCards(allCards.sort((a, b) => b.dateLastActivity.getTime() - a.dateLastActivity.getTime()));
    } catch (e) {
      console.error("Erro Trello Cards", e);
    } finally {
      setIsLoadingTrello(false);
    }
  };

  useEffect(() => {
    if (trelloKey && trelloToken && trelloBoardId && availableLists.length === 0) {
      loadTrelloLists(trelloBoardId);
    }
  }, [trelloBoardId]);

  useEffect(() => {
    if (currentView === ViewState.TRELLO && trelloKey && trelloToken && trelloListIds.length > 0) {
      fetchTrelloCards();
    }
  }, [currentView]);


  const handleConnectGmail = () => {
    if (GOOGLE_CLIENT_ID.includes('YOUR_CLIENT_ID')) {
      alert('Configuração Necessária: Adicione um Client ID válido no arquivo constants.ts para conectar ao Google.');
      return;
    }

    if (tokenClient.current) {
      setAuthError(false); 
      setAuthErrorType(null);
      setApiNotEnabled(false);
      tokenClient.current.requestAccessToken();
    } else {
      if (window.google) {
         window.location.reload();
      } else {
         alert("O serviço do Google ainda está carregando. Verifique sua conexão.");
      }
    }
  };

  const handleDisconnectGmail = () => {
    setGmailToken(null);
    setEmails([]);
    setAuthError(false);
    setAuthErrorType(null);
    setApiNotEnabled(false);
    if (window.google && gmailToken) {
      try {
        window.google.accounts.oauth2.revoke(gmailToken, () => {
          console.log('Token revogado');
        });
      } catch (e) {
        console.log('Erro ao revogar (pode já estar inválido)');
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
       if (isMounted) {
         await checkAllSites();
         await syncForms();
         if (gmailToken) fetchGmail(gmailToken);
         if (trelloKey && trelloToken && trelloListIds.length > 0) {
            // Fetch inicial do Trello para popular cache, sem notificar
            try {
               // Lógica simplificada de fetch sem notificações no first load
               const promises = trelloListIds.map(async listId => {
                  return await fetchCardsFromList(trelloKey, trelloToken, listId);
               });
               const results = await Promise.all(promises);
               const allCards = results.flat();
               prevTrelloCardIdsRef.current = allCards.map(c => c.id);
               setTrelloCards(allCards);
            } catch(e) {}
         }
       }
    };

    init();

    const intervalId = setInterval(async () => {
      if (isMounted) {
        await syncForms();
        const currentSites = sitesRef.current;
        const updatedResults = await Promise.all(currentSites.map(site => checkSiteStatus(site)));
        setSites(updatedResults);
        
        if (gmailToken) fetchGmail(gmailToken);
        if (trelloKey && trelloToken && trelloListIds.length > 0) {
            fetchTrelloCards(); 
        }
      }
    }, 60000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [gmailToken]); 

  const handleMarkAsRead = (id: string) => {
    if (!readFormIds.includes(id)) {
      const newReadIds = [...readFormIds, id];
      setReadFormIds(newReadIds);
      readIdsRef.current = newReadIds;
      
      setForms(prev => {
         const updated = prev.map(f => f.id === id ? { ...f, isRead: true } : f);
         return updated.sort((a, b) => {
            if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
            return b.timestamp.getTime() - a.timestamp.getTime();
         });
      });
    }
  };

  const handleOpenForm = (form: FormSubmission) => {
    setSelectedFormId(form.id);
    handleMarkAsRead(form.id);
  };

  const handleCloseForm = () => {
    setSelectedFormId(null);
  };

  const handleDismissForm = (id: string) => {
    if (!deletedFormIds.includes(id)) {
        setDeletedFormIds(prev => {
          const newState = [...prev, id];
          deletedIdsRef.current = newState;
          return newState;
        });
        setForms(prev => prev.filter(f => f.id !== id));
    }
  };

  const handleClearRead = () => {
    const readIds = forms.filter(f => f.isRead).map(f => f.id);
    if (readIds.length === 0) return;

    setDeletedFormIds(prev => {
      const newState = [...prev, ...readIds];
      deletedIdsRef.current = newState;
      return newState;
    });
    setForms(prev => prev.filter(f => !f.isRead));
  };

  const handleOpenEmail = (email: EmailMessage) => {
      setSelectedEmailId(email.id);
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isUnread: false } : e));
  };

  const handleDismissEmail = (id: string) => {
      setEmails(prev => prev.filter(e => e.id !== id));
  };

  const copyOriginToClipboard = () => {
    const origin = window.location.origin;
    navigator.clipboard.writeText(origin).then(() => {
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
    });
  };

  const offlineSitesCount = sites.filter(s => s.status === SiteStatus.OFFLINE).length;
  const unreadFormsCount = forms.filter(f => !f.isRead).length;
  const unreadEmailsCount = emails.filter(e => e.isUnread).length;
  
  const selectedForm = forms.find(f => f.id === selectedFormId);
  const selectedEmail = emails.find(e => e.id === selectedEmailId);

  const renderDashboard = () => {
    const onlineCount = sites.filter(s => s.status === SiteStatus.ONLINE).length;

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header com Logo - Centralizada e sem texto */}
        <div className="flex justify-center items-center mb-6">
           <img 
             src="https://tidas.com.br/wp-content/uploads/2025/08/logo_tidas_rodan2.svg" 
             alt="Tidas" 
             onClick={() => setCurrentView(ViewState.DASHBOARD)}
             className="h-[1.6rem] w-auto drop-shadow-md cursor-pointer hover:opacity-80 transition-opacity" 
           />
        </div>

        {/* Solicitação de Permissão de Notificação */}
        {notifPermission === 'default' && (
           <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex flex-col items-center text-center">
              <Bell className="w-6 h-6 text-blue-400 mb-2" />
              <p className="text-sm text-blue-200 font-medium mb-2">Ative notificações para ser avisado de sites offline.</p>
              <button 
                onClick={requestNotificationPermission}
                className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-blue-500 transition-colors"
              >
                ATIVAR NOTIFICAÇÕES
              </button>
           </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div 
            onClick={() => setCurrentView(ViewState.SITES)}
            className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-sm cursor-pointer hover:bg-slate-700 active:scale-95 transition-all relative"
          >
            {offlineSitesCount > 0 && (
                <span className="absolute top-3 right-3 w-3 h-3 bg-rose-500 rounded-full animate-pulse"></span>
            )}
            <div className="flex items-center gap-2 mb-2 text-brand-400">
              <Activity className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase">Uptime</span>
            </div>
            <div className="text-2xl font-bold text-slate-100">{onlineCount}/{sites.length}</div>
            <div className="text-xs text-emerald-400 mt-1">Sites Online</div>
          </div>
          
          <div 
            onClick={() => setCurrentView(ViewState.FORMS)}
            className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-sm cursor-pointer hover:bg-slate-700 active:scale-95 transition-all relative"
          >
            <div className="flex items-center gap-2 mb-2 text-brand-400">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase">Alertas</span>
            </div>
            <div className="text-2xl font-bold text-slate-100">{unreadFormsCount}</div>
            <div className="text-xs text-brand-secondary mt-1">Novos Forms</div>
          </div>
        </div>
        
        <div 
          onClick={() => setCurrentView(ViewState.GMAIL)}
          className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-sm cursor-pointer hover:bg-slate-700 active:scale-95 transition-all flex justify-between items-center"
        >
           <div className="flex items-center gap-3">
             <div className="p-2 bg-red-500/10 rounded-full">
               <Mail className="w-5 h-5 text-red-400" />
             </div>
             <div>
               <h3 className="text-sm font-semibold text-slate-100">E-Mail</h3>
               <p className="text-xs text-slate-400">{gmailToken ? (unreadEmailsCount > 0 ? `${unreadEmailsCount} não lidos` : 'Sem e-mails não lidos') : 'Não conectado'}</p>
             </div>
           </div>
           {gmailToken && unreadEmailsCount > 0 && (
             <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">{unreadEmailsCount}</span>
           )}
        </div>

         <div 
          onClick={() => setCurrentView(ViewState.TRELLO)}
          className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-sm cursor-pointer hover:bg-slate-700 active:scale-95 transition-all flex justify-between items-center"
        >
           <div className="flex items-center gap-3">
             <div className="p-2 bg-blue-500/10 rounded-full">
               <Trello className="w-5 h-5 text-blue-400" />
             </div>
             <div>
               <h3 className="text-sm font-semibold text-slate-100">Trello</h3>
               <p className="text-xs text-slate-400">
                  {trelloListIds.length > 0 
                    ? `Monitorando ${trelloListIds.length} listas` 
                    : 'Não configurado'}
               </p>
             </div>
           </div>
           {trelloBadgeCount > 0 && (
              <span className="bg-rose-500 text-white text-xs font-bold px-2 py-1 rounded-full">{trelloBadgeCount}</span>
           )}
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-100 mb-4 px-1">Status Geral</h2>
          {sites.map(site => (
            <div key={site.id} className="mb-3 bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-200">{site.name}</span>
                {site.status === SiteStatus.ONLINE && (
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <BarChart3 className="w-3 h-3 text-purple-400" />
                    {site.monthlyVisitors !== undefined ? site.monthlyVisitors.toLocaleString('pt-BR') : '-'} visitantes/mês
                  </span>
                )}
              </div>
              <div className={`w-2.5 h-2.5 rounded-full ${site.status === SiteStatus.ONLINE ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : site.status === SiteStatus.OFFLINE ? 'bg-rose-500' : 'bg-slate-500'}`}></div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSites = () => (
    <div className="pb-20 animate-fade-in">
      <div className="flex justify-between items-center mb-6 px-1">
        <h2 className="text-xl font-bold text-slate-100">Meus Sites</h2>
        <button 
          onClick={() => checkAllSites()}
          className="p-2 bg-brand-secondary/20 text-brand-secondary rounded-full hover:bg-brand-secondary/30 transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>
      {sites.map(site => (
        <MonitorCard key={site.id} site={site} onRefresh={handleRefreshSite} />
      ))}
    </div>
  );

  const renderForms = () => (
    <div className="pb-20 animate-fade-in overflow-x-hidden">
      <div className="flex justify-between items-center mb-6 px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-slate-100">Mensagens</h2>
          <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded-full">{forms.length}</span>
        </div>
        <div className="flex gap-2">
          {forms.some(f => f.isRead) && (
             <button 
             onClick={handleClearRead}
             className="p-2 text-slate-500 hover:text-rose-400 transition-colors"
             title="Limpar lidos"
           >
             <Trash2 className="w-4 h-4" />
           </button>
          )}
          <button 
            onClick={syncForms}
            className={`p-2 bg-brand-secondary/20 text-brand-secondary rounded-full hover:bg-brand-secondary/30 transition-all ${isLoadingForms ? 'animate-spin' : ''}`}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="mb-4 px-1 text-xs text-slate-500 text-center opacity-70">
        Deslize para o lado <span className="font-bold">←</span> para limpar alertas
      </div>
      
      {forms.length === 0 && (
        <div className="text-center py-10 text-slate-500">
          <WifiOff className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Nenhuma mensagem encontrada.</p>
          <p className="text-xs mt-2 opacity-70">Verifique a conexão com o WordPress.</p>
        </div>
      )}

      {forms.map(form => {
        const site = sites.find(s => s.id === form.siteId);
        return (
          <InboxItem 
            key={form.id} 
            form={form} 
            siteName={site?.name || 'Unknown'} 
            onSelect={() => handleOpenForm(form)}
            onDismiss={() => handleDismissForm(form.id)}
          />
        );
      })}
    </div>
  );

  const renderTrello = () => {
    if (isConfiguringTrello || !trelloKey || !trelloToken) {
      return (
        <div className="pb-20 animate-fade-in px-4">
           <h2 className="text-xl font-bold text-slate-100 mb-4">Configurar Trello</h2>
           
           <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl mb-6">
              <h3 className="text-sm font-bold text-blue-400 mb-2 flex items-center gap-2">
                 <Info className="w-4 h-4" /> Instruções
              </h3>
              <ol className="list-decimal list-inside text-xs text-slate-300 space-y-1.5">
                <li>Clique em <span className="font-bold text-white">Obter API Key</span> abaixo.</li>
                <li>Faça login no Trello se necessário e aceite os termos.</li>
                <li>Copie a <span className="font-mono bg-black/30 px-1 rounded">API Key</span> e cole no campo 1.</li>
                <li>Um botão <span className="font-bold text-emerald-400">Gerar Token</span> aparecerá. Clique nele.</li>
                <li>Autorize o app e copie o Token gerado para o campo 2.</li>
              </ol>
           </div>

           <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">1. API Key</label>
                <div className="flex gap-2 mb-2">
                   <input 
                     type="text" 
                     value={trelloKey} 
                     onChange={e => setTrelloKey(e.target.value)}
                     className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none transition-colors"
                     placeholder="Cole sua API Key aqui"
                   />
                </div>
                <a 
                    href="https://trello.com/app-key" 
                    target="_blank" 
                    className="inline-flex items-center gap-2 text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg transition-colors border border-slate-600"
                >
                     <ExternalLink className="w-3 h-3" /> Obter API Key no Trello
                </a>
              </div>
              
              <div className={`transition-opacity duration-300 ${!trelloKey ? 'opacity-50' : 'opacity-100'}`}>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">2. Token</label>
                <input 
                  type="text" 
                  value={trelloToken}
                  onChange={e => setTrelloToken(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none transition-colors mb-2"
                  placeholder="Cole seu Token aqui"
                  disabled={!trelloKey}
                />
                
                {trelloKey ? (
                   <a 
                     href={`https://trello.com/1/authorize?expiration=never&scope=read,write,account&response_type=token&name=Tidas&key=${trelloKey}`} 
                     target="_blank" 
                     className="inline-flex items-center gap-2 text-xs bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 px-3 py-2 rounded-lg hover:bg-emerald-600/30 transition-colors"
                   >
                     <ExternalLink className="w-3 h-3" /> Gerar Token de Acesso
                   </a>
                ) : (
                   <span className="text-[10px] text-slate-500 italic">
                     (Preencha a API Key acima para liberar o link do Token)
                   </span>
                )}
              </div>

              <button 
                onClick={() => {
                   setIsConfiguringTrello(false);
                   loadTrelloBoards();
                }}
                disabled={!trelloKey || !trelloToken}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl disabled:opacity-50 hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20 mt-2"
              >
                Salvar e Conectar
              </button>
           </div>
        </div>
      );
    }

    if (!trelloBoardId || isSelectingLists) {
      return (
        <div className="pb-20 animate-fade-in px-4">
          <div className="flex justify-between items-center mb-4">
             <h2 className="text-xl font-bold text-slate-100">Selecionar Listas</h2>
             <button onClick={() => setIsConfiguringTrello(true)} className="p-2 text-slate-400"><Settings className="w-5 h-5" /></button>
          </div>

          {!trelloBoardId ? (
             <div className="space-y-3">
               <p className="text-sm text-slate-400">Escolha o Quadro:</p>
               {availableBoards.length === 0 && <button onClick={loadTrelloBoards} className="text-blue-400 text-xs underline">Carregar Quadros</button>}
               {availableBoards.map(board => (
                 <button
                   key={board.id}
                   onClick={() => {
                     setTrelloBoardId(board.id);
                     loadTrelloLists(board.id);
                   }}
                   className="w-full text-left p-3 bg-slate-800 rounded-lg border border-slate-700 hover:bg-slate-700"
                 >
                   {board.name}
                 </button>
               ))}
             </div>
          ) : (
            <div className="space-y-3">
               <div className="flex justify-between">
                 <p className="text-sm text-slate-400">Marque as listas que deseja monitorar:</p>
                 <button onClick={() => setTrelloBoardId('')} className="text-xs text-slate-500">Voltar</button>
               </div>
               
               <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800 mb-2 max-h-[60vh] overflow-y-auto">
                  {availableLists.map(list => {
                    const isSelected = trelloListIds.includes(list.id);
                    return (
                      <button
                        key={list.id}
                        onClick={() => {
                          if (isSelected) {
                            setTrelloListIds(prev => prev.filter(id => id !== list.id));
                          } else {
                            setTrelloListIds(prev => [...prev, list.id]);
                          }
                        }}
                        className={`w-full flex items-center justify-between p-3 mb-2 rounded-lg border transition-colors ${isSelected ? 'bg-blue-500/20 border-blue-500' : 'bg-slate-800 border-slate-700'}`}
                      >
                        <span>{list.name}</span>
                        {isSelected ? <CheckSquare className="w-5 h-5 text-blue-400" /> : <div className="w-5 h-5 border border-slate-600 rounded"></div>}
                      </button>
                    );
                  })}
               </div>

               <div className="bg-slate-800 p-3 rounded-lg text-xs text-center">
                  Selecionado: <span className="font-bold text-white">{trelloListIds.length}</span> listas
               </div>

               <button 
                 onClick={() => {
                     setIsSelectingLists(false); 
                     fetchTrelloCards();
                 }}
                 disabled={trelloListIds.length === 0}
                 className="w-full mt-4 bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 Confirmar Monitoramento
               </button>
            </div>
          )}
        </div>
      );
    }

    const uniqueLists = trelloListIds.map(id => {
      const listName = availableLists.find(l => l.id === id)?.name || 
                       trelloCards.find(c => c.listId === id)?.listName || 
                       'Lista Carregando...';
      return { id, name: listName };
    });

    const filteredCards = trelloCards.filter(card => {
      if (activeTrelloFilter === 'ALL') return true;
      return card.listId === activeTrelloFilter;
    });

    return (
      <div className="pb-20 animate-fade-in">
         <div className="flex justify-between items-center mb-4 px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-100">Quadro Trello</h2>
              <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded-full">{trelloCards.length}</span>
            </div>
            <div className="flex gap-2">
                <button onClick={() => setIsSelectingLists(true)} className="p-2 text-slate-400 hover:text-blue-400"><Settings className="w-5 h-5" /></button>
                <button onClick={fetchTrelloCards} className={`p-2 bg-blue-500/20 text-blue-400 rounded-full ${isLoadingTrello ? 'animate-spin' : ''}`}><RefreshCw className="w-4 h-4" /></button>
            </div>
         </div>

         <div className="flex gap-2 overflow-x-auto pb-4 mb-2 scrollbar-hide px-1">
            <button 
              onClick={() => setActiveTrelloFilter('ALL')}
              className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${activeTrelloFilter === 'ALL' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
            >
              Todos
            </button>
            {uniqueLists.map((list, idx) => (
               <button
                 key={list.id}
                 onClick={() => setActiveTrelloFilter(list.id)}
                 className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${activeTrelloFilter === list.id ? 'bg-slate-200 text-slate-900' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
               >
                 {list.name}
               </button>
            ))}
         </div>

         {filteredCards.length === 0 && (
            <div className="text-center py-10 text-slate-500">
               <p>Nenhum cartão encontrado nesta visualização.</p>
            </div>
         )}

         {filteredCards.map(card => {
             const listIndex = trelloListIds.indexOf(card.listId);
             const colorName = TRELLO_COLORS[listIndex % TRELLO_COLORS.length] || 'slate';
             
             return (
               <TrelloCardItem 
                 key={card.id} 
                 card={card} 
                 listColorName={colorName}
               />
             );
         })}
      </div>
    );
  };

  const renderGmail = () => {
    if (!gmailToken) {
      return (
        <div className="flex flex-col items-center justify-center h-[80vh] px-6 text-center animate-fade-in">
          <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-xl border border-slate-700">
            <Mail className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Conectar E-Mail</h2>
          <p className="text-slate-400 mb-8 max-w-xs">
            Monitore e-mails importantes diretamente por aqui.
          </p>

          {apiNotEnabled && (
            <div className="w-full bg-slate-800/80 border border-slate-700 p-4 rounded-lg mb-6 text-left">
               <div className="flex items-center gap-2 text-blue-400 mb-2">
                 <Info className="w-5 h-5" />
                 <span className="font-bold text-sm">Configuração Necessária</span>
               </div>
               <p className="text-xs text-slate-400 mb-3">
                 A API do Gmail ainda não está ativada no seu projeto do Google Cloud.
               </p>
               <a 
                 href="https://console.cloud.google.com/apis/library/gmail.googleapis.com" 
                 target="_blank"
                 className="block w-full text-center py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-md text-xs font-bold hover:bg-blue-600/30 transition-colors"
               >
                 ATIVAR GMAIL API AGORA <ExternalLink className="inline w-3 h-3 ml-1" />
               </a>
               <p className="text-[10px] text-slate-500 mt-3 border-t border-slate-700 pt-2">
                  Se for o primeiro acesso, adicione esta URL às "Origens JavaScript autorizadas" no <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="underline hover:text-blue-300">Google Cloud Console</a>:
               </p>
               <div className="flex items-center gap-2 mt-1 bg-black/30 p-2 rounded border border-slate-700/50">
                  <code className="text-[9px] text-slate-300 break-all font-mono">{window.location.origin}</code>
                  <button onClick={copyOriginToClipboard} className="p-1 hover:bg-white/10 rounded">
                    {copyFeedback ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                  </button>
               </div>
            </div>
          )}

          {authError && !apiNotEnabled && (
             <div className="w-full bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg mb-6 flex items-start gap-3">
               <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
               <div className="text-left">
                 <h3 className="text-sm font-bold text-rose-400">Erro de Autenticação</h3>
                 <p className="text-xs text-slate-400 mt-1">
                   {authErrorType === 'popup_closed' ? 'A janela de login foi fechada antes de concluir.' : 'Não foi possível conectar. Tente novamente.'}
                 </p>
               </div>
             </div>
          )}

          <button 
            onClick={handleConnectGmail}
            disabled={!isGoogleReady}
            className="w-full bg-white text-slate-900 font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-100 transition-colors disabled:opacity-50 shadow-lg shadow-slate-100/5"
          >
            {isGoogleReady ? (
               <>
                 <LogIn className="w-5 h-5" /> Entrar com Google
               </>
            ) : (
               <span className="text-sm">Carregando serviço...</span>
            )}
          </button>
        </div>
      );
    }

    return (
      <div className="pb-20 animate-fade-in">
        <div className="flex justify-between items-center mb-6 px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-100">Caixa de Entrada</h2>
            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded-full">{emails.length}</span>
          </div>
          <div className="flex gap-2">
             <button onClick={() => setShowHelp(!showHelp)} className="p-2 text-slate-500 hover:text-slate-300"><HelpCircle className="w-5 h-5" /></button>
             <button 
              onClick={handleDisconnectGmail}
              className="p-2 text-slate-500 hover:text-rose-400 transition-colors"
              title="Desconectar"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <button 
              onClick={() => fetchGmail(gmailToken)}
              className={`p-2 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500/30 transition-all ${isLoadingGmail ? 'animate-spin' : ''}`}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showHelp && (
           <div className="bg-slate-800 p-3 rounded-lg mb-4 text-xs text-slate-400 border border-slate-700">
              <p className="mb-1"><strong>Dica:</strong> Apenas e-mails <u>não lidos</u> aparecem aqui.</p>
              <p>Para ver todos, acesse o app oficial do Gmail.</p>
           </div>
        )}

        {emails.length === 0 && !isLoadingGmail && (
           <div className="text-center py-10 text-slate-500">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Check className="w-8 h-8 text-emerald-500/50" />
              </div>
              <p className="text-sm">Tudo limpo! Nenhum e-mail novo.</p>
           </div>
        )}

        {emails.map(email => (
          <EmailItem 
             key={email.id}
             email={email}
             onSelect={() => handleOpenEmail(email)}
             onDismiss={() => handleDismissEmail(email.id)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-brand-900 text-slate-200 font-sans selection:bg-brand-secondary/30">
      <main className="p-4 pt-8 max-w-md mx-auto min-h-screen relative">
        {currentView === ViewState.DASHBOARD && renderDashboard()}
        {currentView === ViewState.SITES && renderSites()}
        {currentView === ViewState.FORMS && renderForms()}
        {currentView === ViewState.TRELLO && renderTrello()}
        {currentView === ViewState.GMAIL && renderGmail()}
      </main>
      
      <TabNav 
        currentView={currentView} 
        onChangeView={setCurrentView}
        badges={{
          sites: offlineSitesCount > 0,
          forms: unreadFormsCount,
          gmail: unreadEmailsCount,
          trello: trelloBadgeCount
        }}
      />

      {selectedForm && (
        <FormDetailsModal 
          form={selectedForm}
          siteName={sites.find(s => s.id === selectedForm.siteId)?.name || 'Site'}
          onClose={handleCloseForm}
        />
      )}

      {selectedEmail && (
        <EmailDetailsModal 
          email={selectedEmail}
          onClose={() => setSelectedEmailId(null)}
        />
      )}
    </div>
  );
};

export default App;
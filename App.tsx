
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_SITES, MOCK_FORMS, GOOGLE_CLIENT_ID } from './constants';
import { SiteConfig, SiteStatus, ViewState, FormSubmission, EmailMessage } from './types';
import MonitorCard from './components/MonitorCard';
import InboxItem from './components/InboxItem';
import TabNav from './components/TabNav';
import FormDetailsModal from './components/FormDetailsModal';
import { fetchFormsFromWP, fetchSiteStats } from './services/wpService';
import { fetchGmailMessages } from './services/gmailService';
import { Activity, RefreshCw, AlertTriangle, WifiOff, Trash2, BarChart3, Mail, LogIn, Star, Copy, Info, Check, ShieldCheck } from 'lucide-react';

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

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [sites, setSites] = useState<SiteConfig[]>(DEFAULT_SITES);
  const [forms, setForms] = useState<FormSubmission[]>(MOCK_FORMS);
  const [isLoadingForms, setIsLoadingForms] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  
  // Gmail States
  const [gmailToken, setGmailToken] = usePersistedState<string | null>('monitor_gmail_token', null);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [isLoadingGmail, setIsLoadingGmail] = useState(false);
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [authError, setAuthError] = useState<boolean>(false); 
  const [authErrorType, setAuthErrorType] = useState<string | null>(null);
  const tokenClient = useRef<any>(null);

  // Persistência de estados de leitura e exclusão
  const [readFormIds, setReadFormIds] = usePersistedState<string[]>('monitor_read_forms_v2', []);
  const [deletedFormIds, setDeletedFormIds] = usePersistedState<string[]>('monitor_deleted_forms_v2', []);

  // Refs para evitar Stale Closures no setInterval/async functions
  const deletedIdsRef = useRef<string[]>([]);
  const readIdsRef = useRef<string[]>([]);
  const sitesRef = useRef<SiteConfig[]>(DEFAULT_SITES);

  // Mantém os refs sempre atualizados
  useEffect(() => { deletedIdsRef.current = deletedFormIds || []; }, [deletedFormIds]);
  useEffect(() => { readIdsRef.current = readFormIds || []; }, [readFormIds]);
  useEffect(() => { sitesRef.current = sites; }, [sites]);

  // Inicializa Google Identity Services (OAuth)
  useEffect(() => {
    const initGoogleAuth = () => {
      if (window.google && window.google.accounts && !tokenClient.current) {
        try {
          tokenClient.current = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/gmail.readonly',
            prompt: 'consent', // Força tela de consentimento para debug
            callback: (response: any) => {
              if (response.access_token) {
                setGmailToken(response.access_token);
                fetchGmail(response.access_token);
                setAuthError(false);
                setAuthErrorType(null);
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

    // Tenta inicializar e configura um retry caso o script ainda não tenha carregado
    const timer = setInterval(() => {
      if (window.google) {
        initGoogleAuth();
        clearInterval(timer);
      }
    }, 500);

    return () => clearInterval(timer);
  }, []);

  // Solicitar permissão de notificação de forma segura
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(err => console.log('Erro permissão notificação:', err));
      }
    } catch (e) {
      console.log('Notificações não suportadas neste ambiente');
    }
  }, []);

  const sendNotification = (title: string, body: string) => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        if (document.visibilityState === 'hidden' || true) {
           new Notification(title, { 
             body, 
             icon: 'https://tidas.com.br/wp-content/uploads/2025/11/icoapp.png',
             tag: title 
           }); 
        }
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

          // Ordenação: Primeiro os NÃO LIDOS, depois pela Data (mais recente)
          return processedForms.sort((a, b) => {
            if (a.isRead !== b.isRead) {
              return a.isRead ? 1 : -1; // False (Não lido) vem primeiro
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

  // Fetch Real do Gmail
  const fetchGmail = async (tokenOverride?: string) => {
    const token = tokenOverride || gmailToken;
    if (!token) return;
    
    setIsLoadingGmail(true);
    try {
      // Busca 60 mensagens para garantir que não lidos apareçam
      const messages = await fetchGmailMessages(token, 60);
      setEmails(messages);
    } catch (error: any) {
      console.error("Erro ao carregar Gmail:", error);
      if (error.message === 'AUTH_EXPIRED') {
        setGmailToken(null); // Força re-login
      }
    } finally {
      setIsLoadingGmail(false);
    }
  };

  const handleConnectGmail = () => {
    if (GOOGLE_CLIENT_ID.includes('YOUR_CLIENT_ID')) {
      alert('Configuração Necessária: Adicione um Client ID válido no arquivo constants.ts para conectar ao Google.');
      return;
    }

    if (tokenClient.current) {
      setAuthError(false); 
      setAuthErrorType(null);
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

  // Efeito inicial e Loop de Monitoramento
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
       if (isMounted) {
         await checkAllSites();
         await syncForms();
         if (gmailToken) fetchGmail(gmailToken);
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
      }
    }, 60000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gmailToken]); 

  const handleMarkAsRead = (id: string) => {
    if (!readFormIds.includes(id)) {
      const newReadIds = [...readFormIds, id];
      setReadFormIds(newReadIds);
      readIdsRef.current = newReadIds; // Atualiza ref imediatamente
      
      setForms(prev => prev.map(f => f.id === id ? { ...f, isRead: true } : f));
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

  const renderDashboard = () => {
    const onlineCount = sites.filter(s => s.status === SiteStatus.ONLINE).length;

    return (
      <div className="space-y-6 animate-fade-in">
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
        
        {/* Gmail Widget no Dashboard */}
        <div 
          onClick={() => setCurrentView(ViewState.GMAIL)}
          className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-sm cursor-pointer hover:bg-slate-700 active:scale-95 transition-all flex justify-between items-center"
        >
           <div className="flex items-center gap-3">
             <div className="p-2 bg-red-500/10 rounded-full">
               <Mail className="w-5 h-5 text-red-400" />
             </div>
             <div>
               <h3 className="text-sm font-semibold text-slate-100">E-Mail Tidas</h3>
               <p className="text-xs text-slate-400">{gmailToken ? (unreadEmailsCount > 0 ? `${unreadEmailsCount} não lidos` : 'Sem e-mails não lidos') : 'Não conectado'}</p>
             </div>
           </div>
           {gmailToken && unreadEmailsCount > 0 && (
             <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">{unreadEmailsCount}</span>
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

  const renderGmail = () => {
    const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');

    if (!gmailToken) {
      return (
        <div className="pb-20 animate-fade-in flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
          <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 border border-slate-700">
            <Mail className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100 mb-3">Conectar E-Mail Tidas</h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Monitore e-mails importantes diretamente por aqui.
          </p>

          {/* Área de Ajuda e Erro Expandida */}
          {authError ? (
            <div className="rounded-lg p-4 border mb-6 w-full text-left transition-all duration-500 bg-red-900/20 border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.2)]">
               <div className="flex items-start gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                     <p className="font-bold text-red-200 text-sm mb-1">
                       {authErrorType === 'popup_closed' 
                          ? 'Autenticação Interrompida' 
                          : 'Erro na Conexão com Google'}
                     </p>
                     <p className="text-xs text-slate-300 leading-relaxed">
                        {authErrorType === 'popup_closed' 
                          ? 'A janela foi fechada ou bloqueada pelo Google (Erro 400: origin_mismatch).' 
                          : 'Verifique sua conexão e tente novamente.'}
                     </p>
                  </div>
               </div>

               <div className="bg-slate-900/60 p-3 rounded border border-slate-800 text-xs">
                  <p className="font-bold text-slate-400 mb-2 uppercase text-[10px] tracking-wider">Como Corrigir (Obrigatório):</p>
                  <ul className="list-disc pl-4 space-y-2 text-slate-300 marker:text-red-500">
                    <li>Acesse o <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener" className="text-blue-400 hover:underline">Google Cloud Console</a>.</li>
                    <li>
                      Edite a credencial 
                      <span className="block font-mono text-[10px] bg-black/30 px-1 py-0.5 rounded mt-0.5 text-slate-400 break-all">
                        {GOOGLE_CLIENT_ID.substring(0, 15)}...
                      </span>
                    </li>
                    <li>Adicione a URL abaixo em <b>Origens JavaScript autorizadas</b>.</li>
                  </ul>
                  
                  <div className="flex items-center gap-2 mt-3 bg-black/40 rounded p-2 border border-slate-700/50 relative group">
                    <code className="text-emerald-400 break-all flex-1 font-mono text-[10px] pr-14">
                      {typeof window !== 'undefined' ? window.location.origin : '...'}
                    </code>
                    <button 
                      onClick={copyOriginToClipboard}
                      className="absolute right-1 top-1 bottom-1 bg-slate-700 hover:bg-slate-600 text-white text-[10px] px-2 rounded transition-colors flex items-center justify-center"
                    >
                      {copyFeedback ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  
                  <div className="mt-3 space-y-2">
                    {isVercel ? (
                      <p className="text-[10px] text-emerald-400/90 flex items-start gap-1 font-medium">
                        <ShieldCheck className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>
                          Ambiente Vercel detectado! Este endereço é FIXO. Adicione-o apenas uma vez no Google Cloud e funcionará para sempre.
                        </span>
                      </p>
                    ) : (
                       <p className="text-[10px] text-amber-400/80 flex items-start gap-1">
                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>
                          Em ambientes de teste (localhost/idx), a URL muda frequentemente. Você precisará atualizar o Google Cloud se a URL mudar.
                        </span>
                      </p>
                    )}
                  </div>
               </div>
            </div>
          ) : (
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 mb-6 w-full text-left">
               <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-200">Configuração Necessária</span>
               </div>
               <p className="text-[10px] text-slate-400 mb-3">
                 Para o login funcionar, adicione esta URL exata às "Origens JavaScript autorizadas" no Google Cloud:
               </p>
               <div className="flex items-center gap-2 bg-slate-900 rounded p-2 border border-slate-700 relative">
                  <code className="text-[10px] text-slate-300 break-all flex-1 font-mono pr-10">
                    {typeof window !== 'undefined' ? window.location.origin : '...'}
                  </code>
                  <button 
                    onClick={copyOriginToClipboard}
                    className="absolute right-1.5 top-1.5 text-xs p-1.5 rounded transition-all shrink-0 text-slate-400 hover:text-white hover:bg-slate-700"
                  >
                    {copyFeedback ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
               </div>
               {isVercel && (
                  <p className="text-[10px] text-emerald-500 mt-2 flex items-center gap-1">
                    <Check className="w-3 h-3" /> URL Definitiva (Vercel)
                  </p>
               )}
            </div>
          )}

          <button 
            onClick={handleConnectGmail}
            disabled={!isGoogleReady}
            className={`flex items-center gap-3 font-bold px-6 py-3 rounded-xl transition-all w-full justify-center
              ${isGoogleReady 
                ? 'bg-white text-slate-900 hover:bg-slate-200 active:scale-95' 
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'}
            `}
          >
            {isGoogleReady ? (
              <>
                <LogIn className="w-5 h-5" />
                {authError ? 'Tentar Novamente' : 'Entrar com Google'}
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Carregando Google...
              </>
            )}
          </button>
        </div>
      );
    }

    return (
      <div className="pb-20 animate-fade-in">
        <div className="flex justify-between items-center mb-6 px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-100">E-Mail Tidas</h2>
            <span className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded-full">{emails.filter(e => e.isUnread).length} novos</span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleDisconnectGmail}
              className="p-2 text-slate-500 hover:text-red-400 transition-colors"
              title="Desconectar"
            >
              <LogIn className="w-4 h-4 rotate-180" />
            </button>
            <button 
              onClick={() => fetchGmail()}
              className={`p-2 bg-slate-800 text-slate-300 rounded-full hover:bg-slate-700 transition-all ${isLoadingGmail ? 'animate-spin' : ''}`}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-3">
           {emails.length === 0 && !isLoadingGmail && (
             <div className="text-center py-10 text-slate-500">
               <p>Nenhum e-mail recente.</p>
             </div>
           )}
           
           {emails.map(email => (
             <div key={email.id} className={`p-4 rounded-xl border cursor-pointer transition-all ${email.isUnread ? 'bg-slate-800 border-slate-700 shadow-md' : 'bg-slate-900/50 border-slate-800 opacity-70'}`}>
               <div className="flex justify-between items-start mb-1">
                 <div className="flex items-center gap-2 overflow-hidden">
                   <h3 className={`text-sm truncate ${email.isUnread ? 'font-bold text-slate-100' : 'font-medium text-slate-400'}`}>{email.sender}</h3>
                   {email.label === 'Updates' && <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">Updates</span>}
                   {email.label === 'Promotions' && <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">Promo</span>}
                 </div>
                 <span className="text-[10px] text-slate-500 whitespace-nowrap ml-2">
                   {email.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                 </span>
               </div>
               <h4 className={`text-xs mb-1 ${email.isUnread ? 'text-slate-200 font-medium' : 'text-slate-500'}`}>{email.subject}</h4>
               <p className="text-xs text-slate-500 line-clamp-1">{email.snippet}</p>
               <div className="flex justify-end mt-2">
                  <Star className="w-3 h-3 text-slate-600 hover:text-yellow-500 transition-colors" />
               </div>
             </div>
           ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-brand-900 text-slate-100 selection:bg-brand-secondary selection:text-brand-900 font-sans overflow-hidden">
      <div className="sticky top-0 z-40 bg-brand-900/80 backdrop-blur-md border-b border-slate-800 px-4 py-3 mb-6">
        <div className="flex items-center justify-center">
          <img 
            src="https://tidas.com.br/wp-content/uploads/2025/08/logo_tidas_rodan2.svg" 
            alt="Tidas" 
            className="h-12 w-auto object-contain py-0.5"
          />
        </div>
      </div>

      <main className="px-4 pb-24 max-w-md mx-auto h-full overflow-y-auto">
        {currentView === ViewState.DASHBOARD && renderDashboard()}
        {currentView === ViewState.SITES && renderSites()}
        {currentView === ViewState.FORMS && renderForms()}
        {currentView === ViewState.GMAIL && renderGmail()}
      </main>

      <TabNav 
        currentView={currentView} 
        onChangeView={setCurrentView} 
        badges={{ 
          sites: offlineSitesCount > 0, 
          forms: unreadFormsCount,
          gmail: unreadEmailsCount
        }}
      />

      {/* Modal de Detalhes da Mensagem */}
      {selectedForm && (
        <FormDetailsModal 
          form={selectedForm} 
          siteName={sites.find(s => s.id === selectedForm.siteId)?.name || 'Desconhecido'}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
};

export default App;

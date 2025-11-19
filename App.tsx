import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_SITES, MOCK_FORMS } from './constants';
import { SiteConfig, SiteStatus, ViewState, FormSubmission } from './types';
import MonitorCard from './components/MonitorCard';
import InboxItem from './components/InboxItem';
import TabNav from './components/TabNav';
import { fetchFormsFromWP, fetchSiteStats } from './services/wpService';
import { Activity, RefreshCw, AlertTriangle, WifiOff, Trash2, BarChart3 } from 'lucide-react';

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
  
  // Persistência de estados de leitura e exclusão
  const [readFormIds, setReadFormIds] = usePersistedState<string[]>('monitor_read_forms_v2', []);
  const [deletedFormIds, setDeletedFormIds] = usePersistedState<string[]>('monitor_deleted_forms_v2', []);

  // Refs para evitar Stale Closures no setInterval/async functions
  const deletedIdsRef = useRef<string[]>([]);
  const readIdsRef = useRef<string[]>([]);

  // Mantém os refs sempre atualizados
  useEffect(() => { deletedIdsRef.current = deletedFormIds || []; }, [deletedFormIds]);
  useEffect(() => { readIdsRef.current = readFormIds || []; }, [readFormIds]);

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
        new Notification(title, { 
          body, 
          icon: 'https://tidas.com.br/wp-content/uploads/2025/11/icoapp.png' 
        }); 
      }
    } catch (e) {
      console.warn('Falha ao enviar notificação:', e);
    }
  };

  const checkSiteStatus = async (site: SiteConfig): Promise<SiteConfig> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const startTime = performance.now();

    try {
      // 1. Tenta buscar estatísticas via API (Melhor método)
      const stats = await fetchSiteStats(site);
      
      const endTime = performance.now();
      clearTimeout(timeoutId);
      const latency = Math.round(endTime - startTime);

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

      // 2. Fallback HEAD request simples
      await fetch(site.url, { 
        method: 'HEAD', 
        mode: 'no-cors', // Modo opaco, apenas para ver se não dá erro de rede
        signal: controller.signal 
      });
      
      const fallbackLatency = Math.round(performance.now() - startTime);

      return {
        ...site,
        status: SiteStatus.ONLINE,
        lastChecked: new Date(),
        responseTime: fallbackLatency,
        onlineUsers: site.onlineUsers || 0,
        monthlyVisitors: site.monthlyVisitors || 0
      };

    } catch (error) {
      if (site.status === SiteStatus.ONLINE) {
         sendNotification('Alerta de Uptime', `O site ${site.name} parece estar offline.`);
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
    
    // Importante: Usar o estado atual de sites para iterar, mas atualizar o estado de forma funcional
    // Como checkSiteStatus é pura em relação ao objeto site passado, podemos usar map
    const updatedSitesResults = await Promise.all(sites.map(site => checkSiteStatus(site)));
    setSites(updatedSitesResults);
  }, [sites]); // Dependência em sites é ok aqui pois só chamamos manualmente ou no mount

  const syncForms = async () => {
    setIsLoadingForms(true);
    try {
      const promises = sites.map(site => fetchFormsFromWP(site));
      const results = await Promise.all(promises);
      
      const fetchedForms = results.flat();
      
      if (fetchedForms.length > 0) {
        setForms(currentForms => {
          // Filtra usando o valor mais atual do ref (que reflete o localStorage/estado)
          const currentDeletedIds = deletedIdsRef.current || [];
          const currentReadIds = readIdsRef.current || [];
          
          // Filtra forms deletados e forms com data inválida para evitar crash na renderização
          const activeForms = fetchedForms.filter(f => 
            !currentDeletedIds.includes(f.id) && 
            f.timestamp instanceof Date && !isNaN(f.timestamp.getTime())
          );
          
          const processedForms = activeForms.map(f => ({
            ...f,
            isRead: currentReadIds.includes(f.id) ? true : f.isRead
          }));

          // Lógica de notificação para novos forms
          const previousIds = currentForms.map(c => c.id);
          const newArrivals = processedForms.filter(p => 
            !previousIds.includes(p.id) && 
            !p.isRead && 
            !currentDeletedIds.includes(p.id)
          );
          
          if (newArrivals.length > 0) {
             sendNotification('Novo Formulário', `Você recebeu ${newArrivals.length} nova(s) mensagem(ns).`);
          }

          return processedForms.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        });
      }
    } catch (e) {
      console.error("Erro crítico ao sincronizar forms", e);
    } finally {
      setIsLoadingForms(false);
    }
  };

  // Efeito inicial: verifica sites e forms
  useEffect(() => {
    // Usamos uma flag para evitar updates em componente desmontado
    let isMounted = true;

    const init = async () => {
       if (isMounted) {
         await checkAllSites(); // Checa status
         await syncForms();     // Busca forms
       }
    };

    init();

    // Configura um intervalo para atualização automática dos forms a cada 60s
    const intervalId = setInterval(() => {
      if (isMounted) syncForms();
    }, 60000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const handleMarkAsRead = (id: string) => {
    if (!readFormIds.includes(id)) {
      setReadFormIds(prev => [...prev, id]);
      setForms(prev => prev.map(f => f.id === id ? { ...f, isRead: true } : f));
    }
  };

  const handleDismissForm = (id: string) => {
    if (!deletedFormIds.includes(id)) {
        setDeletedFormIds(prev => {
          const newState = [...prev, id];
          deletedIdsRef.current = newState; // Atualiza ref imediatamente para garantir sync
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

  const offlineSitesCount = sites.filter(s => s.status === SiteStatus.OFFLINE).length;
  const unreadFormsCount = forms.filter(f => !f.isRead).length;

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
            onMarkAsRead={() => handleMarkAsRead(form.id)}
            onDismiss={() => handleDismissForm(form.id)}
          />
        );
      })}
    </div>
  );

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
      </main>

      <TabNav 
        currentView={currentView} 
        onChangeView={setCurrentView} 
        badges={{ sites: offlineSitesCount > 0, forms: unreadFormsCount }}
      />
    </div>
  );
};

export default App;
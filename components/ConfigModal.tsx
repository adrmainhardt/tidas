
import React, { useEffect, useState } from 'react';
import { X, Settings, Bell, MapPin, ToggleLeft, ToggleRight, LayoutDashboard, Mail, Calendar, Plus, Trash2, Key, Newspaper, Hash, ArrowUp, ArrowDown, ExternalLink, AlertTriangle } from 'lucide-react';
import { DashboardPrefs } from '../types';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: DashboardPrefs;
  onTogglePreference: (key: keyof DashboardPrefs) => void;
  onReorderDashboard?: (newOrder: string[]) => void;
  onUpdateApiKey: (key: string) => void;
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
  locationEnabled: boolean;
  onToggleLocation: () => void;
  // Calendar Props
  calendarIds?: string[];
  onAddCalendar?: (id: string) => void;
  onRemoveCalendar?: (id: string) => void;
  // News Props
  onAddNewsTopic?: (topic: string) => void;
  onRemoveNewsTopic?: (topic: string) => void;
}

const ConfigModal: React.FC<ConfigModalProps> = ({ 
    isOpen, onClose, 
    preferences, onTogglePreference, onReorderDashboard, onUpdateApiKey,
    notificationsEnabled, onToggleNotifications,
    locationEnabled, onToggleLocation,
    calendarIds = [], onAddCalendar, onRemoveCalendar,
    onAddNewsTopic, onRemoveNewsTopic
}) => {
  
  const [isVisible, setIsVisible] = useState(false);
  const [newCalendarInput, setNewCalendarInput] = useState('');
  const [newTopicInput, setNewTopicInput] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState(preferences.googleApiKey || '');
  const [apiKeyWarning, setApiKeyWarning] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      document.body.style.overflow = 'hidden';
      setApiKeyInput(preferences.googleApiKey || '');
      setApiKeyWarning(null);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      document.body.style.overflow = 'unset';
      return () => clearTimeout(timer);
    }
  }, [isOpen, preferences.googleApiKey]);

  const validateApiKey = (key: string) => {
      const trimmed = key.trim();
      if (trimmed.length > 0) {
          if (!trimmed.startsWith('AIza')) {
              setApiKeyWarning("Isso não parece uma API Key válida (deve começar com 'AIza'). Você pode ter copiado o ID do Cliente por engano.");
          } else if (trimmed.includes('googleusercontent.com')) {
              setApiKeyWarning("Este é um ID de Cliente OAuth, não uma API Key. Crie uma 'Chave de API' no console.");
          } else {
              setApiKeyWarning(null);
          }
      } else {
          setApiKeyWarning(null);
      }
      setApiKeyInput(trimmed);
  };

  const handleSave = () => {
    onUpdateApiKey(apiKeyInput.trim());
    onClose();
  };

  const handleAddTopic = () => {
    if (newTopicInput.trim() && onAddNewsTopic) {
        onAddNewsTopic(newTopicInput.trim());
        setNewTopicInput('');
    }
  };

  const extractCalendarId = (input: string): string | null => {
    if (!input || !input.trim()) return null;

    try {
      let cleaned = input.trim();
      
      try {
        cleaned = decodeURIComponent(cleaned);
      } catch (e) {}

      const srcMatch = cleaned.match(/src=([^&]+)/);
      if (srcMatch && srcMatch[1]) return srcMatch[1];
      
      const icalMatch = cleaned.match(/\/ical\/([^/]+)\//);
      if (icalMatch && icalMatch[1]) return icalMatch[1];

      const cidMatch = cleaned.match(/cid=([^&]+)/);
      if (cidMatch && cidMatch[1]) return cidMatch[1];

      if (cleaned.includes('@') && !cleaned.includes('http') && !cleaned.includes('calendar.google.com')) {
        return cleaned;
      }

      const emailMatch = cleaned.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
      if (emailMatch && emailMatch[1]) return emailMatch[1];

      return null;
    } catch (e) {
      return null;
    }
  };

  const handleAddCalendar = () => {
    if (!newCalendarInput || !onAddCalendar) return;
    const extractedId = extractCalendarId(newCalendarInput);
    if (extractedId) {
       onAddCalendar(extractedId);
       setNewCalendarInput('');
    } else {
       alert("ID inválido.");
    }
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
      if (!onReorderDashboard || !preferences.dashboardOrder) return;
      const newOrder = [...preferences.dashboardOrder];
      if (direction === 'up') {
          if (index === 0) return;
          [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      } else {
          if (index === newOrder.length - 1) return;
          [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
      }
      onReorderDashboard(newOrder);
  };

  if (!isVisible && !isOpen) return null;

  const currentOrder = preferences.dashboardOrder || ['insight', 'news', 'weather', 'shortcuts', 'sites_list'];
  
  const blockNames: Record<string, string> = {
      insight: 'Insight do Dia',
      news: 'Destaques Notícias',
      weather: 'Clima',
      shortcuts: 'Atalhos (Grade)',
      sites_list: 'Lista de Sites',
      notifications: 'Botão Notificações'
  };

  const ToggleItem = ({ label, icon: Icon, checked, onChange, description }: any) => (
    <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${checked ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <p className="font-medium text-sm text-slate-200">{label}</p>
                {description && <p className="text-[10px] text-slate-500">{description}</p>}
            </div>
        </div>
        <button onClick={onChange} className="text-slate-300 hover:text-white transition-colors">
            {checked ? <ToggleRight className="w-8 h-8 text-blue-500" /> : <ToggleLeft className="w-8 h-8 text-slate-600" />}
        </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      
      <div 
        className={`absolute inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      <div 
        className={`relative w-[90%] max-w-[380px] h-full bg-slate-800 border-l border-slate-700 shadow-2xl flex flex-col transform transition-transform duration-300 ease-out pt-safe-area ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-5 border-b border-slate-700 bg-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-300" />
                <span className="font-bold text-lg text-slate-100">Configurações</span>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-700 transition-colors">
                <X className="w-6 h-6" />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
            
            <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Credenciais</h3>
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-2 mb-2">
                        <Key className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold text-slate-300">Google API Key (Pública)</span>
                    </div>
                    
                    <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800/50 mb-3 space-y-2">
                        <p className="text-[10px] text-slate-400 font-bold">
                            Não tem uma chave? Siga os passos:
                        </p>
                        <ol className="text-[10px] text-slate-500 list-decimal pl-3 space-y-1">
                            <li>Acesse o <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="text-blue-400 underline">Google Console</a>.</li>
                            <li>No topo, clique em <span className="font-bold text-slate-300">+ CRIAR CREDENCIAIS</span>.</li>
                            <li>Selecione <span className="font-bold text-slate-300">Chave de API</span> (API Key).</li>
                            <li>Copie o código que começa com <code className="bg-slate-800 px-1 rounded text-amber-500">AIza</code>.</li>
                        </ol>
                    </div>

                    <input 
                        type="text" 
                        value={apiKeyInput}
                        onChange={(e) => validateApiKey(e.target.value)}
                        placeholder="Cole sua chave AIza... aqui"
                        className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-amber-500 ${apiKeyWarning ? 'border-rose-500/50 focus:border-rose-500' : 'border-slate-700'}`}
                    />
                    {apiKeyWarning && (
                        <div className="mt-2 flex items-start gap-1.5 text-rose-400 text-[10px] leading-tight bg-rose-950/20 p-2 rounded border border-rose-900/50">
                            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                            <span>{apiKeyWarning}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Layout e Ordem</h3>
                <div className="bg-slate-900/30 rounded-xl border border-slate-800 overflow-hidden">
                    {currentOrder.filter(id => id !== 'notifications').map((id, index, arr) => (
                        <div key={id} className="flex items-center justify-between p-3 border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30">
                            <span className="text-sm font-medium text-slate-300">{blockNames[id] || id}</span>
                            <div className="flex gap-1">
                                <button 
                                    onClick={() => moveItem(currentOrder.indexOf(id), 'up')} 
                                    disabled={currentOrder.indexOf(id) === 0}
                                    className="p-1 text-slate-500 hover:text-white disabled:opacity-20 hover:bg-slate-700 rounded"
                                >
                                    <ArrowUp className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => moveItem(currentOrder.indexOf(id), 'down')} 
                                    disabled={currentOrder.indexOf(id) === currentOrder.length - 1}
                                    className="p-1 text-slate-500 hover:text-white disabled:opacity-20 hover:bg-slate-700 rounded"
                                >
                                    <ArrowDown className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Atalhos Visíveis</h3>
                <ToggleItem 
                    label="Lista de Sites" 
                    icon={LayoutDashboard} 
                    checked={preferences.showSites} 
                    onChange={() => onTogglePreference('showSites')} 
                />
                <ToggleItem 
                    label="Trello" 
                    icon={LayoutDashboard} 
                    checked={preferences.showTrello} 
                    onChange={() => onTogglePreference('showTrello')} 
                />
                <ToggleItem 
                    label="Google E-mail" 
                    icon={Mail} 
                    checked={preferences.showGoogle} 
                    onChange={() => onTogglePreference('showGoogle')} 
                />
                <ToggleItem 
                    label="Google Agenda" 
                    icon={Calendar} 
                    checked={preferences.showCalendar} 
                    onChange={() => onTogglePreference('showCalendar')} 
                />
                <ToggleItem 
                    label="Clima Widget" 
                    icon={LayoutDashboard} 
                    checked={preferences.showWeather} 
                    onChange={() => onTogglePreference('showWeather')} 
                />
            </div>

            {/* Configuração de Notícias */}
            {onAddNewsTopic && onRemoveNewsTopic && (
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Notícias</h3>
                    <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                        <p className="text-[10px] text-slate-400 mb-2">
                            Assuntos de interesse para o feed:
                        </p>
                        <div className="flex gap-2 mb-3">
                            <input 
                                type="text" 
                                value={newTopicInput}
                                onChange={(e) => setNewTopicInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddTopic()}
                                placeholder="Novo assunto (ex: Tecnologia)..."
                                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs text-slate-200 outline-none focus:border-emerald-500"
                            />
                            <button onClick={handleAddTopic} className="bg-emerald-600 text-white p-2 rounded-lg hover:bg-emerald-500">
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                            {preferences.newsTopics && preferences.newsTopics.map(topic => (
                                <div key={topic} className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-full border border-slate-700/50">
                                    <Hash className="w-3 h-3 text-slate-500" />
                                    <span className="text-[10px] text-slate-300 font-medium">{topic}</span>
                                    <button onClick={() => onRemoveNewsTopic(topic)} className="ml-1 text-slate-500 hover:text-rose-400">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            {(!preferences.newsTopics || preferences.newsTopics.length === 0) && <p className="text-[10px] text-slate-600 italic py-1">Nenhum assunto definido.</p>}
                        </div>
                    </div>
                </div>
            )}

            {onAddCalendar && onRemoveCalendar && (
               <div className="space-y-3">
                   <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Agendas</h3>
                   <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                       <p className="text-[10px] text-slate-400 mb-2">
                           Adicione agendas por URL ou ID:
                       </p>
                       <div className="flex gap-2 mb-3">
                           <input 
                              type="text" 
                              value={newCalendarInput}
                              onChange={(e) => setNewCalendarInput(e.target.value)}
                              placeholder="URL ou ID da agenda..."
                              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                           />
                           <button onClick={handleAddCalendar} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-500">
                               <Plus className="w-4 h-4" />
                           </button>
                       </div>
                       
                       <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                           {calendarIds.map(id => (
                               <div key={id} className="flex justify-between items-center bg-slate-800 p-2 rounded border border-slate-700/50">
                                   <div className="flex items-center gap-2 overflow-hidden">
                                       <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                                       <span className="text-[10px] text-slate-300 truncate max-w-[170px]" title={id}>{id}</span>
                                   </div>
                                   <button onClick={() => onRemoveCalendar(id)} className="text-rose-400 hover:text-rose-300 p-1 hover:bg-rose-900/20 rounded">
                                       <Trash2 className="w-3 h-3" />
                                   </button>
                               </div>
                           ))}
                           {calendarIds.length === 0 && <p className="text-[10px] text-slate-600 italic text-center py-2">Nenhuma agenda extra.</p>}
                       </div>
                   </div>
               </div>
            )}

            <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Sistema</h3>
                <ToggleItem 
                    label="Notificações" 
                    icon={Bell} 
                    checked={notificationsEnabled} 
                    onChange={onToggleNotifications} 
                    description="Receber alertas de sites offline."
                />
                <ToggleItem 
                    label="Localização" 
                    icon={MapPin} 
                    checked={locationEnabled} 
                    onChange={onToggleLocation} 
                    description="Usada para previsão do tempo."
                />
            </div>

        </div>
        
        <div className="p-4 border-t border-slate-700 bg-slate-800/50 text-center pb-safe-area">
            <button onClick={handleSave} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 active:scale-95 transition-transform">
                Salvar Alterações
            </button>
        </div>
      </div>
    </div>
  );
};

export default ConfigModal;

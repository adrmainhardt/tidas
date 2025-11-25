
import React, { useEffect, useState } from 'react';
import { X, Settings, Bell, MapPin, ToggleLeft, ToggleRight, LayoutDashboard, Calendar, Link, Plus, Trash2, HelpCircle } from 'lucide-react';
import { DashboardPrefs } from '../types';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: DashboardPrefs;
  onTogglePreference: (key: keyof DashboardPrefs) => void;
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
  locationEnabled: boolean;
  onToggleLocation: () => void;
  onUpdateCalendar: (ids: string[]) => void;
}

const ConfigModal: React.FC<ConfigModalProps> = ({ 
    isOpen, onClose, 
    preferences, onTogglePreference, 
    notificationsEnabled, onToggleNotifications,
    locationEnabled, onToggleLocation,
    onUpdateCalendar
}) => {
  
  const [isVisible, setIsVisible] = useState(false);
  const [calendarIds, setCalendarIds] = useState<string[]>(preferences.calendarIds || []);
  const [newCalInput, setNewCalInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      document.body.style.overflow = 'hidden';
      setCalendarIds(preferences.calendarIds || []);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      document.body.style.overflow = 'unset';
      return () => clearTimeout(timer);
    }
  }, [isOpen, preferences]);

  if (!isVisible && !isOpen) return null;

  // Extrai ID do calendário de URLs CID, Embed, ICS ou texto puro
  const extractCalendarId = (input: string): string => {
    try {
        let clean = input.trim();
        // Remove aspas caso o usuário tenha copiado de algum JSON/HTML
        clean = clean.replace(/['"]/g, '');

        // Caso 1: Input direto de ID (ex: email ou group id)
        // Se não tem http/https e tem @ ou # ou termina com google.com
        if (!clean.startsWith('http') && (clean.includes('@') || clean.includes('#') || clean.endsWith('google.com'))) {
            return decodeURIComponent(clean);
        }

        // Caso 2: URLs
        if (clean.startsWith('http')) {
            const urlObj = new URL(clean);

            // A. Link ICS (ex: .../ical/ID/public/basic.ics)
            if (urlObj.pathname.includes('/ical/')) {
                // Estrutura comum: /calendar/ical/{ID}/public/basic.ics
                const parts = urlObj.pathname.split('/ical/');
                if (parts.length > 1) {
                    const idPart = parts[1].split('/')[0];
                    if (idPart) return decodeURIComponent(idPart);
                }
            }

            // B. Parameter 'src' (Link de Embed/Publico)
            const srcParam = urlObj.searchParams.get('src');
            if (srcParam) return decodeURIComponent(srcParam);

            // C. Parameter 'cid' (Link de Compartilhamento)
            const cidParam = urlObj.searchParams.get('cid');
            if (cidParam) {
                try {
                    const decoded = atob(cidParam);
                    if (decoded.includes('@') || decoded.includes('#')) return decoded;
                } catch (e) {}
                return decodeURIComponent(cidParam);
            }
        }
        
        // Fallback: Tenta decodificar e ver se parece um ID mesmo que tenha passado despercebido
        const decodedFallback = decodeURIComponent(clean);
        if (decodedFallback.includes('@') || decodedFallback.includes('#')) {
            return decodedFallback;
        }
        
    } catch (error) {
        console.error("Erro ao processar link:", error);
    }
    
    return '';
  };

  const handleAddCalendarId = () => {
      if (!newCalInput) return;
      
      const extractedId = extractCalendarId(newCalInput);
      
      if (extractedId) {
          if (!calendarIds.includes(extractedId)) {
              const newIds = [...calendarIds, extractedId];
              setCalendarIds(newIds);
              setNewCalInput('');
              // Feedback visual imediato para o usuário saber que funcionou
              alert(`Agenda adicionada: ${extractedId}\nClique em "Salvar Alterações" para confirmar.`);
          } else {
              alert("Esta agenda já está na lista.");
          }
      } else {
          alert("Não foi possível identificar o ID da Agenda neste link.\n\nTente usar:\n1. O ID direto (ex: usuario@gmail.com)\n2. Link ICS Público\n3. Link de Incorporação (Embed)");
      }
  };

  const handleRemoveCalendarId = (id: string) => {
      setCalendarIds(calendarIds.filter(c => c !== id));
  };

  const handleSave = () => {
    onUpdateCalendar(calendarIds);
    onClose();
  };

  const ToggleItem = ({ label, icon: Icon, checked, onChange, description }: any) => (
    <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-800">
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
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Visualização</h3>
                <ToggleItem 
                    label="Sites & Forms" 
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
                    label="Google Workspace" 
                    icon={LayoutDashboard} 
                    checked={preferences.showGoogle} 
                    onChange={() => onTogglePreference('showGoogle')} 
                />
                <ToggleItem 
                    label="Clima" 
                    icon={LayoutDashboard} 
                    checked={preferences.showWeather} 
                    onChange={() => onTogglePreference('showWeather')} 
                />
            </div>

            <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 flex items-center gap-2">
                    Agenda Google <Calendar className="w-3 h-3" />
                </h3>
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 space-y-3">
                    <p className="text-[10px] text-slate-400 leading-tight">
                        Cole o link público (ICS), Embed ou ID da agenda para monitorar.
                    </p>
                    
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={newCalInput}
                            onChange={(e) => setNewCalInput(e.target.value)}
                            placeholder="Link ICS, ID ou Embed..."
                            className="flex-1 bg-slate-800 border border-slate-700 rounded p-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                        />
                        <button onClick={handleAddCalendarId} className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors">
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="pt-2 space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Agendas Monitoradas</label>
                        <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                            {/* Mostra a principal apenas visualmente se não estiver explicitamente na lista, mas o serviço lida com isso */}
                            <div className="flex justify-between items-center text-xs bg-slate-800/50 p-2 rounded border border-slate-700/50 opacity-70">
                                <span className="text-blue-300 font-medium">Conta Conectada (Login)</span>
                                <span className="text-[9px] bg-slate-700 px-1 rounded text-slate-400">Auto</span>
                            </div>
                            
                            {calendarIds.map(id => (
                                <div key={id} className="flex justify-between items-center text-xs bg-slate-800 p-2 rounded border border-slate-700 animate-fade-in">
                                    <span className="truncate max-w-[180px] text-slate-300" title={id}>{id}</span>
                                    <button onClick={() => handleRemoveCalendarId(id)} className="text-rose-400 hover:text-rose-300 p-1 hover:bg-rose-400/10 rounded">
                                        <Trash2 className="w-3 h-3"/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Sistema</h3>
                <ToggleItem 
                    label="Notificações" 
                    icon={Bell} 
                    checked={notificationsEnabled} 
                    onChange={onToggleNotifications} 
                    description="Receber alertas de sites offline e mensagens."
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

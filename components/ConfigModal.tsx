

import React, { useEffect, useState } from 'react';
import { X, Settings, Bell, MapPin, ToggleLeft, ToggleRight, LayoutDashboard, Calendar, Link, Plus, Trash2 } from 'lucide-react';
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
  onUpdateCalendar: (mode: 'api' | 'embed', url?: string, ids?: string[]) => void;
}

const ConfigModal: React.FC<ConfigModalProps> = ({ 
    isOpen, onClose, 
    preferences, onTogglePreference, 
    notificationsEnabled, onToggleNotifications,
    locationEnabled, onToggleLocation,
    onUpdateCalendar
}) => {
  
  const [isVisible, setIsVisible] = useState(false);
  const [calUrl, setCalUrl] = useState(preferences.calendarEmbedUrl || '');
  const [calendarIds, setCalendarIds] = useState<string[]>(preferences.calendarIds || []);
  const [newCalInput, setNewCalInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      document.body.style.overflow = 'hidden';
      setCalUrl(preferences.calendarEmbedUrl || '');
      setCalendarIds(preferences.calendarIds || []);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      document.body.style.overflow = 'unset';
      return () => clearTimeout(timer);
    }
  }, [isOpen, preferences]);

  if (!isVisible && !isOpen) return null;

  // Extrai ID do calendário de URLs ou retorna o próprio texto
  const extractCalendarId = (input: string): string => {
    let clean = input.trim();
    // Decodifica CID base64 se presente
    if (clean.includes('cid=')) {
        try {
            const urlObj = new URL(clean);
            const cid = urlObj.searchParams.get('cid');
            if (cid && /^[A-Za-z0-9+/=]+$/.test(cid)) {
                const decoded = atob(cid);
                if (decoded.includes('@')) return decoded;
            }
        } catch (e) {}
    }
    // Se for email simples ou ID
    if (clean.includes('@') || clean.includes('#')) return clean;
    return clean;
  };

  const handleAddCalendarId = () => {
      if (!newCalInput) return;
      const id = extractCalendarId(newCalInput);
      if (id && !calendarIds.includes(id)) {
          setCalendarIds([...calendarIds, id]);
      }
      setNewCalInput('');
  };

  const handleRemoveCalendarId = (id: string) => {
      setCalendarIds(calendarIds.filter(c => c !== id));
  };

  const handleSave = () => {
    onUpdateCalendar(preferences.calendarMode, calUrl, calendarIds);
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
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Agenda Google</h3>
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-4 h-4 text-indigo-400" />
                        <span className="text-sm font-bold text-slate-200">Modo de Exibição</span>
                    </div>
                    <div className="flex bg-slate-800 p-1 rounded-lg mb-3">
                        <button 
                            onClick={() => onUpdateCalendar('api', calUrl, calendarIds)}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${preferences.calendarMode === 'api' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            API (Login)
                        </button>
                        <button 
                            onClick={() => onUpdateCalendar('embed', calUrl, calendarIds)}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${preferences.calendarMode === 'embed' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            Incorporado
                        </button>
                    </div>

                    {preferences.calendarMode === 'api' && (
                        <div className="space-y-2">
                            <label className="text-[10px] text-slate-400 block">Adicionar Agenda (ID ou Link CID)</label>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={newCalInput}
                                    onChange={(e) => setNewCalInput(e.target.value)}
                                    placeholder="Ex: design02@tidas..."
                                    className="flex-1 bg-slate-800 border border-slate-700 rounded p-2 text-xs text-slate-200 outline-none"
                                />
                                <button onClick={handleAddCalendarId} className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded">
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="max-h-32 overflow-y-auto space-y-1 pt-2">
                                {calendarIds.map(id => (
                                    <div key={id} className="flex justify-between items-center text-xs bg-slate-800 p-2 rounded border border-slate-700">
                                        <span className="truncate max-w-[180px] text-slate-300">{id}</span>
                                        <button onClick={() => handleRemoveCalendarId(id)} className="text-rose-400 hover:text-rose-300"><Trash2 className="w-3 h-3"/></button>
                                    </div>
                                ))}
                                {calendarIds.length === 0 && <p className="text-[10px] text-slate-500 italic">Apenas agenda principal.</p>}
                            </div>
                        </div>
                    )}

                    {preferences.calendarMode === 'embed' && (
                        <div className="pt-2 border-t border-slate-700/50">
                            <label className="text-[10px] text-slate-400 block mb-1">URL da Agenda Pública</label>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={calUrl}
                                    onChange={(e) => setCalUrl(e.target.value)}
                                    placeholder="https://..."
                                    className="flex-1 bg-slate-800 border border-slate-700 rounded p-2 text-xs text-slate-200 outline-none"
                                />
                            </div>
                        </div>
                    )}
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
                    description="Usada para previsão do tempo e trânsito."
                />
            </div>

        </div>
        
        <div className="p-4 border-t border-slate-700 bg-slate-800/50 text-center pb-safe-area">
            <button onClick={handleSave} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 active:scale-95 transition-transform">
                Salvar e Fechar
            </button>
        </div>
      </div>
    </div>
  );
};

export default ConfigModal;
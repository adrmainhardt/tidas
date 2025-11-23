import React, { useEffect, useState } from 'react';
import { X, Settings, Eye, Bell, MapPin, ToggleLeft, ToggleRight, LayoutDashboard } from 'lucide-react';
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
}

const ConfigModal: React.FC<ConfigModalProps> = ({ 
    isOpen, onClose, 
    preferences, onTogglePreference, 
    notificationsEnabled, onToggleNotifications,
    locationEnabled, onToggleLocation
}) => {
  
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      document.body.style.overflow = 'hidden';
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      document.body.style.overflow = 'unset';
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible && !isOpen) return null;

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
        className={`relative w-[85%] max-w-[360px] h-full bg-slate-800 border-l border-slate-700 shadow-2xl flex flex-col transform transition-transform duration-300 ease-out pt-safe-area ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
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
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Tela Inicial</h3>
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
                    description="Usada para exibir a previsão do tempo."
                />
            </div>

        </div>
        
        <div className="p-4 border-t border-slate-700 bg-slate-800/50 text-center pb-safe-area">
            <button onClick={onClose} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 active:scale-95 transition-transform">
                Salvar e Fechar
            </button>
        </div>
      </div>
    </div>
  );
};

export default ConfigModal;
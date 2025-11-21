
import React from 'react';
import { ViewState } from '../types';
import { LayoutDashboard, Globe, Briefcase, Trello } from 'lucide-react';

interface TabNavProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  badges: {
    sites: boolean; // True se tiver site offline
    forms: number;  // Número de forms não lidos
    google?: number; // Soma de emails + eventos
    trello?: number; // Número de novos cartões
  };
}

const TabNav: React.FC<TabNavProps> = ({ currentView, onChangeView, badges }) => {
  const navItems = [
    { id: ViewState.DASHBOARD, label: 'Início', icon: LayoutDashboard },
    { id: ViewState.WEBSITES, label: 'Sites', icon: Globe, badgeCount: badges.forms, alert: badges.sites },
    { id: ViewState.GOOGLE, label: 'Google', icon: Briefcase, badgeCount: badges.google },
    { id: ViewState.TRELLO, label: 'Trello', icon: Trello, badgeCount: badges.trello },
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full bg-slate-900 border-t border-slate-800 pb-safe-area z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)]">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={`relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors duration-200 ${
                isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'fill-current/10' : ''}`} />
                
                {/* Alert para Sites Offline */}
                {item.alert && (
                   <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-slate-900 animate-pulse"></span>
                )}

                {/* Badge Numérico */}
                {(item.badgeCount || 0) > 0 && (
                  <span className="absolute -top-2 -right-3 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border-2 border-slate-900 min-w-[18px] flex justify-center shadow-sm">
                    {item.badgeCount && item.badgeCount > 9 ? '9+' : item.badgeCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TabNav;

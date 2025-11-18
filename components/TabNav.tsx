import React from 'react';
import { ViewState } from '../types';
import { LayoutDashboard, Globe, MessageSquareText } from 'lucide-react';

interface TabNavProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  badges: {
    sites: boolean; // True se tiver site offline
    forms: number;  // Número de forms não lidos
  };
}

const TabNav: React.FC<TabNavProps> = ({ currentView, onChangeView, badges }) => {
  const navItems = [
    { id: ViewState.DASHBOARD, label: 'Início', icon: LayoutDashboard },
    { id: ViewState.SITES, label: 'Sites', icon: Globe, badge: badges.sites },
    { id: ViewState.FORMS, label: 'Forms', icon: MessageSquareText, badgeCount: badges.forms },
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full bg-slate-900 border-t border-slate-800 pb-safe-area z-50">
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
                <Icon className={`w-6 h-6 ${isActive ? 'fill-current/10' : ''}`} />
                
                {/* Badge para Sites (Bolinha simples se tiver erro) */}
                {item.id === ViewState.SITES && item.badge && (
                   <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-slate-900"></span>
                )}

                {/* Badge para Forms (Contador) */}
                {item.id === ViewState.FORMS && (item.badgeCount || 0) > 0 && (
                  <span className="absolute -top-2 -right-3 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border-2 border-slate-900 min-w-[18px] flex justify-center">
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
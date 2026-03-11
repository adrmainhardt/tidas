import React from 'react';
import { Menu, LayoutDashboard, Megaphone, PlusCircle, CheckCircle, XCircle, Play, Pause, Users, Settings, BrainCircuit, Briefcase } from 'lucide-react';
import { Tab } from '../types';
import { LOGO_URL } from '../constants';

interface SidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  isPlaying?: boolean;
  progress?: number;
  onTogglePlay?: () => void;
  onShowAi?: () => void;
  onShowSettings?: () => void;
  onRefresh?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  theme: 'dark' | 'light';
  lastUpdated?: string | null;
  isRefreshing?: boolean;
  refreshError?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  isPlaying = false, 
  progress = 0, 
  onTogglePlay,
  onShowAi,
  onShowSettings,
  onRefresh,
  isCollapsed = false,
  onToggleCollapse,
  theme,
  lastUpdated,
  isRefreshing,
  refreshError
}) => {
  const menuItems = [
    { id: Tab.HOME, label: 'Visão Geral', icon: LayoutDashboard },
    { id: Tab.MARKETING, label: 'Marketing', icon: Megaphone },
    { id: Tab.NEW_BUSINESS, label: 'Novos Negócios', icon: PlusCircle },
    { id: Tab.WON, label: 'Negócios Ganhos', icon: CheckCircle },
    { id: Tab.LOST, label: 'Negócios Perdidos', icon: XCircle },
    { id: Tab.COMMERCIAL_DATA, label: 'Dados Comerciais', icon: Briefcase },
    { id: Tab.OTHERS, label: 'Outros', icon: Users },
  ];

  return (
    <div className={`h-full ${isCollapsed ? 'w-20' : 'w-64'} flex-shrink-0 flex flex-col border-r border-[var(--border)] bg-[var(--bg-sidebar)] shadow-2xl z-10 transition-all duration-500 ease-in-out`}>
      <div className={`p-6 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} border-b border-[var(--border)] bg-[var(--bg-sidebar-header)]`}>
        {!isCollapsed && (
          <img 
            src={LOGO_URL} 
            alt="Tidas Logo" 
            className="h-[1.75rem] w-auto object-contain"
          />
        )}
        <button 
          onClick={onToggleCollapse}
          className="p-2 rounded-lg hover:bg-white/5 text-gray-400 transition-colors opacity-40 hover:opacity-100"
          title={isCollapsed ? "Expandir Menu" : "Recolher Menu"}
        >
          <Menu size={20} />
        </button>
      </div>
      
      <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (isPlaying && onTogglePlay) onTogglePlay(); // Pause if user manually clicks
              }}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-4'} py-3 rounded-xl transition-all duration-300 group ${
                isActive 
                  ? 'bg-[var(--accent-muted)] text-[var(--accent)]' 
                  : 'text-[var(--text-muted)] hover:bg-[var(--text-main)]/5 hover:text-[var(--text-main)]'
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon 
                size={22} 
                className={`${isCollapsed ? '' : 'mr-3'} transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} 
              />
              {!isCollapsed && <span className="font-medium text-sm lg:text-base">{item.label}</span>}
              {isActive && !isCollapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
              )}
            </button>
          );
        })}
      </nav>
      
      {!isCollapsed && (
        <div className={`relative p-6 bg-[var(--bg-sidebar-header)]/50`}>
          {/* Progress Line (acting as border-t) */}
          <div className="absolute top-0 left-0 h-[1px] bg-[var(--border)] w-full" />
          <div 
            className="absolute top-0 left-0 h-[1px] bg-[var(--accent)] transition-all duration-100 ease-linear shadow-[0_0_8px_var(--accent)]"
            style={{ width: `${progress}%` }}
          />

          <div className={`flex items-center gap-2`}>
            <button 
              onClick={onShowAi}
              className={`flex-[2] px-3 py-2 flex items-center justify-center rounded-lg bg-[var(--text-main)]/[0.03] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--text-main)]/10 transition-all`}
              title="Análise (AI)"
            >
              <span className="text-xs font-bold whitespace-nowrap">Análise (AI)</span>
            </button>
            
            <div className={`flex flex-1 items-center gap-2`}>
              <button 
                onClick={onShowSettings}
                className="w-full flex items-center justify-center p-2 rounded-lg bg-[var(--text-main)]/[0.03] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--text-main)]/10 transition-all"
                title="Configurações"
              >
                <Settings size={18} />
              </button>
              
              <button 
                onClick={onTogglePlay}
                className={`w-full flex items-center justify-center p-2 rounded-lg transition-all ${isPlaying ? 'bg-[var(--accent-muted)] text-[var(--accent)]' : 'bg-[var(--text-main)]/[0.03] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--text-main)]/10'}`}
                title={isPlaying ? "Pausar" : "Iniciar Slideshow"}
              >
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
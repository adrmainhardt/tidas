
import React, { useEffect, useState } from 'react';
import { Sparkles, Globe, MessageSquareText, Mail, Trello, X, ChevronRight, Calendar } from 'lucide-react';

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string, subTab?: string) => void;
  onGenerateInsight: () => void;
  badges: {
    forms: number;
    emails: number;
    trello: number;
  };
}

const SideMenu: React.FC<SideMenuProps> = ({ isOpen, onClose, onNavigate, onGenerateInsight, badges }) => {
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

  const menuItems = [
    { 
      label: 'Insight do Dia', 
      icon: Sparkles, 
      action: () => { onGenerateInsight(); onClose(); },
      color: 'text-yellow-400',
      bg: 'bg-yellow-400/10'
    },
    { 
      label: 'Sites', 
      icon: Globe, 
      action: () => { onNavigate('WEBSITES', 'status'); onClose(); },
      color: 'text-emerald-400',
      bg: 'bg-emerald-400/10'
    },
    { 
      label: 'Formulários', 
      icon: MessageSquareText, 
      action: () => { onNavigate('WEBSITES', 'forms'); onClose(); },
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
      badge: badges.forms
    },
    { 
      label: 'E-Mails', 
      icon: Mail, 
      action: () => { onNavigate('GOOGLE', 'mail'); onClose(); },
      color: 'text-rose-400',
      bg: 'bg-rose-400/10',
      badge: badges.emails
    },
    { 
      label: 'Agenda', 
      icon: Calendar, 
      action: () => { onNavigate('CALENDAR'); onClose(); },
      color: 'text-purple-400',
      bg: 'bg-purple-400/10'
    },
    { 
      label: 'Trello', 
      icon: Trello, 
      action: () => { onNavigate('TRELLO'); onClose(); },
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      badge: badges.trello
    }
  ];

  return (
    // Alterado: justify-start para alinhar à esquerda
    <div className="fixed inset-0 z-[100] flex justify-start">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Drawer na Esquerda */}
      <div 
        className={`relative w-[80%] max-w-[300px] h-full bg-slate-800 border-r border-slate-800 shadow-2xl transform transition-transform duration-300 ease-out pt-safe-area flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-5 flex justify-between items-center border-b border-slate-800">
           <span className="font-bold text-lg text-slate-100">Menu</span>
           <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-700">
             <X className="w-6 h-6" />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
           {menuItems.map((item, idx) => {
             const Icon = item.icon;
             return (
               <button 
                 key={idx}
                 onClick={item.action}
                 className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-slate-800/50 active:scale-95 transition-all border border-transparent hover:border-slate-800 group"
               >
                 <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-lg ${item.bg}`}>
                        <Icon className={`w-5 h-5 ${item.color}`} />
                    </div>
                    <span className="font-medium text-slate-200">{item.label}</span>
                 </div>
                 <div className="flex items-center gap-2">
                    {item.badge !== undefined && item.badge > 0 && (
                        <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                            {item.badge}
                        </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
                 </div>
               </button>
             );
           })}
        </div>

        <div className="p-6 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-600">Tidas App v2.2</p>
        </div>
      </div>
    </div>
  );
};

export default SideMenu;

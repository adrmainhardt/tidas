
import React from 'react';
import { Car, Clock, MapPin } from 'lucide-react';

interface TrafficWidgetProps {
  origin: string;
  destination: string;
  info?: string | null;
  onRefresh?: () => void;
}

const TrafficWidget: React.FC<TrafficWidgetProps> = ({ info, onRefresh }) => {
  // Tratamento de status
  let displayInfo = info;
  let statusColor = "text-slate-100";
  
  if (!info) displayInfo = "---";
  if (info === 'LIMIT_REACHED') {
      displayInfo = "Tente mais tarde";
      statusColor = "text-amber-400 text-sm";
  }
  if (info === 'Erro' || info === 'Erro API') {
      displayInfo = "Indisponível";
      statusColor = "text-rose-400 text-lg";
  }
  if (info?.includes('...')) {
      statusColor = "text-lg text-slate-400 animate-pulse";
  }

  return (
    <div 
      onClick={onRefresh}
      className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-4 shadow-lg relative overflow-hidden cursor-pointer active:scale-[0.98] transition-all"
    >
      
      <div className="flex justify-between items-start mb-2 relative z-10">
        <div className="flex items-center gap-2 text-slate-400">
            <Car className="w-4 h-4 text-brand-secondary" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Trânsito para Casa</span>
        </div>
      </div>

      <div className="relative z-10">
          <div className="flex items-center justify-between">
             <div className="flex flex-col">
                 <div className="flex items-center gap-1 mb-0.5 text-slate-400">
                     <MapPin className="w-3 h-3" />
                     <span className="text-xs">Do Trabalho (Tidas)</span>
                 </div>
                 <span className={`text-3xl font-bold ${statusColor}`}>
                     {displayInfo}
                 </span>
             </div>
             
             <div className="p-3 rounded-full bg-slate-700/50">
                 <Clock className="w-6 h-6 text-brand-secondary" />
             </div>
          </div>
      </div>

      {/* Decorative Background */}
      <div className="absolute -bottom-10 -right-6 w-32 h-32 bg-brand-secondary/5 rounded-full blur-2xl pointer-events-none"></div>
    </div>
  );
};

export default TrafficWidget;

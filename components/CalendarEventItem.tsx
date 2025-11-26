
import React from 'react';
import { CalendarEvent } from '../types';
import { MapPin, Clock, ExternalLink, Calendar as CalendarIcon } from 'lucide-react';

interface CalendarEventItemProps {
  event: CalendarEvent;
}

const CalendarEventItem: React.FC<CalendarEventItemProps> = ({ event }) => {
  const now = new Date();
  
  // Normaliza datas para comparação de "Hoje"
  const isToday = event.start.getDate() === now.getDate() && 
                  event.start.getMonth() === now.getMonth() &&
                  event.start.getFullYear() === now.getFullYear();

  // Se o evento termina antes de agora, já passou
  const isPast = event.end < now;
  
  // Se está acontecendo agora (entre start e end)
  const isHappeningNow = now >= event.start && now <= event.end;

  let containerClasses = 'bg-slate-800 border-slate-700';
  let titleClasses = 'text-slate-200';
  let textClasses = 'text-slate-400';

  if (isHappeningNow) {
    containerClasses = 'bg-blue-900/30 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)] relative overflow-hidden';
    titleClasses = 'text-blue-200';
    textClasses = 'text-blue-300';
  } else if (isToday) {
    containerClasses = 'bg-slate-800 border-slate-600';
    titleClasses = 'text-white font-bold';
    textClasses = 'text-slate-300';
  } else if (isPast) {
    containerClasses = 'bg-slate-900/50 border-slate-800 opacity-70';
    titleClasses = 'text-slate-500 line-through';
    textClasses = 'text-slate-600';
  }

  return (
    <div className={`rounded-xl p-4 border transition-all ${containerClasses}`}>
      {isHappeningNow && (
         <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-bl-full pointer-events-none -mr-4 -mt-4"></div>
      )}

      <div className="flex justify-between items-start relative z-10">
        <div className="flex-1">
          <h3 className={`font-semibold text-sm mb-1 leading-snug ${titleClasses}`}>
            {event.title}
          </h3>
          
          <div className="flex items-center gap-3 mt-2">
            <div className={`flex items-center gap-1 text-xs ${textClasses} ${isHappeningNow ? 'font-bold' : ''}`}>
              <Clock className="w-3.5 h-3.5" />
              {event.isAllDay ? (
                <span>Dia Inteiro</span>
              ) : (
                <span>
                  {event.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {event.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            
            {event.location && (
              <div className="flex items-center gap-1 text-xs text-slate-500 truncate max-w-[150px]">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{event.location}</span>
              </div>
            )}
          </div>
        </div>

        {event.link && (
          <a 
            href={event.link} 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-2 text-slate-500 hover:text-blue-400 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
      
      {event.description && (
         <p className="text-xs text-slate-500 mt-2 border-t border-slate-700/50 pt-2 line-clamp-2">
           {event.description}
         </p>
      )}
    </div>
  );
};

export default CalendarEventItem;

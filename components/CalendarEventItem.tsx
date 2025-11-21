
import React from 'react';
import { CalendarEvent } from '../types';
import { MapPin, Clock, ExternalLink, Calendar as CalendarIcon } from 'lucide-react';

interface CalendarEventItemProps {
  event: CalendarEvent;
}

const CalendarEventItem: React.FC<CalendarEventItemProps> = ({ event }) => {
  const now = new Date();
  const isToday = event.start.getDate() === now.getDate() && event.start.getMonth() === now.getMonth();
  const isHappeningNow = now >= event.start && now <= event.end;

  return (
    <div className={`mb-3 rounded-xl p-4 border transition-all ${
      isHappeningNow 
        ? 'bg-blue-900/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]' 
        : 'bg-slate-800 border-slate-700'
    }`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {isToday && (
              <span className="text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded">
                HOJE
              </span>
            )}
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <CalendarIcon className="w-3 h-3" />
              {event.start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          </div>
          
          <h3 className={`font-bold text-sm mb-1 ${isHappeningNow ? 'text-blue-200' : 'text-slate-200'}`}>
            {event.title}
          </h3>
          
          <div className="flex items-center gap-3 mt-2">
            <div className={`flex items-center gap-1 text-xs ${isHappeningNow ? 'text-blue-300 font-semibold' : 'text-slate-400'}`}>
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

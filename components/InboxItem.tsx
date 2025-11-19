
import React, { useState, useRef } from 'react';
import { FormSubmission } from '../types';
import { Mail, Calendar, ChevronRight, Trash2, Globe, Eye } from 'lucide-react';

interface InboxItemProps {
  form: FormSubmission;
  siteName: string;
  onSelect: () => void;
  onDismiss: () => void;
}

const InboxItem: React.FC<InboxItemProps> = ({ form, siteName, onSelect, onDismiss }) => {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  const DRAG_THRESHOLD = 10;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartX.current) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartX.current;
    if (Math.abs(diff) > DRAG_THRESHOLD) {
        if (diff < 0 && diff > -200) {
            setTranslateX(diff);
        }
    }
  };

  const handleTouchEnd = () => {
    if (translateX < -100) {
      setTranslateX(-500); 
      setTimeout(() => {
        onDismiss();
      }, 300); 
    } else {
      setTranslateX(0);
    }
    touchStartX.current = null;
    setIsDragging(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    touchStartX.current = e.clientX;
    setIsDragging(true);
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !touchStartX.current) return;
    const diff = e.clientX - touchStartX.current;
    if (Math.abs(diff) > DRAG_THRESHOLD) {
        if (diff < 0) setTranslateX(diff);
    }
  };

  const handleMouseUp = () => {
    handleTouchEnd();
  };

  const handleClick = () => {
    if (Math.abs(translateX) < 5) {
      onSelect();
    }
  };

  const handleReadButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    onSelect();
  };

  const isUnread = !form.isRead;
  const showBackground = translateX < -5;

  return (
    <div className="relative mb-3 select-none touch-pan-y overflow-hidden rounded-xl">
      <div 
        className={`absolute inset-0 bg-rose-600 flex items-center justify-end pr-6 rounded-xl transition-opacity duration-200 ${showBackground ? 'opacity-100' : 'opacity-0'}`}
      >
        <Trash2 className="w-6 h-6 text-white" />
      </div>

      <div 
        ref={itemRef}
        className={`relative p-4 transition-all duration-200 ease-out cursor-pointer rounded-xl border
          ${isUnread 
            ? 'bg-slate-800 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)] opacity-100 z-10' 
            : 'bg-slate-900/30 border-transparent opacity-50 hover:opacity-70 grayscale'}
        `}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
      >
        {isUnread && (
          <div className="absolute -top-1 -right-1 z-10 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg rounded-tr-lg shadow-sm animate-pulse">
            NOVO
          </div>
        )}

        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className={`p-2 rounded-full transition-colors ${isUnread ? 'bg-blue-500/20' : 'bg-slate-800/50'}`}>
              <Mail className={`w-4 h-4 ${isUnread ? 'text-blue-400' : 'text-slate-600'}`} />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className={`text-sm truncate pr-2 ${isUnread ? 'font-bold text-white' : 'font-normal text-slate-500'}`}>
                {form.senderName}
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                 <Globe className={`w-3 h-3 ${isUnread ? 'text-blue-300/70' : 'text-slate-700'}`} />
                 <span className={`text-xs font-medium uppercase tracking-wide ${isUnread ? 'text-blue-300' : 'text-slate-600'}`}>
                   {siteName}
                 </span>
              </div>
            </div>
          </div>
        </div>
        
        <p className={`text-sm line-clamp-2 mb-3 pl-11 transition-colors ${isUnread ? 'text-slate-300' : 'text-slate-600 italic'}`}>
          {form.message}
        </p>

        <div className="flex justify-between items-center pl-11">
          <div className="flex items-center gap-1 text-xs text-slate-600">
            <Calendar className="w-3 h-3" />
            {form.timestamp.toLocaleDateString()} {form.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          
          <button 
              onClick={handleReadButtonClick}
              className={`flex items-center text-xs font-bold px-2 py-1 rounded transition-transform active:scale-95
                ${isUnread 
                  ? 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 hover:text-blue-300' 
                  : 'text-slate-600 bg-transparent hover:text-slate-400'
                }`}
          >
            {isUnread ? 'Ler' : 'Rever'} <ChevronRight className="w-3 h-3 ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default InboxItem;

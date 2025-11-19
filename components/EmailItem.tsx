
import React, { useState, useRef } from 'react';
import { EmailMessage } from '../types';
import { Mail, Calendar, ChevronRight, Trash2, User } from 'lucide-react';

interface EmailItemProps {
  email: EmailMessage;
  onSelect: () => void;
  onDismiss: () => void;
}

const EmailItem: React.FC<EmailItemProps> = ({ email, onSelect, onDismiss }) => {
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

  const showBackground = translateX < -5;

  // Cores das Labels
  const getLabelBadge = () => {
    if (email.label === 'Updates') return <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded ml-2">Updates</span>;
    if (email.label === 'Promotions') return <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded ml-2">Promo</span>;
    return null;
  };

  return (
    <div className="relative mb-3 select-none touch-pan-y overflow-hidden rounded-xl">
      <div 
        className={`absolute inset-0 bg-rose-600 flex items-center justify-end pr-6 rounded-xl transition-opacity duration-200 ${showBackground ? 'opacity-100' : 'opacity-0'}`}
      >
        <Trash2 className="w-6 h-6 text-white" />
      </div>

      <div 
        ref={itemRef}
        className={`relative p-4 transition-all duration-300 ease-out cursor-pointer rounded-xl border
          ${email.isUnread 
            ? 'bg-slate-800 border-blue-500/60 shadow-[0_0_20px_rgba(59,130,246,0.15)] opacity-100' 
            : 'bg-slate-900/20 border-transparent opacity-50 grayscale hover:opacity-80 hover:grayscale-0'}
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
        {email.isUnread && (
          <div className="absolute -top-1 -right-1 z-10 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg rounded-tr-lg shadow-sm animate-pulse">
            NOVO
          </div>
        )}

        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-3 overflow-hidden w-full">
            <div className={`p-2 rounded-full transition-colors shrink-0 ${email.isUnread ? 'bg-blue-500/20' : 'bg-slate-800/50'}`}>
              <Mail className={`w-4 h-4 ${email.isUnread ? 'text-blue-400' : 'text-slate-500'}`} />
            </div>
            <div className="flex flex-col overflow-hidden min-w-0">
              <div className="flex items-center">
                  <span className={`text-sm truncate pr-2 ${email.isUnread ? 'font-bold text-white' : 'font-normal text-slate-400'}`}>
                    {email.sender}
                  </span>
                  {getLabelBadge()}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                 <span className={`text-xs font-medium truncate ${email.isUnread ? 'text-slate-300' : 'text-slate-500'}`}>
                   {email.subject}
                 </span>
              </div>
            </div>
          </div>
        </div>
        
        <p className={`text-sm line-clamp-2 mb-3 pl-11 transition-colors ${email.isUnread ? 'text-slate-400' : 'text-slate-600 italic'}`}>
          {email.snippet}
        </p>

        <div className="flex justify-between items-center pl-11">
          <div className="flex items-center gap-1 text-xs text-slate-600">
            <Calendar className="w-3 h-3" />
            {email.date.toLocaleDateString()} {email.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          
          <button 
              onClick={handleReadButtonClick}
              className={`flex items-center text-xs font-bold px-3 py-1.5 rounded transition-transform active:scale-95
                ${email.isUnread 
                  ? 'text-blue-200 bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20' 
                  : 'text-slate-500 bg-transparent hover:text-slate-300'
                }`}
          >
            Ler Mensagem <ChevronRight className="w-3 h-3 ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailItem;

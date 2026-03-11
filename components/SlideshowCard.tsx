import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface SlideshowCardProps {
  title: string;
  items: { name: string; value: string }[];
  icon: LucideIcon;
  iconColor: string;
  delay?: number;
  badge?: number;
  isNotification?: boolean;
  onTitleClick?: (e: React.MouseEvent) => void;
  isEditingTitle?: boolean;
  onTitleChange?: (newTitle: string) => void;
  onTitleBlur?: () => void;
}

const SlideshowCard: React.FC<SlideshowCardProps> = ({ 
  title, 
  items, 
  icon: Icon, 
  iconColor, 
  delay = 0, 
  badge, 
  isNotification,
  onTitleClick,
  isEditingTitle,
  onTitleChange,
  onTitleBlur
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 15000);

    return () => clearInterval(interval);
  }, [items.length]);

  const currentItem = items[currentIndex] || { name: '---', value: '---' };

  return (
    <div 
      className="relative overflow-hidden rounded-2xl px-10 py-8 bg-gradient-to-br from-[var(--bg-card)]/80 to-[var(--bg-card-gradient-to)]/40 backdrop-blur-md border border-[var(--accent)]/15 shadow-[var(--card-shadow)] h-[165px] flex flex-col justify-center animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-forwards group"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="relative z-10 flex items-center gap-6">
        {/* Left: Icon */}
        <div className="relative shrink-0">
          <div className="p-3 bg-[var(--accent)]/10 rounded-2xl border border-[var(--accent)]/20 group-hover:scale-110 transition-transform duration-500 text-[var(--accent)]">
            <Icon size={36} />
          </div>
          {badge !== undefined && badge > 0 && (
            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center border-2 border-[var(--bg-card)] shadow-lg">
              {badge}
            </div>
          )}
        </div>

        {/* Right: Content */}
        <div className="flex-1 overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            {isEditingTitle ? (
              <input 
                autoFocus
                type="text"
                value={title}
                onChange={(e) => onTitleChange?.(e.target.value)}
                onBlur={onTitleBlur}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') onTitleBlur?.();
                }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[var(--text-main)]/20 border-b border-[var(--accent)] text-[var(--text-main)] text-[11px] font-bold uppercase tracking-[0.25em] outline-none px-1 w-full focus:bg-[var(--text-main)]/30 transition-all"
              />
            ) : (
              <h3 
                onClick={(e) => {
                  if (onTitleClick) {
                    e.stopPropagation();
                    onTitleClick(e);
                  }
                }}
                className={`text-[var(--text-muted)] text-[11px] font-bold uppercase tracking-[0.25em] ${onTitleClick ? 'cursor-pointer hover:text-[var(--text-main)]' : ''}`}
              >
                {title}
              </h3>
            )}
          </div>
          
          <div className="relative min-h-[3.5rem] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ x: 10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -10, opacity: 0 }}
                transition={{ duration: 0.4, ease: "circOut" }}
                className="flex flex-col"
              >
                <span className={`${
                  isNotification 
                    ? 'text-[0.95rem] font-medium' 
                    : 'text-sm md:text-[1.7rem] font-bold'
                } text-[var(--text-main)] whitespace-normal tracking-tight leading-tight`}>
                  {currentItem.name}
                </span>
                {currentItem.value && currentItem.value !== '---' && (
                  <span className="text-sm font-bold text-[var(--accent)] mt-0.5">
                    {currentItem.value}
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Progress Dots (Restored to circular style) */}
      {items.length > 1 && (
        <div className="absolute bottom-3 left-0 right-0 flex gap-1.5 justify-center">
          {items.map((_, idx) => (
            <div 
              key={idx} 
              className={`h-1 w-1 rounded-full transition-all duration-300 ${
                idx === currentIndex ? 'bg-[var(--accent)] scale-125 shadow-[0_0_5px_var(--accent)]' : 'bg-[var(--text-main)]/10'
              }`}
            />
          ))}
        </div>
      )}

      {/* Decorative Background Elements */}
      <div className="absolute -right-8 -top-8 w-24 h-24 bg-[var(--accent)] opacity-[0.03] blur-3xl rounded-full pointer-events-none group-hover:opacity-[0.06] transition-opacity duration-700" />
    </div>
  );
};

export default SlideshowCard;

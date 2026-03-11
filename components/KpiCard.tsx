import React from 'react';
import { THEME } from '../constants';
import { ArrowUp, ArrowDown, Minus, X } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  delay?: number;
  chart?: React.ReactNode;
  onClick?: () => void;
  onClose?: (e: React.MouseEvent) => void;
  isActive?: boolean;
  onTitleClick?: (e: React.MouseEvent) => void;
  isEditingTitle?: boolean;
  onTitleChange?: (newTitle: string) => void;
  onTitleBlur?: () => void;
}

const KpiCard: React.FC<KpiCardProps> = ({ 
  title, 
  value, 
  subValue, 
  trend, 
  icon, 
  iconPosition = 'right',
  delay = 0, 
  chart,
  onClick,
  onClose,
  isActive,
  onTitleClick,
  isEditingTitle,
  onTitleChange,
  onTitleBlur
}) => {
  return (
    <div 
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl px-10 py-8 bg-gradient-to-br from-[#001a2c]/80 to-[#003554]/40 backdrop-blur-md border transition-all duration-300 group h-[165px] flex flex-col justify-between ${
        onClick ? 'cursor-pointer hover:bg-[#003554]/60' : ''
      } ${
        isActive ? 'border-[#70d44c]/60 ring-1 ring-[#70d44c]/30' : 'border-[#70d44c]/15'
      } shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-forwards`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {onClose && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onClose(e);
          }}
          className="absolute top-3 right-3 p-1 rounded-full bg-white/0 hover:bg-white/10 text-gray-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-20"
          title="Remover destaque"
        >
          <X size={14} />
        </button>
      )}
      
      {iconPosition === 'left' ? (
        <div className="relative z-10 flex items-center gap-6 h-full">
          {icon && (
            <div className="shrink-0 flex items-center">
              <div className="p-3 bg-[#70d44c]/10 rounded-2xl border border-[#70d44c]/20 group-hover:scale-110 transition-transform duration-500 text-[#70d44c]">
                {React.cloneElement(icon as React.ReactElement, { size: 36 })}
              </div>
            </div>
          )}
          <div className="flex-1 flex flex-col justify-center overflow-hidden h-full">
            <div className="mb-2">
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
                  className="bg-white/20 border-b border-[#70d44c] text-white text-[10px] font-bold uppercase tracking-[0.2em] outline-none px-1 w-full focus:bg-white/30 transition-all"
                />
              ) : (
                <h3 
                  onClick={(e) => {
                    if (onTitleClick) {
                      e.stopPropagation();
                      onTitleClick(e);
                    }
                  }}
                  className={`text-gray-400 text-[11px] font-bold uppercase tracking-[0.25em] ${onTitleClick ? 'cursor-pointer hover:text-white' : ''}`}
                >
                  {title}
                </h3>
              )}
            </div>
            
            <div className="flex items-baseline gap-2">
              <span className="text-2xl lg:text-[2.35rem] font-bold text-white tracking-tight leading-none">{value}</span>
              {trend && (
                <div className="flex items-center text-[0.85rem] leading-[1rem]">
                  {trend === 'up' && <ArrowUp size={12} className="text-[#70d44c]" />}
                  {trend === 'down' && <ArrowDown size={12} className="text-red-400" />}
                  <span className={`${
                    trend === 'up' ? 'text-[#70d44c]' : trend === 'down' ? 'text-red-400' : 'text-gray-400'
                  } font-medium ml-0.5`}>
                    {subValue}
                  </span>
                </div>
              )}
            </div>
            
            {!chart && subValue && !trend && (
              <div className="text-[0.85rem] leading-[1rem] text-gray-400 truncate mt-1">
                {subValue}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-center gap-4 h-full">
          <div className="flex-1 flex flex-col justify-center h-full overflow-hidden">
            <div className="mb-3">
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
                  className="bg-white/20 border-b border-[#70d44c] text-white text-[10px] font-bold uppercase tracking-[0.2em] outline-none px-1 w-full focus:bg-white/30 transition-all"
                />
              ) : (
                <h3 
                  onClick={(e) => {
                    if (onTitleClick) {
                      e.stopPropagation();
                      onTitleClick(e);
                    }
                  }}
                  className={`text-gray-400 text-[11px] font-bold uppercase tracking-[0.25em] ${onTitleClick ? 'cursor-pointer hover:text-white' : ''}`}
                >
                  {title}
                </h3>
              )}
            </div>
            
            <div className="flex items-baseline gap-4">
              <span className="text-3xl lg:text-[2.75rem] font-bold text-white tracking-tight leading-none">{value}</span>
              {trend && (
                <div className="flex items-center text-[1rem] leading-[1rem]">
                  {trend === 'up' && <ArrowUp size={16} className="text-[#70d44c]" />}
                  {trend === 'down' && <ArrowDown size={16} className="text-red-400" />}
                  <span className={`${
                    trend === 'up' ? 'text-[#70d44c]' : trend === 'down' ? 'text-red-400' : 'text-gray-400'
                  } font-semibold ml-1`}>
                    {subValue}
                  </span>
                </div>
              )}
            </div>
            
            {!chart && subValue && !trend && (
              <div className="text-[0.9rem] leading-[1rem] text-gray-400 truncate mt-1">
                {subValue}
              </div>
            )}
          </div>

          <div className="flex flex-col justify-center items-end h-full shrink-0 ml-4">
            {icon && (
              <div className="text-[#70d44c] p-2 bg-[#70d44c]/10 rounded-xl border border-[#70d44c]/20 hidden lg:flex items-center justify-center mb-2">
                {icon}
              </div>
            )}
            {chart && (
              <div className="w-20 lg:w-28 h-12 flex items-center">
                {chart}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Subtle Glow Effect */}
      <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-[#70d44c]/5 blur-2xl rounded-full pointer-events-none" />
    </div>
  );
};

export default KpiCard;

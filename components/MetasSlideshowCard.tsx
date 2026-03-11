import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, X } from 'lucide-react';

interface MetaData {
  title: string;
  data: string[][];
}

interface MetasSlideshowCardProps {
  goals: MetaData[];
  delay?: number;
  onClose?: () => void;
}

const MetasSlideshowCard: React.FC<MetasSlideshowCardProps> = ({ 
  goals, 
  delay = 0,
  onClose
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (goals.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % goals.length);
    }, 15000); // 15 seconds per meta

    return () => clearInterval(interval);
  }, [goals.length]);

  const currentGoal = goals[currentIndex];

  if (!currentGoal) return null;

  return (
    <div 
      className="relative overflow-hidden rounded-2xl px-10 py-8 bg-gradient-to-br from-[#001a2c]/80 to-[#003554]/40 backdrop-blur-md border border-[#70d44c]/15 shadow-xl h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-forwards group"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-2 border-b border-white/10 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-gray-400 text-[11px] font-bold uppercase tracking-[0.25em]">
            {currentGoal.title}
          </h3>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-1 rounded-full bg-white/0 hover:bg-white/10 text-gray-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.5, ease: "circOut" }}
            className="h-full flex flex-col justify-center"
          >
            <table className="w-full text-[0.85rem] text-left border-separate border-spacing-y-4">
              <thead>
                <tr className="text-gray-400">
                  <th className="pb-1 font-medium text-[9px] uppercase tracking-wider"></th>
                  <th className="pb-1 font-medium text-right pr-4 text-[9px] uppercase tracking-wider">Real</th>
                  <th className="pb-1 font-medium text-right pr-4 text-[9px] uppercase tracking-wider">Meta</th>
                  <th className="pb-1 font-medium text-right text-[9px] uppercase tracking-wider">%</th>
                </tr>
              </thead>
              <tbody className="text-white">
                {currentGoal.data.map((row, idx) => {
                  const percentStr = row[3] || '0';
                  const percentValue = parseFloat(percentStr.replace(',', '.') || '0');
                  const isPositive = !isNaN(percentValue) && percentValue >= 100;
                  
                  // Helper to remove decimals from Brazilian formatted strings (e.g. 1.234,56 -> 1.234)
                  const stripDecimals = (val: string) => {
                    if (!val || val === '-') return val;
                    return val.split(',')[0];
                  };

                  return (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      <td className="py-1 font-bold truncate max-w-[110px] leading-tight text-gray-300">
                        {row[0] || '-'}
                      </td>
                      <td className="py-1 text-right pr-4 font-bold whitespace-nowrap tabular-nums text-white">
                        {stripDecimals(row[1] || '0')}
                      </td>
                      <td className="py-1 text-right pr-4 font-medium whitespace-nowrap tabular-nums text-gray-400">
                        {stripDecimals(row[2] || '0')}
                      </td>
                      <td className={`py-1 text-right font-black whitespace-nowrap tabular-nums ${isPositive ? 'text-[#70d44c]' : 'text-yellow-400'}`}>
                        {stripDecimals(percentStr)}{percentStr && percentStr !== '-' ? '%' : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress Dots */}
      {goals.length > 1 && (
        <div className="absolute bottom-3 left-0 right-0 flex gap-1.5 justify-center">
          {goals.map((_, idx) => (
            <div 
              key={idx} 
              className={`h-1 w-1 rounded-full transition-all duration-300 ${
                idx === currentIndex ? 'bg-[#70d44c] scale-125 shadow-[0_0_5px_#70d44c]' : 'bg-white/10'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MetasSlideshowCard;

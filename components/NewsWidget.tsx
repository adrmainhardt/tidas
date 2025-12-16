
import React, { useState, useEffect, useRef } from 'react';
import { NewsArticle } from '../types';
import { Newspaper, ChevronRight } from 'lucide-react';

interface NewsWidgetProps {
  articles: NewsArticle[];
  isLoading: boolean;
  onNavigate: () => void;
}

const NewsWidget: React.FC<NewsWidgetProps> = ({ articles, isLoading, onNavigate }) => {
  // Regra: Mostrar apenas as 5 mais relevantes no Widget principal
  const displayArticles = articles.slice(0, 5);

  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const intervalRef = useRef<any>(null);

  const ROTATION_TIME = 15000;

  const resetTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (displayArticles.length === 0) return;
    
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % displayArticles.length);
    }, ROTATION_TIME);
  };

  useEffect(() => {
    if (displayArticles.length <= 1) return;
    resetTimer();
    return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [displayArticles.length]);

  // Swipe Logic
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) {
        resetTimer();
        return;
    }

    const distance = touchStartX.current - touchEndX.current;
    const isSwipeLeft = distance > 50;
    const isSwipeRight = distance < -50;

    if (isSwipeLeft) {
        handleNext();
    } else if (isSwipeRight) {
        handlePrev();
    }

    touchStartX.current = null;
    touchEndX.current = null;
    resetTimer();
  };

  const handleNext = () => {
      setCurrentIndex((prev) => (prev + 1) % displayArticles.length);
  };

  const handlePrev = () => {
      setCurrentIndex((prev) => (prev - 1 + displayArticles.length) % displayArticles.length);
  };

  // Loading State
  if (isLoading && articles.length === 0) {
    return (
      <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-4 animate-pulse">
        <div className="flex justify-between items-center mb-3">
            <div className="h-4 w-24 bg-slate-700 rounded"></div>
            <div className="h-3 w-12 bg-slate-700 rounded"></div>
        </div>
        <div className="h-4 w-full bg-slate-700 rounded mb-2"></div>
        <div className="h-4 w-2/3 bg-slate-700 rounded"></div>
      </div>
    );
  }

  // Empty State
  if (displayArticles.length === 0) return null;

  const article = displayArticles[currentIndex];

  return (
    <div 
        className="bg-slate-800 rounded-2xl border border-slate-700 mb-4 overflow-hidden relative shadow-lg touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
    >
      <div className="p-4 relative z-10">
        <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
                <div className="p-1.5 bg-cyan-500/20 rounded-lg">
                    <Newspaper className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                {/* Texto simplificado sem contador */}
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Principais Notícias</span>
            </div>
            <button onClick={onNavigate} className="text-[10px] text-cyan-400 font-bold flex items-center hover:text-cyan-300 bg-cyan-950/30 px-2 py-1 rounded border border-cyan-500/20">
                Ver Tudo <ChevronRight className="w-3 h-3 ml-0.5" />
            </button>
        </div>

        <div key={`${currentIndex}-${article.id}`} className="animate-fade-in min-h-[90px]"> 
            <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[9px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded border border-slate-600 uppercase font-bold tracking-wide truncate max-w-[150px]">
                    {article.topic}
                </span>
                <span className="text-[9px] text-slate-500 font-medium flex items-center gap-1 truncate">
                    via {article.source}
                </span>
            </div>
            
            <a href={article.url} target="_blank" rel="noopener noreferrer" className="block group">
                <h3 className="text-sm font-bold text-slate-100 leading-snug line-clamp-3 group-active:text-cyan-400 transition-colors">
                    {article.title}
                </h3>
            </a>
            
            <p className="text-[11px] text-slate-400 mt-1 line-clamp-1 opacity-80">
                {article.summary}
            </p>
        </div>
      </div>

      {/* Barra de progresso discreta no fundo para indicar rotação automática */}
      <div className="absolute bottom-0 left-0 h-0.5 bg-slate-700 w-full">
             <div 
                key={currentIndex} 
                className="h-full bg-cyan-500/50" 
                style={{ 
                    width: '100%', 
                    animation: `shrink ${ROTATION_TIME}ms linear forwards` 
                }} 
             />
      </div>
      <style>{`
        @keyframes shrink {
            from { width: 0%; }
            to { width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default NewsWidget;

import React, { useState, useEffect } from 'react';
import { NewsArticle } from '../types';
import { Newspaper, ChevronRight } from 'lucide-react';

interface NewsWidgetProps {
  articles: NewsArticle[];
  isLoading: boolean;
  onNavigate: () => void;
}

const NewsWidget: React.FC<NewsWidgetProps> = ({ articles, isLoading, onNavigate }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (articles.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % articles.length);
    }, 8000); // Rotação a cada 8 segundos
    return () => clearInterval(interval);
  }, [articles.length]);

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

  // Empty State (só retorna null se não estiver carregando, para não piscar)
  if (articles.length === 0) return null;

  const article = articles[currentIndex];

  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 mb-4 overflow-hidden relative shadow-lg">
      <div className="p-4 relative z-10">
        <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
                <div className="p-1.5 bg-cyan-500/20 rounded-lg">
                    <Newspaper className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Destaques</span>
            </div>
            <button onClick={onNavigate} className="text-[10px] text-cyan-400 font-bold flex items-center hover:text-cyan-300 bg-cyan-950/30 px-2 py-1 rounded border border-cyan-500/20">
                Ver Tudo <ChevronRight className="w-3 h-3 ml-0.5" />
            </button>
        </div>

        <div className="animate-fade-in key={currentIndex}"> {/* key forces remount animation */}
            <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[9px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded border border-slate-600 uppercase font-bold tracking-wide">
                    {article.topic}
                </span>
                <span className="text-[9px] text-slate-500 font-medium flex items-center gap-1">
                    via {article.source}
                </span>
            </div>
            
            <a href={article.url} target="_blank" rel="noopener noreferrer" className="block group">
                <h3 className="text-sm font-bold text-slate-100 leading-snug line-clamp-2 group-active:text-cyan-400 transition-colors">
                    {article.title}
                </h3>
            </a>
            
            <p className="text-[11px] text-slate-400 mt-1 line-clamp-1 opacity-80">
                {article.summary}
            </p>
        </div>
        
        {/* Progress Bar animation */}
        <div className="absolute bottom-0 left-0 h-0.5 bg-cyan-500/50 w-full">
             <div 
                key={currentIndex} // Restart animation on index change
                className="h-full bg-cyan-400" 
                style={{ 
                    width: '100%', 
                    animation: 'shrink 8s linear forwards' 
                }} 
             />
        </div>
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
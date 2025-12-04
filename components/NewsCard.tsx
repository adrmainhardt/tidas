import React from 'react';
import { NewsArticle } from '../types';
import { ExternalLink, Share2, Bookmark, Clock, Hash } from 'lucide-react';

interface NewsCardProps {
  article: NewsArticle;
}

const NewsCard: React.FC<NewsCardProps> = ({ article }) => {
  // Gera uma cor baseada no tópico para dar identidade visual (Hash simples)
  const getTopicColor = (topic: string) => {
    const colors = [
      'from-blue-600 to-blue-800',
      'from-emerald-600 to-emerald-800',
      'from-rose-600 to-rose-800',
      'from-purple-600 to-purple-800',
      'from-amber-600 to-amber-800',
      'from-cyan-600 to-cyan-800'
    ];
    const hash = topic.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const bgGradient = getTopicColor(article.topic);

  return (
    <div className="bg-slate-800 rounded-2xl overflow-hidden shadow-lg border border-slate-700 mb-5 flex flex-col animate-fade-in group">
      
      {/* Header Visual com Gradiente */}
      <div className={`h-24 bg-gradient-to-r ${bgGradient} p-4 relative`}>
         <div className="absolute top-3 left-4 bg-black/30 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 flex items-center gap-1.5">
            <Hash className="w-3 h-3 text-white/80" />
            <span className="text-[10px] font-bold text-white uppercase tracking-wider">{article.topic}</span>
         </div>
         
         <div className="absolute bottom-3 right-4 flex gap-2">
            <span className="text-[10px] font-medium text-white/90 bg-black/40 px-2 py-1 rounded backdrop-blur-sm flex items-center gap-1">
               <Clock className="w-3 h-3" /> {article.publishedAt || 'Recente'}
            </span>
         </div>
      </div>

      <div className="p-5 flex flex-col gap-3">
        {/* Fonte */}
        <div className="flex items-center gap-2 mb-1">
           <div className="w-2 h-2 rounded-full bg-slate-500"></div>
           <span className="text-xs font-bold text-slate-400 uppercase">{article.source}</span>
        </div>

        {/* Título */}
        <a href={article.url} target="_blank" rel="noopener noreferrer" className="group-hover:text-blue-400 transition-colors">
            <h3 className="text-lg font-bold text-slate-100 leading-snug">
              {article.title}
            </h3>
        </a>

        {/* Resumo */}
        <p className="text-sm text-slate-400 leading-relaxed line-clamp-3">
          {article.summary}
        </p>

        {/* Footer Actions */}
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-700/50">
           <div className="flex gap-4">
              <button className="text-slate-500 hover:text-slate-300 transition-colors"><Share2 className="w-4 h-4" /></button>
              <button className="text-slate-500 hover:text-slate-300 transition-colors"><Bookmark className="w-4 h-4" /></button>
           </div>
           
           <a 
             href={article.url} 
             target="_blank" 
             rel="noopener noreferrer"
             className="text-xs font-bold bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-full flex items-center gap-1.5 transition-all active:scale-95"
           >
             Ler notícia <ExternalLink className="w-3 h-3" />
           </a>
        </div>
      </div>
    </div>
  );
};

export default NewsCard;
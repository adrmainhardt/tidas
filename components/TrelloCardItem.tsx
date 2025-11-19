import React from 'react';
import { TrelloCard } from '../types';
import { Trello, Calendar, ExternalLink, Tag } from 'lucide-react';

interface TrelloCardItemProps {
  card: TrelloCard;
  listColorName?: string; // Nome da cor base (blue, amber, emerald, etc)
}

const TrelloCardItem: React.FC<TrelloCardItemProps> = ({ card, listColorName = 'blue' }) => {
  // Mapeamento de estilos baseado no nome da cor
  const colorStyles: Record<string, string> = {
    blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    amber: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    rose: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    cyan: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    indigo: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    lime: 'bg-lime-500/20 text-lime-300 border-lime-500/30',
    slate: 'bg-slate-500/20 text-slate-300 border-slate-500/30'
  };

  const badgeClass = colorStyles[listColorName] || colorStyles['slate'];

  return (
    <div className="bg-slate-800 rounded-xl p-4 shadow-md border border-slate-700 mb-3">
      <div className="flex justify-between items-start mb-3">
        {/* Badge do Nome da Lista com mais destaque */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${badgeClass}`}>
           <Trello className="w-3 h-3" />
           <span className="text-[10px] font-bold uppercase tracking-wider">
             {card.listName || 'Lista'}
           </span>
        </div>
        <a href={card.url} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-300">
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      <h3 className="text-sm font-bold text-slate-100 mb-2 leading-snug">
        {card.name}
      </h3>

      {card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {card.labels.map(label => (
            <div 
              key={label.id} 
              className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-300 border border-slate-600"
            >
              <Tag className="w-2.5 h-2.5 opacity-70" />
              {label.name || 'Label'}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 text-[10px] text-slate-500 pt-3 border-t border-slate-700/50">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span>{card.dateLastActivity.toLocaleDateString()}</span>
        </div>
        {card.desc && (
          <span className="truncate max-w-[150px] opacity-70">
            {card.desc}
          </span>
        )}
      </div>
    </div>
  );
};

export default TrelloCardItem;
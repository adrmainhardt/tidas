
import React from 'react';
import { SiteConfig, SiteStatus } from '../types';
import { Globe, CheckCircle2, XCircle, AlertCircle, Clock, Zap, BarChart3 } from 'lucide-react';

interface MonitorCardProps {
  site: SiteConfig;
  onRefresh: (id: string) => void;
  minimal?: boolean;
}

const MonitorCard: React.FC<MonitorCardProps> = ({ site, onRefresh, minimal = false }) => {
  const getStatusColor = (status: SiteStatus) => {
    switch (status) {
      case SiteStatus.ONLINE: return 'text-emerald-400';
      case SiteStatus.OFFLINE: return 'text-rose-500';
      case SiteStatus.CHECKING: return 'text-blue-400';
      default: return 'text-slate-500';
    }
  };

  const getStatusIcon = (status: SiteStatus) => {
    switch (status) {
      case SiteStatus.ONLINE: return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case SiteStatus.OFFLINE: return <XCircle className="w-5 h-5 text-rose-500" />;
      case SiteStatus.CHECKING: return <Clock className="w-5 h-5 text-blue-400 animate-spin" />;
      default: return <AlertCircle className="w-5 h-5 text-slate-500" />;
    }
  };

  const getResponseTimeColor = (ms: number) => {
    if (ms < 200) return 'text-emerald-400';
    if (ms < 500) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div className={`bg-slate-800 rounded-xl p-4 shadow-lg border border-slate-700 mb-3 flex flex-col ${minimal ? 'gap-1' : 'gap-3'}`}>
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full bg-slate-700/50 ${getStatusColor(site.status)}`}>
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 leading-tight">{site.name}</h3>
            
            {/* Modo Minimal: Métricas na mesma linha */}
            {minimal ? (
               <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                   {site.status === SiteStatus.ONLINE && (
                     <>
                        <span className={`flex items-center gap-1 ${getResponseTimeColor(site.responseTime || 0)}`}>
                            <Zap className="w-3 h-3" /> 
                            {site.responseTime}ms
                        </span>
                        <span className="opacity-30">|</span>
                        <span className="flex items-center gap-1 text-slate-300">
                            <BarChart3 className="w-3 h-3 opacity-70" /> 
                            {site.monthlyVisitors !== undefined ? site.monthlyVisitors.toLocaleString('pt-BR') : '0'}
                        </span>
                     </>
                   )}
                   {site.status !== SiteStatus.ONLINE && (
                     <span className="text-xs opacity-70">{site.status === SiteStatus.CHECKING ? 'Verificando...' : site.status}</span>
                   )}
               </div>
            ) : (
                <a href={site.url} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 hover:text-blue-400 transition-colors block mt-0.5">
                {site.url.replace('https://', '')}
                </a>
            )}
          </div>
        </div>
        
        <div className="flex flex-col items-end">
           {getStatusIcon(site.status)}
           
           {/* Modo Completo: Status em texto e latência destacada */}
           {!minimal && (
             <>
               <span className={`text-xs font-medium mt-1 ${getStatusColor(site.status)}`}>
                 {site.status === SiteStatus.CHECKING ? 'Verificando...' : site.status}
               </span>
               
               {site.status === SiteStatus.ONLINE && site.responseTime !== undefined && (
                 <div className={`flex items-center gap-1 mt-2 text-[10px] font-medium px-1.5 py-0.5 rounded border bg-opacity-10 ${getResponseTimeColor(site.responseTime).replace('text-', 'border-').replace('text-', 'bg-')} ${getResponseTimeColor(site.responseTime)}`}>
                    <Zap className="w-3 h-3" />
                    <span>{site.responseTime}ms</span>
                 </div>
               )}
             </>
           )}
        </div>
      </div>

      {/* Modo Completo: Estatísticas Extras - Apenas Visitantes Mês */}
      {!minimal && site.status === SiteStatus.ONLINE && (
        <div className="flex items-center gap-4 py-2 px-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
            <div className="flex items-center gap-2 text-slate-300">
                <BarChart3 className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-medium">Visitantes (Mês):</span>
            </div>
            <span className="text-sm font-bold text-slate-100 ml-auto">
                {site.monthlyVisitors !== undefined ? site.monthlyVisitors.toLocaleString('pt-BR') : '0'}
            </span>
        </div>
      )}

      {!minimal && (
        <div className="flex justify-between items-center border-t border-slate-700 pt-3 mt-1">
          <div className="text-xs text-slate-500">
            {site.lastChecked ? `Atualizado: ${site.lastChecked.toLocaleTimeString()}` : 'Nunca verificado'}
          </div>
          <button 
            onClick={() => onRefresh(site.id)}
            disabled={site.status === SiteStatus.CHECKING}
            className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
          >
            Verificar Agora
          </button>
        </div>
      )}
    </div>
  );
};

export default MonitorCard;

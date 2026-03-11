
import React from 'react';
import { WeatherData } from '../types';
import { getWeatherInfo } from '../services/weatherService';
import { MapPin, ArrowDown, ArrowUp } from 'lucide-react';

interface WeatherWidgetProps {
  weather: WeatherData | null;
  loading: boolean;
  permissionDenied: boolean;
  onRequestPermission: () => void;
}

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ weather, loading, permissionDenied, onRequestPermission }) => {
  
  if (permissionDenied) {
    return (
      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 mb-4 flex items-center justify-between">
         <div className="flex items-center gap-2 text-slate-400">
             <MapPin className="w-5 h-5" />
             <span className="text-xs">Localização desativada</span>
         </div>
         <button onClick={onRequestPermission} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded font-bold">
             Ativar
         </button>
      </div>
    );
  }

  if (loading || !weather) {
    return (
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-4 animate-pulse">
          <div className="flex justify-between items-center mb-2">
             <div className="h-4 w-24 bg-slate-700 rounded"></div>
             <div className="h-8 w-12 bg-slate-700 rounded"></div>
          </div>
          <div className="flex justify-between">
              <div className="h-12 w-12 bg-slate-700 rounded-full"></div>
              <div className="h-12 w-12 bg-slate-700 rounded-full"></div>
          </div>
      </div>
    );
  }

  const currentInfo = getWeatherInfo(weather.current.code);
  const todayInfo = getWeatherInfo(weather.today.code);
  const tomorrowInfo = getWeatherInfo(weather.tomorrow.code);
  
  const CurrentIcon = currentInfo.icon;
  const TodayIcon = todayInfo.icon;
  const TomorrowIcon = tomorrowInfo.icon;

  return (
    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-4 shadow-lg relative overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-start mb-3 relative z-10">
            <div className="flex flex-col">
                <div className="flex items-center gap-1 text-slate-400 mb-1">
                    <MapPin className="w-3 h-3" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{weather.locationName || 'Sua Localização'}</span>
                </div>
                <div className="flex items-center gap-2">
                    <CurrentIcon className={`w-8 h-8 ${currentInfo.color}`} />
                    <div className="flex flex-col">
                        <span className="text-2xl font-bold text-slate-100 leading-none">{weather.current.temp}°</span>
                        <span className="text-[10px] text-slate-400">{currentInfo.label}</span>
                    </div>
                </div>
            </div>
            
            {/* Today High/Low */}
            <div className="flex flex-col items-end">
                 <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">Hoje</span>
                 <div className="flex items-center gap-3 bg-slate-900/50 px-2 py-1 rounded-lg border border-slate-700/50">
                     <div className="flex items-center text-rose-400 text-xs font-bold">
                        <ArrowUp className="w-3 h-3" /> {weather.today.max}°
                     </div>
                     <div className="flex items-center text-blue-400 text-xs font-bold">
                        <ArrowDown className="w-3 h-3" /> {weather.today.min}°
                     </div>
                 </div>
            </div>
        </div>

        <div className="w-full h-px bg-slate-700/50 mb-3"></div>

        {/* Tomorrow Forecast */}
        <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Amanhã</span>
            <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2">
                     <TomorrowIcon className={`w-4 h-4 ${tomorrowInfo.color}`} />
                     <span className="text-xs text-slate-300">{tomorrowInfo.label}</span>
                 </div>
                 <div className="flex gap-2 text-xs font-bold">
                    <span className="text-rose-400">{weather.tomorrow.max}°</span>
                    <span className="text-slate-600">/</span>
                    <span className="text-blue-400">{weather.tomorrow.min}°</span>
                 </div>
            </div>
        </div>
        
        {/* Decorative Background Gradient */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
    </div>
  );
};

export default WeatherWidget;

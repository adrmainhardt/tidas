import React, { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, CloudLightning, CloudSnow, Wind, Thermometer, Calendar, Loader2 } from 'lucide-react';

const WeatherWidget: React.FC = () => {
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // Rio do Sul, SC: -27.21, -49.64
        const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-27.21&longitude=-49.64&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=America%2FSao_Paulo');
        if (!response.ok) throw new Error('Weather fetch failed');
        const data = await response.json();
        setWeather(data);
        setError(false);
      } catch (err) {
        console.error('Error fetching weather:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 1800000);
    return () => clearInterval(interval);
  }, []);

  const getWeatherStyles = (code: number) => {
    // WMO Weather interpretation codes (WW)
    if (code === 0) return { 
      icon: <Sun className="text-yellow-400" size={38} />, 
      label: 'Céu Limpo',
      bg: 'from-blue-600/40 to-blue-400/20',
      accent: 'bg-yellow-400/20'
    };
    if ([1, 2, 3].includes(code)) return { 
      icon: <Cloud className="text-gray-300" size={38} />, 
      label: 'Parcialmente Nublado',
      bg: 'from-blue-700/40 to-slate-500/20',
      accent: 'bg-gray-400/20'
    };
    if ([45, 48].includes(code)) return { 
      icon: <Wind className="text-gray-400" size={38} />, 
      label: 'Neblina',
      bg: 'from-slate-700/40 to-slate-500/20',
      accent: 'bg-slate-400/20'
    };
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return { 
      icon: <CloudRain className="text-blue-400" size={38} />, 
      label: 'Chuva',
      bg: 'from-blue-900/40 to-blue-700/20',
      accent: 'bg-blue-400/20'
    };
    if ([71, 73, 75, 77, 85, 86].includes(code)) return { 
      icon: <CloudSnow className="text-white" size={38} />, 
      label: 'Neve',
      bg: 'from-slate-100/20 to-blue-200/10',
      accent: 'bg-white/20'
    };
    if ([95, 96, 99].includes(code)) return { 
      icon: <CloudLightning className="text-amber-500" size={38} />, 
      label: 'Trovoadas',
      bg: 'from-purple-900/40 to-slate-900/40',
      accent: 'bg-amber-500/20'
    };
    return { 
      icon: <Cloud className="text-gray-400" size={38} />, 
      label: 'Nublado',
      bg: 'from-slate-800/40 to-slate-600/20',
      accent: 'bg-gray-400/20'
    };
  };

  if (loading) {
    return (
      <div className="rounded-2xl px-10 py-8 bg-[#003554]/40 backdrop-blur-sm border border-white/5 shadow-lg flex flex-col items-center justify-center h-[165px]">
        <Loader2 className="animate-spin text-[#70d44c] mb-2" size={24} />
        <p className="text-xs text-gray-500 uppercase tracking-widest">Obtendo clima...</p>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="rounded-2xl px-10 py-8 bg-[#003554]/40 backdrop-blur-sm border border-white/5 shadow-lg flex flex-col items-center justify-center h-[165px]">
        <Cloud className="text-gray-600 mb-2" size={32} />
        <p className="text-xs text-gray-500 text-center">Não foi possível carregar o clima de Rio do Sul</p>
      </div>
    );
  }

  const current = weather.current;
  const today = weather.daily;
  const currentInfo = getWeatherStyles(current.weather_code);
  const tomorrowInfo = getWeatherStyles(today.weather_code[1]);

  return (
    <div className={`rounded-2xl px-10 py-8 bg-gradient-to-br ${currentInfo.bg} backdrop-blur-md border border-white/10 shadow-lg relative overflow-hidden group h-[165px] flex flex-col justify-center`}>
      {/* Content Container */}
      <div className="relative z-10 flex items-center gap-6">
        
        {/* Left: Icon (Standardized) */}
        <div className={`p-3 ${currentInfo.accent} rounded-2xl border border-white/10 group-hover:scale-110 transition-transform duration-500 shrink-0`}>
          {currentInfo.icon}
        </div>

        {/* Right: Content */}
        <div className="flex-1 flex items-center justify-between gap-4 overflow-hidden">
          <div className="overflow-hidden">
            <h3 className="text-gray-300 text-[9px] font-bold uppercase tracking-[0.2em] mb-1 truncate">Rio do Sul</h3>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-white tracking-tighter leading-none">{Math.round(current.temperature_2m)}°C</span>
              <span className="text-[10px] text-gray-300 font-medium">{Math.round(today.temperature_2m_min[0])}°/{Math.round(today.temperature_2m_max[0])}°</span>
            </div>
            <p className="text-[11px] text-white font-bold mt-1 truncate">
              {currentInfo.label}
            </p>
          </div>

          {/* Tomorrow Forecast (More harmonic) */}
          <div className="shrink-0 flex flex-col items-end text-right border-l border-white/10 pl-4">
            <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1">Amanhã</span>
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-end leading-tight">
                <span className="text-sm font-bold text-white">{Math.round(today.temperature_2m_max[1])}°C</span>
                <span className="text-[9px] text-gray-300 font-medium whitespace-nowrap">{tomorrowInfo.label}</span>
              </div>
              <div className="opacity-80 scale-75">
                {tomorrowInfo.icon}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative Background Elements */}
      <div className="absolute -right-8 -top-8 w-24 h-24 bg-white opacity-[0.03] blur-3xl rounded-full pointer-events-none group-hover:opacity-[0.06] transition-opacity duration-700" />
    </div>
  );
};

export default WeatherWidget;

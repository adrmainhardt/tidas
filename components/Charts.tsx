import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { THEME } from '../constants';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border)] p-3 rounded-lg shadow-xl">
        <p className="text-[var(--text-muted)] text-sm mb-1">{label}</p>
        <p className="text-[var(--accent)] font-bold text-lg">
          {typeof payload[0].value === 'number' 
            ? payload[0].value.toLocaleString('pt-BR') 
            : payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

export const RevenueAreaChart = ({ data }: { data: any[] }) => (
  <div className="w-full h-full min-w-0 min-h-0">
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={100}>
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={THEME.accent} stopOpacity={0.3} />
            <stop offset="95%" stopColor={THEME.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.2} vertical={false} />
        <XAxis 
          dataKey="month" 
          stroke="var(--text-muted)" 
          fontSize={12} 
          tickLine={false} 
          axisLine={false} 
        />
        <YAxis 
          stroke="var(--text-muted)" 
          fontSize={12} 
          tickLine={false} 
          axisLine={false}
          tickFormatter={(value) => `R$${value/1000}k`}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border)', strokeOpacity: 0.2 }} />
        <Area 
          type="monotone" 
          dataKey="value" 
          stroke={THEME.accent} 
          strokeWidth={3}
          fillOpacity={1} 
          fill="url(#colorValue)" 
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

export const SourcePieChart = ({ data }: { data: any[] }) => {
  const COLORS = [THEME.accent, '#0ea5e9', '#6366f1', '#a855f7', '#ec4899'];

  return (
    <div className="w-full h-full min-w-0 min-h-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={100}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--text-muted)' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export const StageBarChart = ({ data }: { data: any[] }) => (
  <div className="w-full h-full min-w-0 min-h-0">
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={100}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.2} horizontal={false} />
        <XAxis type="number" hide />
        <YAxis 
          dataKey="name" 
          type="category" 
          stroke="var(--text-muted)" 
          fontSize={11} 
          width={80}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{fill: 'var(--text-main)', fillOpacity: 0.05}} />
        <Bar dataKey="value" fill="var(--accent)" radius={[0, 4, 4, 0]} barSize={20} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export const Sparkline = ({ data, color = THEME.accent }: { data: any[], color?: string }) => {
  // Filter out 0 values to show real growth as requested
  const filteredData = data.filter(d => d.value !== 0);
  
  // If there's only 1 data point or none, don't show the chart (avoid the "bolinha" issue)
  if (filteredData.length <= 1) return null;
  
  return (
    <div className="h-12 w-full mt-2 min-w-0 min-h-[48px]">
      <ResponsiveContainer width="100%" height={48} minWidth={0} minHeight={0} debounce={100}>
        <AreaChart data={filteredData}>
          <defs>
            <linearGradient id={`sparklineGradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            strokeWidth={2}
            fillOpacity={1} 
            fill={`url(#sparklineGradient-${color.replace('#', '')})`}
            isAnimationActive={true}
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

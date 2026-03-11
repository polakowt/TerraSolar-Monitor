import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line } from 'recharts';

interface StatsCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  colorClass: string;
  loading?: boolean;
  average?: string | number;
  trendData?: number[]; // Array of values for the sparkline
  trendDirection?: 'up' | 'down' | 'neutral';
}

export const StatsCard: React.FC<StatsCardProps> = ({ 
  label, 
  value, 
  subtext, 
  icon: Icon, 
  colorClass,
  loading = false,
  average,
  trendData,
  trendDirection
}) => {
  // Prepare data for Recharts
  const chartData = trendData ? trendData.map((val, i) => ({ i, val })) : [];
  
  // Determine trend icon
  const TrendIcon = trendDirection === 'up' ? TrendingUp : trendDirection === 'down' ? TrendingDown : Minus;
  const trendColor = trendDirection === 'up' ? 'text-red-400' : trendDirection === 'down' ? 'text-emerald-400' : 'text-slate-400';

  return (
    <div className="bg-slate-850 border border-slate-700 rounded-xl p-5 flex flex-col justify-between shadow-lg relative overflow-hidden h-[140px]">
      <div className="flex justify-between items-start z-10">
        <div>
          <p className="text-slate-400 text-sm font-medium mb-1">{label}</p>
          {loading ? (
            <div className="h-8 w-24 bg-slate-700 animate-pulse rounded"></div>
          ) : (
            <div className="flex items-baseline gap-2">
               <h4 className="text-3xl font-bold text-slate-100">{value}</h4>
               {average && (
                 <span className="text-xs font-mono text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                   Avg: {average}
                 </span>
               )}
            </div>
          )}
        </div>
        <div className={`p-2 rounded-lg bg-opacity-10 ${colorClass.replace('text-', 'bg-')} ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="flex justify-between items-end mt-auto z-10">
        {subtext && <p className="text-xs text-slate-500">{subtext}</p>}
        {trendDirection && !loading && (
             <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
                <TrendIcon className="w-3 h-3" />
                <span className="font-medium uppercase tracking-wider text-[10px]">{trendDirection} Trend</span>
             </div>
        )}
      </div>

      {/* Sparkline Background */}
      {trendData && trendData.length > 0 && !loading && (
        <div className="absolute bottom-0 left-0 right-0 h-16 opacity-20 pointer-events-none z-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line 
                type="monotone" 
                dataKey="val" 
                stroke="currentColor" 
                strokeWidth={3} 
                dot={false} 
                className={colorClass}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

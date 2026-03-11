import React, { useState } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { YearlyStat } from '../types';
import { Settings2, Loader2 } from 'lucide-react';

interface TrendChartProps {
  data: YearlyStat[];
  loading: boolean;
  currentMinMag: number;
  currentRange: number;
  onFilterChange: (val: number) => void;
  onRangeChange: (val: number) => void;
}

export const TrendChart: React.FC<TrendChartProps> = ({ 
  data, 
  loading, 
  currentMinMag,
  currentRange, 
  onFilterChange,
  onRangeChange
}) => {
  const [showSolarIntensity, setShowSolarIntensity] = useState(false);
  
  const FilterButton = ({ value, label, isActive, onClick }: { value: number, label: string, isActive: boolean, onClick: (v: number) => void }) => (
    <button
      onClick={() => onClick(value)}
      disabled={loading}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
        isActive
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed'
      }`}
    >
      {label}
    </button>
  );

  // Custom Tooltip for detailed hover info
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded shadow-xl backdrop-blur-sm bg-opacity-95 min-w-[200px]">
          <p className="text-slate-200 font-bold mb-2 border-b border-slate-700 pb-1">{label}</p>
          <div className="space-y-1 text-xs sm:text-sm">
            <p className="text-emerald-400 flex justify-between gap-4">
              <span>Earthquake Freq:</span>
              <span className="font-mono text-white">{data.count}</span>
            </p>
            <p className="text-purple-400 flex justify-between gap-4">
              <span>CME Count:</span>
              <span className="font-mono text-white">{data.cmeCount ?? 'N/A'}</span>
            </p>
             <p className="text-yellow-400 flex justify-between gap-4">
              <span>Avg CME Speed:</span>
              <span className="font-mono text-white">{data.cmeMeanSpeed ? `${data.cmeMeanSpeed} km/s` : 'N/A'}</span>
            </p>
             <p className="text-red-400 flex justify-between gap-4">
              <span>Volcanic Eruptions:</span>
              <span className="font-mono text-white">{data.volcanoCount ?? 'N/A'}</span>
            </p>
            <p className="text-orange-400 flex justify-between gap-4">
              <span>Avg Mag:</span>
              <span className="font-mono text-white">{data.avgMag}</span>
            </p>
            <p className="text-red-400 flex justify-between gap-4">
              <span>Max Mag:</span>
              <span className="font-mono text-white">{data.maxMag}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full bg-slate-850 rounded-xl border border-slate-700 p-4 flex flex-col h-[480px] relative overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
        <div>
           <h3 className="text-lg font-semibold text-slate-100">
            {currentRange}-Year Trends: Seismic vs. Solar
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
             Comparing earthquake frequency against solar activity. 
             Use toggle for Solar Count vs Speed.
          </p>
        </div>
       
        <div className="flex flex-col items-end gap-2">
           <div className="flex flex-wrap justify-end gap-2">
              <div className="flex items-center gap-2 bg-slate-900/50 p-1 rounded-lg border border-slate-800">
                 <span className="text-xs text-slate-500 ml-2 mr-1 uppercase font-bold tracking-wider">Timeframe</span>
                 <FilterButton value={5} label="5Y" isActive={currentRange === 5} onClick={onRangeChange} />
                 <FilterButton value={10} label="10Y" isActive={currentRange === 10} onClick={onRangeChange} />
                 <FilterButton value={20} label="20Y" isActive={currentRange === 20} onClick={onRangeChange} />
                 <FilterButton value={30} label="30Y" isActive={currentRange === 30} onClick={onRangeChange} />
              </div>

              <div className="flex items-center gap-2 bg-slate-900/50 p-1 rounded-lg border border-slate-800">
                <span className="text-xs text-slate-500 ml-2 mr-1 uppercase font-bold tracking-wider">Mag Filter</span>
                <FilterButton value={5} label="5.0+" isActive={currentMinMag === 5} onClick={onFilterChange} />
                <FilterButton value={6} label="6.0+" isActive={currentMinMag === 6} onClick={onFilterChange} />
                <FilterButton value={7} label="7.0+" isActive={currentMinMag === 7} onClick={onFilterChange} />
              </div>
           </div>

            <button 
              onClick={() => setShowSolarIntensity(!showSolarIntensity)}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-purple-400 transition-colors px-2 py-1"
            >
              <Settings2 className="w-3 h-3" />
              Mode: <span className="font-bold text-slate-300">{showSolarIntensity ? 'Solar Intensity (Speed)' : 'Solar Frequency (Count)'}</span>
            </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/60 backdrop-blur-[1px] rounded-lg transition-all duration-300">
            <div className="bg-slate-800 border border-slate-700 px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              <span className="text-sm font-medium text-slate-200">Updating Dataset...</span>
            </div>
          </div>
        )}

        {data.length === 0 && !loading ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            No data available for this range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 10, right: 10, bottom: 0, left: -10 }}
            >
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} opacity={0.5} />
              <XAxis 
                dataKey="year" 
                stroke="#94a3b8" 
                tick={{ fill: '#64748b', fontSize: 12 }} 
                axisLine={{ stroke: '#334155' }}
                tickLine={false}
                dy={10}
              />
              {/* Left Axis: Frequency OR Speed */}
              <YAxis 
                yAxisId="left" 
                stroke={showSolarIntensity ? '#eab308' : '#a855f7'}
                tick={{ fill: '#64748b', fontSize: 12 }} 
                axisLine={false}
                tickLine={false}
                label={{ 
                  value: showSolarIntensity ? 'Speed (km/s)' : 'Frequency (Count)', 
                  angle: -90, 
                  position: 'insideLeft', 
                  fill: '#64748b', 
                  fontSize: 10 
                }}
              />
              {/* Right Axis: Magnitude */}
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                stroke="#f97316" 
                domain={['auto', 'auto']}
                tick={{ fill: '#64748b', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                label={{ value: 'Magnitude', angle: 90, position: 'insideRight', fill: '#64748b', fontSize: 10 }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#475569', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
              
              {/* Earthquake Area is always shown */}
              <Area 
                yAxisId="left" 
                type="monotone" 
                dataKey="count" 
                name={`Quake Freq (Mag ${currentMinMag}+)`}
                fill="url(#colorCount)" 
                stroke="#10b981" 
                strokeWidth={2}
                fillOpacity={0.6}
              />

              {/* Conditional Solar Line: Either Count or Speed */}
              {!showSolarIntensity && (
                <Line 
                  yAxisId="left" 
                  type="monotone" 
                  dataKey="cmeCount" 
                  name="CME Events (Count)" 
                  stroke="#a855f7" 
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 5"
                />
              )}

              {showSolarIntensity && (
                <Line 
                  yAxisId="left" 
                  type="monotone" 
                  dataKey="cmeMeanSpeed" 
                  name="CME Avg Speed (km/s)" 
                  stroke="#eab308" 
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#eab308', strokeWidth: 0 }}
                />
              )}
              
              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="avgMag" 
                name="Avg Quake Mag" 
                stroke="#f97316" 
                strokeWidth={2} 
                dot={{ r: 3, fill: '#f97316', strokeWidth: 1, stroke: '#fff' }} 
              />
              
              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="maxMag" 
                name="Max Quake Mag" 
                stroke="#ef4444" 
                strokeWidth={2} 
                dot={{ r: 3, fill: '#ef4444', strokeWidth: 1, stroke: '#fff' }} 
              />
              
              <YAxis yAxisId="volcano" orientation="right" hide={true} domain={[0, 200]} />
              <Bar 
                yAxisId="volcano" 
                dataKey="volcanoCount" 
                name="Volcanic Eruptions" 
                fill="#ef4444" 
                radius={[4, 4, 0, 0]} 
                opacity={0.4} 
                barSize={20}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

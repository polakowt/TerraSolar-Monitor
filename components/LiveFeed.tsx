import React, { useState } from 'react';
import { USGSFeature } from '../types';
import { AlertCircle, Activity, Clock, Filter } from 'lucide-react';

interface LiveFeedProps {
  quakes: USGSFeature[];
  loading: boolean;
}

const getMagColor = (mag: number) => {
  if (mag >= 7) return 'bg-red-600 text-white border-red-500';
  if (mag >= 5) return 'bg-orange-500 text-white border-orange-400';
  if (mag >= 3) return 'bg-yellow-500 text-black border-yellow-400';
  return 'bg-emerald-500 text-white border-emerald-400';
};

export const LiveFeed: React.FC<LiveFeedProps> = ({ quakes, loading }) => {
  const [minFilter, setMinFilter] = useState(2.5);

  const filteredQuakes = quakes.filter(q => q.properties.mag >= minFilter);

  const FilterButton = ({ val, label }: { val: number, label: string }) => (
    <button
      onClick={() => setMinFilter(val)}
      className={`px-2 py-1 text-[10px] uppercase font-bold rounded transition-colors border ${
        minFilter === val
          ? 'bg-emerald-500 text-white border-emerald-400'
          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
      }`}
    >
      {label}
    </button>
  );

  if (loading && quakes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 bg-slate-850 rounded-xl border border-slate-700">
        <Activity className="w-6 h-6 animate-spin mr-2" />
        Loading Live Feed...
      </div>
    );
  }

  return (
    <div className="bg-slate-850 rounded-xl border border-slate-700 h-full flex flex-col overflow-hidden">
      <div className="p-3 border-b border-slate-700 bg-slate-900/50 flex flex-col gap-2 sticky top-0 z-10">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-slate-100 flex items-center gap-2 text-sm">
            <Activity className="w-4 h-4 text-emerald-400" />
            Live Feed
          </h3>
          <div className="flex items-center gap-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] text-emerald-400 ml-1 font-mono">LIVE</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
                <Filter className="w-3 h-3" />
                <span>Filter:</span>
            </div>
            <div className="flex gap-1">
                <FilterButton val={2.5} label="All" />
                <FilterButton val={4.0} label="4.0+" />
                <FilterButton val={5.0} label="5.0+" />
            </div>
        </div>
      </div>
      
      <div className="overflow-y-auto flex-1 p-2 space-y-2">
        {filteredQuakes.length === 0 ? (
           <div className="text-center text-slate-500 py-8 text-sm">
               No earthquakes match the filter.
           </div>
        ) : (
            filteredQuakes.map((quake) => (
            <div 
                key={quake.id} 
                className="group p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 transition-all cursor-default"
            >
                <div className="flex justify-between items-start mb-1">
                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${getMagColor(quake.properties.mag)}`}>
                    {quake.properties.mag.toFixed(1)}
                </span>
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(quake.properties.time).toLocaleDateString()}
                </span>
                </div>
                <div className="text-sm font-medium text-slate-200 truncate" title={quake.properties.place}>
                {quake.properties.place}
                </div>
                <div className="mt-1 flex justify-between items-end">
                <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(quake.properties.time).toLocaleTimeString()}
                </span>
                {quake.properties.tsunami === 1 && (
                    <span className="text-[10px] text-blue-400 flex items-center gap-1 bg-blue-900/30 px-2 py-0.5 rounded-full border border-blue-800">
                    <AlertCircle className="w-3 h-3" /> Warning
                    </span>
                )}
                </div>
            </div>
            ))
        )}
      </div>
    </div>
  );
};

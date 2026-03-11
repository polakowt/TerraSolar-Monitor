import React, { useEffect, useState } from 'react';
import { Mountain, AlertTriangle, Flame, Activity, Loader2 } from 'lucide-react';
import { VolcanoEvent } from '../types';
import { fetchLiveVolcanoes } from '../services/gemini';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Erupting': return 'bg-red-500/20 text-red-400 border-red-500/50';
    case 'Warning': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
    case 'Unrest': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
    default: return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'Erupting': return <Flame className="w-3 h-3" />;
    case 'Warning': return <AlertTriangle className="w-3 h-3" />;
    case 'Unrest': return <Activity className="w-3 h-3" />;
    default: return <Mountain className="w-3 h-3" />;
  }
};

export const VolcanoFeed: React.FC = () => {
  const [volcanoes, setVolcanoes] = useState<VolcanoEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadVolcanoes = async () => {
      setLoading(true);
      try {
        const items = await fetchLiveVolcanoes();
        if (items && items.length > 0) {
          setVolcanoes(items);
        }
      } catch (error) {
        console.error("Failed to load volcanoes", error);
      } finally {
        setLoading(false);
      }
    };
    loadVolcanoes();
  }, []);

  return (
    <div className="bg-slate-850 rounded-xl border border-slate-700 h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex items-center gap-2">
        <Mountain className="w-5 h-5 text-orange-500" />
        <h3 className="font-semibold text-slate-100">Active Volcanoes</h3>
        {loading && <Loader2 className="w-4 h-4 text-orange-500 animate-spin ml-auto" />}
      </div>
      <div className="overflow-y-auto flex-1 p-4 space-y-3">
        {loading && volcanoes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            <p className="text-sm">Scanning global volcanic activity...</p>
          </div>
        ) : volcanoes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            <p className="text-sm">No active volcanoes found.</p>
          </div>
        ) : (
          volcanoes.map((volcano) => (
            <div key={volcano.id} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-200">{volcano.name}</h4>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block"></span>
                    {volcano.location}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1 ${getStatusColor(volcano.status)}`}>
                  {getStatusIcon(volcano.status)}
                  {volcano.status}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{volcano.details}</p>
              <div className="mt-2 text-[10px] text-slate-500 font-mono text-right">
                Updated: {new Date(volcano.lastUpdated).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

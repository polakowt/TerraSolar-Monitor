import React, { useEffect, useState } from 'react';
import { Newspaper, Fish, Sun, Mountain, Activity, ExternalLink, Loader2 } from 'lucide-react';
import { NewsItem } from '../types';
import { fetchLiveNews } from '../services/gemini';

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'marine': return <Fish className="w-4 h-4 text-cyan-400" />;
    case 'solar': return <Sun className="w-4 h-4 text-yellow-400" />;
    case 'volcanic': return <Mountain className="w-4 h-4 text-orange-500" />;
    case 'seismic': return <Activity className="w-4 h-4 text-emerald-400" />;
    default: return <Newspaper className="w-4 h-4 text-slate-400" />;
  }
};

export const NewsFeed: React.FC = () => {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNews = async () => {
      setLoading(true);
      try {
        const items = await fetchLiveNews();
        if (items && items.length > 0) {
          // Sort items from most recent to least recent
          const sortedItems = items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setNewsItems(sortedItems);
        }
      } catch (error) {
        console.error("Failed to load news", error);
      } finally {
        setLoading(false);
      }
    };
    loadNews();
  }, []);

  return (
    <div className="bg-slate-850 rounded-xl border border-slate-700 h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex items-center gap-2">
        <Newspaper className="w-5 h-5 text-blue-400" />
        <h3 className="font-semibold text-slate-100">Global Earth & Space News</h3>
        {loading && <Loader2 className="w-4 h-4 text-blue-400 animate-spin ml-auto" />}
      </div>
      <div className="overflow-y-auto flex-1 p-4 space-y-4">
        {loading && newsItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm">AI is scouring the web for the latest news...</p>
          </div>
        ) : newsItems.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            <p className="text-sm">No recent news found.</p>
          </div>
        ) : (
          newsItems.map((news) => (
            <div key={news.id} className="border-b border-slate-700/50 pb-4 last:border-0 last:pb-0">
              <div className="flex items-center gap-2 mb-2">
                {getCategoryIcon(news.category)}
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{news.source}</span>
                <span className="text-[10px] text-slate-500 ml-auto">
                  {new Date(news.date).toLocaleDateString()}
                </span>
              </div>
              <a href={news.url} target="_blank" rel="noopener noreferrer" className="group/link flex items-start gap-2 mb-1">
                <h4 className="text-sm font-semibold text-slate-200 leading-snug group-hover/link:text-blue-400 transition-colors">{news.title}</h4>
                <ExternalLink className="w-3 h-3 text-slate-500 group-hover/link:text-blue-400 mt-0.5 opacity-0 group-hover/link:opacity-100 transition-all shrink-0" />
              </a>
              <p className="text-xs text-slate-400 leading-relaxed">{news.summary}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

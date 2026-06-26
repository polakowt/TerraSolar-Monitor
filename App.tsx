import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { USGSFeature, YearlyStat } from './types';
import { fetchRecentLiveFeed, fetchHistoricalTrends } from './services/usgs';
import { fetchCMEHistory } from './services/nasa';
import { requestAnalysis, fetchVolcanoHistory, ChatMessage } from './services/gemini';
import { LiveFeed } from './components/LiveFeed';
import { TrendChart } from './components/TrendChart';
import { StatsCard } from './components/StatsCard';
import { NewsFeed } from './components/NewsFeed';
import { VolcanoFeed } from './components/VolcanoFeed';
import { QuakeMap } from './components/QuakeMap';
import { Activity, Globe, Zap, BrainCircuit, RefreshCw, Flame, Send, Sparkles, Trash2 } from 'lucide-react';

// Minimal markdown renderer for the assistant's replies: **bold**, bullet
// lists ("- "/"* "), numbered lists, and paragraphs. Avoids a markdown dep.
const renderInline = (s: string) =>
  s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    return m
      ? <strong key={i} className="font-semibold text-white">{m[1]}</strong>
      : <React.Fragment key={i}>{part}</React.Fragment>;
  });

const RichText: React.FC<{ text: string }> = ({ text }) => {
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (key: string) => {
    if (bullets.length) {
      blocks.push(
        <ul key={key} className="list-disc pl-5 space-y-1 my-1">
          {bullets.map((b, j) => <li key={j}>{renderInline(b)}</li>)}
        </ul>
      );
      bullets = [];
    }
  };
  text.split('\n').forEach((raw, idx) => {
    const line = raw.trim();
    const bullet = line.match(/^[-*]\s+(.*)/) || line.match(/^\d+\.\s+(.*)/);
    if (bullet) {
      bullets.push(bullet[1]);
    } else {
      flush(`ul-${idx}`);
      if (line) blocks.push(<p key={idx} className="my-1">{renderInline(line)}</p>);
    }
  });
  flush('ul-end');
  return <div className="space-y-1">{blocks}</div>;
};

const App: React.FC = () => {
  const [recentQuakes, setRecentQuakes] = useState<USGSFeature[]>([]);
  const [historicalData, setHistoricalData] = useState<YearlyStat[]>([]);
  const [loadingLive, setLoadingLive] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  // Configuration State
  const [minMagnitude, setMinMagnitude] = useState(5.0);
  const [historyRange, setHistoryRange] = useState(10); // Default to 10 years for speed
  
  // AI Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiInput, setAiInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadLiveData = useCallback(async () => {
    setLoadingLive(true);
    try {
      const data = await fetchRecentLiveFeed();
      setRecentQuakes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLive(false);
    }
  }, []);

  const loadHistoryData = useCallback(async (minMag: number, range: number) => {
    setLoadingHistory(true);
    try {
      // Fetch both datasets
      const currentYear = new Date().getFullYear();
      const startYear = currentYear - range;

      // Start fetching simultaneously
      const usgsPromise = fetchHistoricalTrends(minMag, range);
      const nasaPromise = fetchCMEHistory(startYear, currentYear);
      const volcanoPromise = fetchVolcanoHistory(startYear, currentYear);

      const [usgsData, nasaData, volcanoData] = await Promise.all([usgsPromise, nasaPromise, volcanoPromise]);

      // Merge Data
      const mergedData = usgsData.map(stat => ({
        ...stat,
        // Allow undefined if data is missing, so UI shows N/A instead of 0
        cmeCount: nasaData[stat.year]?.count,
        cmeMeanSpeed: nasaData[stat.year]?.speed,
        volcanoCount: volcanoData[stat.year]
      }));

      setHistoricalData(mergedData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadLiveData();
    // Refresh live feed every 60 seconds
    const interval = setInterval(loadLiveData, 60000);
    return () => clearInterval(interval);
  }, []);

  // Reload history when filters change
  useEffect(() => {
    loadHistoryData(minMagnitude, historyRange);
  }, [minMagnitude, historyRange, loadHistoryData]);

  const handleManualRefresh = () => {
    loadLiveData();
    loadHistoryData(minMagnitude, historyRange);
  };

  const sendToAnalyst = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || aiLoading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', text: trimmed }];
    setMessages(nextMessages);
    setAiInput('');
    setAiError(null);
    setAiLoading(true);
    try {
      const reply = await requestAnalysis(nextMessages, historicalData, recentQuakes);
      setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
    } catch (err: any) {
      setAiError(err?.message || 'Failed to generate analysis.');
    } finally {
      setAiLoading(false);
    }
  }, [messages, aiLoading, historicalData, recentQuakes]);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendToAnalyst(aiInput);
  };

  const handleClearChat = () => {
    setMessages([]);
    setAiError(null);
  };

  // Auto-scroll the chat to the latest message.
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, aiLoading]);

  // --- STAT CALCULATIONS ---

  // 1. Last 24 Hours Stats & Trend
  const last24hStats = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const oneDayAgo = now - dayMs;
    
    // Count last 24h
    const count = recentQuakes.filter(q => q.properties.time > oneDayAgo).length;

    // Calculate Daily Trend (Last 30 days)
    const dailyCounts = new Array(30).fill(0);
    recentQuakes.forEach(q => {
      const daysAgo = Math.floor((now - q.properties.time) / dayMs);
      if (daysAgo >= 0 && daysAgo < 30) {
        dailyCounts[29 - daysAgo]++; // 29 is today, 0 is 30 days ago
      }
    });

    // Average
    const total = dailyCounts.reduce((a, b) => a + b, 0);
    const avg = total > 0 ? Math.round(total / 30) : 0;
    
    // Simple trend direction (compare last 3 days vs avg)
    const recentAvg = (dailyCounts[29] + dailyCounts[28] + dailyCounts[27]) / 3;
    const direction = recentAvg > avg * 1.1 ? 'up' : recentAvg < avg * 0.9 ? 'down' : 'neutral';

    return { count, dailyCounts, avg, direction };
  }, [recentQuakes]);


  // 2. Significant Events Stats (Mag 5.0+)
  const significantStats = useMemo(() => {
     // Filter for 5.0+
     const significantQuakes = recentQuakes.filter(q => q.properties.mag >= 5.0);
     const count = significantQuakes.length; // In loaded window (30 days)

     // Group by day for sparkline
     const now = Date.now();
     const dayMs = 24 * 60 * 60 * 1000;
     const dailyCounts = new Array(30).fill(0);
     
     significantQuakes.forEach(q => {
       const daysAgo = Math.floor((now - q.properties.time) / dayMs);
       if (daysAgo >= 0 && daysAgo < 30) {
         dailyCounts[29 - daysAgo]++;
       }
     });

     // Calculate historical monthly average for comparison
     // We have 'historicalData' which is yearly counts of minMag
     // Ensure we have data before calculating
     const lastYearData = historicalData.find(d => d.year === new Date().getFullYear() - 1);
     const histMonthlyAvg = lastYearData ? (lastYearData.count / 12).toFixed(1) : 'N/A';

     return { count, dailyCounts, histMonthlyAvg };
  }, [recentQuakes, historicalData]);


  // 3. Max Magnitude
  const maxMagRecent = recentQuakes.length > 0 
    ? Math.max(...recentQuakes.map(q => q.properties.mag)).toFixed(1)
    : '0.0';

  
  // 4. CME Stats
  const cmeStats = useMemo(() => {
    // Current year data
    const currentYearData = historicalData[historicalData.length - 1];
    // If undefined, we default to 0 for calculation safety, but card will show N/A via check below
    const currentSpeed = currentYearData?.cmeMeanSpeed || 0;
    const hasCurrentData = currentYearData?.cmeMeanSpeed !== undefined;
    
    // Historical Average Speed (All available years)
    const validYears = historicalData.filter(d => d.cmeMeanSpeed && d.cmeMeanSpeed > 0);
    const totalSpeed = validYears.reduce((acc, curr) => acc + (curr.cmeMeanSpeed || 0), 0);
    const histAvg = validYears.length > 0 ? Math.round(totalSpeed / validYears.length) : 0;

    return { currentSpeed, histAvg, hasCurrentData };
  }, [historicalData]);


  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700 pb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white flex items-center gap-3">
              <Globe className="w-8 h-8 text-blue-500" />
              TerraSolar Monitor
            </h1>
            <p className="text-slate-400 mt-2">Real-time global earthquake, volcano &amp; space-weather monitor with decadal trend analysis</p>
          </div>
          <div className="flex items-center gap-3">
             <button 
              onClick={handleManualRefresh}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border border-slate-600"
            >
              <RefreshCw className={`w-4 h-4 ${loadingLive || loadingHistory ? 'animate-spin' : ''}`} />
              Refresh Feed
            </button>
            <div className="text-xs text-right hidden md:block">
              <div className="text-slate-400">Data Sources</div>
              <div className="font-mono text-emerald-400">USGS · NASA · NOAA · GVP</div>
            </div>
          </div>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard 
            label="Last 24 Hours" 
            value={last24hStats.count} 
            subtext="Global events (Mag 2.5+)" 
            average={last24hStats.avg}
            trendData={last24hStats.dailyCounts}
            trendDirection={last24hStats.direction as any}
            icon={ClockIcon} 
            colorClass="text-blue-500" 
            loading={loadingLive}
          />
          <StatsCard 
            label="Significant Events" 
            value={significantStats.count} 
            subtext="Mag 5.0+ in last 30 days" 
            average={significantStats.histMonthlyAvg}
            trendData={significantStats.dailyCounts}
            icon={AlertIcon} 
            colorClass="text-orange-500" 
            loading={loadingLive}
          />
           <StatsCard 
            label="Max Magnitude" 
            value={maxMagRecent} 
            subtext="Highest in last 30 days" 
            icon={Zap} 
            colorClass="text-red-500" 
            loading={loadingLive}
          />
          <StatsCard 
            label="Avg CME Speed (YTD)" 
            // Only show value if data is fetched and valid, otherwise N/A
            value={cmeStats.hasCurrentData && cmeStats.currentSpeed > 0 ? `${cmeStats.currentSpeed} km/s` : 'N/A'} 
            average={`${cmeStats.histAvg} km/s`}
            subtext="Solar Event Intensity" 
            icon={Flame} 
            colorClass="text-yellow-500" 
            loading={loadingHistory}
          />
        </div>

        {/* Hero: Live Seismic Map + Live Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[560px] lg:h-[660px]">
            <QuakeMap quakes={recentQuakes} loading={loadingLive} />
          </div>
          <div className="lg:col-span-1 h-[560px] lg:h-[660px]">
            <LiveFeed quakes={recentQuakes} loading={loadingLive} />
          </div>
        </div>

        {/* Trends + AI Analyst */}
        <div className="space-y-6">
            <TrendChart
              data={historicalData} 
              loading={loadingHistory} 
              currentMinMag={minMagnitude}
              currentRange={historyRange}
              onFilterChange={setMinMagnitude}
              onRangeChange={setHistoryRange}
            />

            {/* AI Analysis Section (chat) */}
            <div className="bg-slate-850 border border-slate-700 rounded-xl p-5 flex flex-col h-[480px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-purple-400" />
                  AI Data Analyst
                </h3>
                <div className="flex items-center gap-2">
                  {messages.length > 0 && (
                    <button
                      onClick={handleClearChat}
                      disabled={aiLoading}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium rounded-lg border border-slate-600 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" /> Clear
                    </button>
                  )}
                  <button
                    onClick={() => sendToAnalyst('Give me a concise overview report of current global seismic, solar, and volcanic activity and any notable trends.')}
                    disabled={aiLoading || loadingHistory}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <Sparkles className="w-3 h-3 text-yellow-400" /> Report
                  </button>
                </div>
              </div>

              {/* Conversation thread */}
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800 mb-4 flex-1 min-h-0 overflow-y-auto space-y-4">
                {messages.length === 0 && !aiLoading && !aiError && (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-slate-500">
                    <BrainCircuit className="w-8 h-8 text-slate-700" />
                    <p className="text-sm italic max-w-sm">
                      Ask anything about earthquakes, volcanoes, or space weather — including "what if" scenarios. Or hit "Report" for an overview.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {[
                        'What if the Pacific Ring of Fire all went off at once?',
                        'Are major earthquakes getting more frequent?',
                        'Can solar storms trigger earthquakes?',
                      ].map(s => (
                        <button
                          key={s}
                          onClick={() => sendToAnalyst(s)}
                          className="text-xs px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:text-purple-300 hover:border-purple-700 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-purple-600/90 text-white'
                        : 'bg-slate-800 text-slate-200 border border-slate-700'
                    }`}>
                      {m.role === 'assistant' ? <RichText text={m.text} /> : m.text}
                    </div>
                  </div>
                ))}

                {aiLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                {aiError && <p className="text-red-400 text-sm">{aiError}</p>}
                <div ref={chatEndRef} />
              </div>

              {/* Input Area */}
              <form onSubmit={handleCustomSubmit} className="relative">
                <input
                   type="text"
                   value={aiInput}
                   onChange={(e) => setAiInput(e.target.value)}
                   placeholder="Ask anything about quakes, volcanoes, or space weather..."
                   disabled={aiLoading}
                   className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-4 pr-12 py-3 text-sm text-slate-200 focus:outline-none focus:border-purple-500 transition-colors placeholder:text-slate-600 disabled:opacity-50"
                />
                <button
                   type="submit"
                   disabled={aiLoading || !aiInput.trim()}
                   className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 transition-colors"
                >
                   <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
        </div>

        {/* Additional Feeds Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
          <NewsFeed />
          <VolcanoFeed />
        </div>
      </div>
    </div>
  );
};

// Simple Icons wrapped for use in StatsCard
const ClockIcon = (props: any) => <Activity {...props} />;
const AlertIcon = (props: any) => <Zap {...props} />;

export default App;

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { USGSFeature, YearlyStat, AnalysisState } from './types';
import { fetchRecentLiveFeed, fetchHistoricalTrends } from './services/usgs';
import { fetchCMEHistory } from './services/nasa';
import { analyzeEarthquakeTrends, fetchVolcanoHistory } from './services/gemini';
import { LiveFeed } from './components/LiveFeed';
import { TrendChart } from './components/TrendChart';
import { StatsCard } from './components/StatsCard';
import { NewsFeed } from './components/NewsFeed';
import { VolcanoFeed } from './components/VolcanoFeed';
import { Activity, Globe, Zap, BrainCircuit, RefreshCw, Flame, Send, Sparkles } from 'lucide-react';

const App: React.FC = () => {
  const [recentQuakes, setRecentQuakes] = useState<USGSFeature[]>([]);
  const [historicalData, setHistoricalData] = useState<YearlyStat[]>([]);
  const [loadingLive, setLoadingLive] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  // Configuration State
  const [minMagnitude, setMinMagnitude] = useState(5.0);
  const [historyRange, setHistoryRange] = useState(10); // Default to 10 years for speed
  
  // AI State
  const [analysis, setAnalysis] = useState<AnalysisState>({
    isLoading: false,
    content: null,
    error: null
  });
  const [customQuestion, setCustomQuestion] = useState('');

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

  const handleGenerateAnalysis = async (question?: string) => {
    if (historicalData.length === 0) return;
    
    setAnalysis({ isLoading: true, content: null, error: null });
    try {
      const result = await analyzeEarthquakeTrends(historicalData, recentQuakes, question);
      setAnalysis({ isLoading: false, content: result, error: null });
    } catch (err) {
      setAnalysis({ isLoading: false, content: null, error: 'Failed to generate analysis.' });
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestion.trim()) return;
    handleGenerateAnalysis(customQuestion);
    setCustomQuestion('');
  };

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
            <p className="text-slate-400 mt-2">Real-time Earth & Space Monitor with Live News and Decadal Trend Analysis</p>
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
              <div className="font-mono text-emerald-400">USGS & NASA</div>
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

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Chart Area (Spans 2 cols) */}
          <div className="lg:col-span-2 space-y-6 flex flex-col">
            <TrendChart 
              data={historicalData} 
              loading={loadingHistory} 
              currentMinMag={minMagnitude}
              currentRange={historyRange}
              onFilterChange={setMinMagnitude}
              onRangeChange={setHistoryRange}
            />

            {/* AI Analysis Section */}
            <div className="bg-slate-850 border border-slate-700 rounded-xl p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-purple-400" />
                  AI Data Analyst
                </h3>
                <button
                  onClick={() => handleGenerateAnalysis()}
                  disabled={analysis.isLoading || loadingHistory}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-600 transition-colors flex items-center gap-2"
                >
                   <Sparkles className="w-3 h-3 text-yellow-400" />
                   Standard Report
                </button>
              </div>
              
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800 mb-4 min-h-[120px] max-h-[300px] overflow-y-auto">
                {analysis.isLoading ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-4 bg-slate-800 rounded w-3/4"></div>
                    <div className="h-4 bg-slate-800 rounded w-1/2"></div>
                    <div className="h-4 bg-slate-800 rounded w-5/6"></div>
                  </div>
                ) : analysis.error ? (
                  <p className="text-red-400 text-sm">{analysis.error}</p>
                ) : analysis.content ? (
                  <div className="prose prose-invert prose-sm max-w-none text-slate-300">
                    <p className="whitespace-pre-line leading-relaxed">{analysis.content}</p>
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm italic">
                    Ask a question below or click "Standard Report" for an AI analysis of the correlation between seismic and solar data.
                  </p>
                )}
              </div>

              {/* Input Area */}
              <form onSubmit={handleCustomSubmit} className="relative">
                <input 
                   type="text"
                   value={customQuestion}
                   onChange={(e) => setCustomQuestion(e.target.value)}
                   placeholder="Ask a specific question about the data..."
                   disabled={analysis.isLoading || loadingHistory}
                   className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-4 pr-12 py-3 text-sm text-slate-200 focus:outline-none focus:border-purple-500 transition-colors placeholder:text-slate-600 disabled:opacity-50"
                />
                <button
                   type="submit"
                   disabled={analysis.isLoading || !customQuestion.trim() || loadingHistory}
                   className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 transition-colors"
                >
                   <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>

          {/* Right Sidebar: Live Feed - Fixed height to match main content approx */}
          <div className="lg:col-span-1 h-[600px] lg:h-[700px]">
            <LiveFeed quakes={recentQuakes} loading={loadingLive} />
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

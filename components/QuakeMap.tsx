import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import { USGSFeature } from '../types';
import { X, Activity, ExternalLink, ZoomIn, ZoomOut, Maximize } from 'lucide-react';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const W = 800;
const H = 380;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ZOOM = 10;

// Color ramp by magnitude — calm green through alarming magenta.
const magColor = (mag: number) => {
  if (mag >= 7) return '#e879f9'; // fuchsia-400
  if (mag >= 6) return '#ef4444'; // red-500
  if (mag >= 5) return '#f97316'; // orange-500
  if (mag >= 4) return '#f59e0b'; // amber-500
  if (mag >= 3) return '#eab308'; // yellow-500
  return '#10b981';               // emerald-500
};

interface QuakeMapProps {
  quakes: USGSFeature[];
  loading: boolean;
}

interface Transform { k: number; x: number; y: number; }

export const QuakeMap: React.FC<QuakeMapProps> = ({ quakes, loading }) => {
  const [minMag, setMinMag] = useState(4.0);
  const [selected, setSelected] = useState<USGSFeature | null>(null);
  const [land, setLand] = useState<any[]>([]);
  const [t, setT] = useState<Transform>({ k: 1, x: 0, y: 0 });

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);

  // Load the world basemap once.
  useEffect(() => {
    let cancelled = false;
    fetch(GEO_URL)
      .then((r) => r.json())
      .then((topology: any) => {
        if (cancelled) return;
        const fc: any = feature(topology, topology.objects.countries);
        setLand(fc.features || []);
      })
      .catch((e) => console.error('Basemap load failed:', e));
    return () => {
      cancelled = true;
    };
  }, []);

  const projection = useMemo(() => {
    const proj = geoNaturalEarth1();
    if (land.length > 0) {
      proj.fitExtent([[6, 6], [W - 6, H - 6]], { type: 'FeatureCollection', features: land } as any);
    } else {
      proj.scale(150).translate([W / 2, H / 2]);
    }
    return proj;
  }, [land]);

  const pathGen = useMemo(() => geoPath(projection), [projection]);
  const now = Date.now();

  const visible = useMemo(() => {
    return quakes
      .filter((q) => q.properties.mag >= minMag && q.geometry?.coordinates)
      .sort((a, b) => a.properties.mag - b.properties.mag)
      .slice(-1000);
  }, [quakes, minMag]);

  const stats = useMemo(() => {
    const last24 = visible.filter((q) => now - q.properties.time < DAY_MS).length;
    const max = visible.reduce((m, q) => Math.max(m, q.properties.mag), 0);
    return { count: visible.length, last24, max };
  }, [visible, now]);

  // --- Zoom & pan helpers ---
  const clampPan = (k: number, x: number, y: number): Transform => ({
    k,
    x: Math.min(0, Math.max(W * (1 - k), x)),
    y: Math.min(0, Math.max(H * (1 - k), y)),
  });

  // Map a screen point to SVG viewBox coordinates (accounts for letterboxing).
  const toSvgPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const zoomAround = useCallback((px: number, py: number, factor: number) => {
    setT((prev) => {
      const k = Math.min(MAX_ZOOM, Math.max(1, prev.k * factor));
      if (k === prev.k) return prev;
      const x = px - (px - prev.x) * (k / prev.k);
      const y = py - (py - prev.y) * (k / prev.k);
      return clampPan(k, x, y);
    });
  }, []);

  // Wheel zoom — registered non-passively so we can preventDefault the scroll.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toSvgPoint(e.clientX, e.clientY);
      zoomAround(p.x, p.y, e.deltaY < 0 ? 1.2 : 1 / 1.2);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [zoomAround]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = toSvgPoint(e.clientX, e.clientY);
    movedRef.current = false;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const cur = toSvgPoint(e.clientX, e.clientY);
    const dx = cur.x - dragRef.current.x;
    const dy = cur.y - dragRef.current.y;
    if (Math.abs(dx) > 1.5 || Math.abs(dy) > 1.5) movedRef.current = true;
    setT((prev) => clampPan(prev.k, prev.x + dx, prev.y + dy));
    dragRef.current = cur;
  };
  const endDrag = () => { dragRef.current = null; };

  const zoomButton = (factor: number) => zoomAround(W / 2, H / 2, factor);
  const reset = () => setT({ k: 1, x: 0, y: 0 });

  const FilterButton = ({ val, label }: { val: number; label: string }) => (
    <button
      onClick={() => setMinMag(val)}
      className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors border ${
        minMag === val
          ? 'bg-emerald-500 text-white border-emerald-400'
          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
      }`}
    >
      {label}
    </button>
  );

  const k = t.k;

  return (
    <div className="bg-slate-850 border border-slate-700 rounded-xl p-5 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-4 gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            Live Global Seismicity
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Last 30 days · sized &amp; colored by magnitude · pulsing = last 24h · scroll to zoom, drag to pan
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider mr-1">Min mag</span>
          <FilterButton val={2.5} label="2.5+" />
          <FilterButton val={4.0} label="4+" />
          <FilterButton val={5.0} label="5+" />
          <FilterButton val={6.0} label="6+" />
        </div>
      </div>

      {/* Quick stats strip */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 px-3 py-2">
          <div className="text-2xl font-bold text-slate-100 leading-none">{loading ? '—' : stats.count}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Plotted</div>
        </div>
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 px-3 py-2">
          <div className="text-2xl font-bold text-emerald-400 leading-none">{loading ? '—' : stats.last24}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Last 24h</div>
        </div>
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 px-3 py-2">
          <div className="text-2xl font-bold leading-none" style={{ color: magColor(stats.max) }}>
            {loading ? '—' : stats.max.toFixed(1)}
          </div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Strongest</div>
        </div>
      </div>

      <div className="flex-1 bg-slate-900/50 rounded-lg overflow-hidden border border-slate-800 relative min-h-[260px] group">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full touch-none"
          style={{ cursor: dragRef.current ? 'grabbing' : 'grab' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onClick={() => { if (!movedRef.current) setSelected(null); }}
        >
          <g transform={`translate(${t.x} ${t.y}) scale(${k})`}>
            {/* Land */}
            <g>
              {land.map((f, i) => (
                <path key={i} d={pathGen(f) || undefined} fill="#1e293b" stroke="#334155" strokeWidth={0.4 / k} />
              ))}
            </g>
            {/* Quakes */}
            <g>
              {visible.map((q) => {
                const [lon, lat] = q.geometry.coordinates;
                const xy = projection([lon, lat]);
                if (!xy) return null;
                const mag = q.properties.mag;
                const color = magColor(mag);
                const radius = Math.max(1.8, (mag - 1.5) * 1.5) / k;
                const isRecent = now - q.properties.time < DAY_MS;
                const isSelected = selected?.id === q.id;
                return (
                  <g
                    key={q.id}
                    transform={`translate(${xy[0]}, ${xy[1]})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!movedRef.current) setSelected(q);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {isRecent && mag >= 4.5 && (
                      <circle r={radius} fill="none" stroke={color} strokeWidth={1 / k} opacity={0.7}>
                        <animate attributeName="r" from={radius} to={radius * 3.2} dur="1.8s" repeatCount="indefinite" />
                        <animate attributeName="opacity" from="0.7" to="0" dur="1.8s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <circle
                      r={radius}
                      fill={color}
                      fillOpacity={isSelected ? 0.95 : 0.65}
                      stroke={isSelected ? '#ffffff' : color}
                      strokeWidth={(isSelected ? 1.5 : 0.6) / k}
                    />
                  </g>
                );
              })}
            </g>
          </g>
        </svg>

        {/* Zoom controls */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button onClick={() => zoomButton(1.5)} className="p-2 bg-slate-800/90 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-600 backdrop-blur-sm transition-colors" title="Zoom in"><ZoomIn className="w-4 h-4" /></button>
          <button onClick={() => zoomButton(1 / 1.5)} className="p-2 bg-slate-800/90 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-600 backdrop-blur-sm transition-colors" title="Zoom out"><ZoomOut className="w-4 h-4" /></button>
          <button onClick={reset} className="p-2 bg-slate-800/90 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-600 backdrop-blur-sm transition-colors" title="Reset view"><Maximize className="w-4 h-4" /></button>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="absolute top-4 right-4 bg-slate-800/95 backdrop-blur-md p-4 rounded-xl border border-slate-600 shadow-xl min-w-[230px] max-w-[280px] z-10">
            <button onClick={() => setSelected(null)} className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 mb-3 pr-6">
              <span
                className="text-lg font-bold px-2 py-0.5 rounded"
                style={{
                  backgroundColor: magColor(selected.properties.mag),
                  color: selected.properties.mag >= 3 && selected.properties.mag < 4 ? '#000' : '#fff',
                }}
              >
                M {selected.properties.mag.toFixed(1)}
              </span>
              {now - selected.properties.time < DAY_MS && (
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">New</span>
              )}
            </div>
            <p className="text-sm font-medium text-slate-200 mb-3 leading-snug">{selected.properties.place}</p>
            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">When</span>
                <span className="text-slate-200">{new Date(selected.properties.time).toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Depth</span>
                <span className="text-slate-200">{selected.geometry.coordinates[2]?.toFixed(0)} km</span>
              </div>
              {selected.properties.tsunami === 1 && (
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Tsunami</span>
                  <span className="text-blue-400 font-medium">Alert issued</span>
                </div>
              )}
            </div>
            {selected.properties.url && (
              <a
                href={selected.properties.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                USGS details <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-slate-800/80 backdrop-blur-sm p-3 rounded-lg border border-slate-700 text-xs text-slate-300 pointer-events-none">
          <div className="font-medium text-slate-200 mb-2">Magnitude</div>
          <div className="flex items-center gap-2.5">
            {[
              { c: '#10b981', l: '<3' },
              { c: '#eab308', l: '3' },
              { c: '#f59e0b', l: '4' },
              { c: '#f97316', l: '5' },
              { c: '#ef4444', l: '6' },
              { c: '#e879f9', l: '7+' },
            ].map((s) => (
              <div key={s.l} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.c }} />
                <span>{s.l}</span>
              </div>
            ))}
          </div>
        </div>

        {(loading || land.length === 0) && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px]">
            <div className="bg-slate-800 border border-slate-700 px-5 py-2.5 rounded-full flex items-center gap-2.5">
              <Activity className="w-4 h-4 text-emerald-400 animate-spin" />
              <span className="text-sm font-medium text-slate-200">Loading seismic data…</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

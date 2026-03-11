export interface USGSFeature {
  type: string;
  properties: {
    mag: number;
    place: string;
    time: number;
    updated: number;
    tz: number | null;
    url: string;
    detail: string;
    felt: number | null;
    cdi: number | null;
    mmi: number | null;
    alert: string | null;
    status: string;
    tsunami: number;
    sig: number;
    net: string;
    code: string;
    ids: string;
    sources: string;
    types: string;
    nst: number | null;
    dmin: number | null;
    rms: number | null;
    gap: number | null;
    magType: string;
    type: string;
    title: string;
  };
  geometry: {
    type: string;
    coordinates: [number, number, number]; // long, lat, depth
  };
  id: string;
}

export interface USGSResponse {
  type: string;
  metadata: {
    generated: number;
    url: string;
    title: string;
    status: number;
    api: string;
    count: number;
  };
  features: USGSFeature[];
}

export interface YearlyStat {
  year: number;
  count: number;
  avgMag: number;
  maxMag: number;
  cmeCount?: number;
  cmeMeanSpeed?: number;
  volcanoCount?: number;
}

export interface AnalysisState {
  isLoading: boolean;
  content: string | null;
  error: string | null;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  date: string;
  category: 'seismic' | 'volcanic' | 'marine' | 'solar';
  summary: string;
  url: string;
}

export interface VolcanoEvent {
  id: string;
  name: string;
  location: string;
  status: 'Erupting' | 'Unrest' | 'Warning';
  lastUpdated: string;
  details: string;
}

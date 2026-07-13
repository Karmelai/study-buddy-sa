export interface AzuraCastNowPlayingResponse {
  station?: {
    name?: string;
    listen_url?: string;
    is_public?: boolean;
  };
  now_playing?: {
    song?: {
      title?: string;
      artist?: string;
      album?: string;
      art?: string;
      text?: string;
    };
    elapsed?: number;
    duration?: number;
    remaining?: number;
    played_at?: number;
  };
  listeners?: { current?: number; unique?: number; total?: number };
  is_online?: boolean;
  live?: { is_live?: boolean };
}

export interface NowPlaying {
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
  stationName: string;
  listeners?: number;
  isLive: boolean;
}

export interface RadioContextValue {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  nowPlaying: NowPlaying;
  stationOnline: boolean;
  isLoading: boolean;
  error: string | null;
  openPanel: boolean;
  togglePlayback: () => Promise<void>;
  toggleMuted: () => void;
  setVolume: (volume: number) => void;
  setOpenPanel: (open: boolean) => void;
  refreshNowPlaying: () => Promise<void>;
}

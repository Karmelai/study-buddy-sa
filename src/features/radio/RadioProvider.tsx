import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useKarmelStore } from "@/store/useKarmelStore";
import { RadioPlayer } from "./RadioPlayer";
import type { AzuraCastNowPlayingResponse, NowPlaying, RadioContextValue } from "./radio.types";
import "./radio.css";

const STORAGE_KEY = "karmel-radio-preferences";
const DEFAULT_NOW_PLAYING: NowPlaying = {
  title: "Karmel Radio",
  artist: "Live study broadcast",
  stationName: "Karmel Radio",
  isLive: false,
};

export const RadioContext = createContext<RadioContextValue | null>(null);

// Keep development quiet when the optional broadcast service is not running.
// Set VITE_KARMEL_RADIO_MODE=azuracast to test the live radio integration locally.
const radioMode =
  import.meta.env.VITE_KARMEL_RADIO_MODE || (import.meta.env.DEV ? "off" : "azuracast");
const nowPlayingUrl = import.meta.env.VITE_KARMEL_NOW_PLAYING_URL ?? "/karmel-radio/api/nowplaying";
const streamUrl =
  radioMode === "local"
    ? (import.meta.env.VITE_KARMEL_LOCAL_AUDIO_URL ?? "/audio/karmel-radio/snow-man.mp3")
    : (import.meta.env.VITE_KARMEL_STREAM_URL ?? "/karmel-radio/stream");

export function RadioProvider({ children }: { children: ReactNode }) {
  const isAuthed = useKarmelStore((state) => state.isAuthed);
  const audioRef = useRef<HTMLAudioElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const requestInProgressRef = useRef(false);
  const metadataFailedRef = useRef(false);
  const streamUrlRef = useRef(streamUrl);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(0.8);
  const [nowPlaying, setNowPlaying] = useState(DEFAULT_NOW_PLAYING);
  const [stationOnline, setStationOnline] = useState(radioMode !== "off");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openPanel, setOpenPanelState] = useState(false);
  const [isVisible, setIsVisibleState] = useState(true);

  const refreshNowPlaying = useCallback(async () => {
    if (radioMode === "off") {
      setNowPlaying(DEFAULT_NOW_PLAYING);
      setStationOnline(false);
      setError(null);
      metadataFailedRef.current = false;
      return;
    }
    if (radioMode === "local") {
      setNowPlaying(DEFAULT_NOW_PLAYING);
      setStationOnline(true);
      setError(null);
      metadataFailedRef.current = false;
      return;
    }
    if (requestInProgressRef.current) return;
    requestInProgressRef.current = true;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const response = await fetch(nowPlayingUrl, { signal: controller.signal });
      if (!response.ok) throw new Error(`Now Playing request failed (${response.status})`);
      const data = (await response.json()) as AzuraCastNowPlayingResponse;
      const song = data.now_playing?.song;
      const title = song?.title?.trim() || song?.text?.trim() || "Karmel Radio";
      const artist = song?.artist?.trim() || "Live study broadcast";
      const online = data.is_online !== false && data.station?.is_public !== false;

      setNowPlaying({
        title,
        artist,
        album: song?.album?.trim() || undefined,
        artwork: song?.art?.trim() || undefined,
        stationName: data.station?.name?.trim() || "Karmel Radio",
        listeners: data.listeners?.current,
        isLive: data.live?.is_live ?? online,
      });
      setStationOnline(online);
      setError(null);
      metadataFailedRef.current = false;
    } catch (caught) {
      if ((caught as DOMException).name !== "AbortError") {
        if (import.meta.env.DEV) console.error("Karmel Radio Now Playing request failed", caught);
        // Metadata should never prevent a live stream from playing.
        setNowPlaying(DEFAULT_NOW_PLAYING);
        setStationOnline(true);
        setError(null);
        metadataFailedRef.current = true;
      }
    } finally {
      requestInProgressRef.current = false;
    }
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as {
        volume?: number;
        muted?: boolean;
        openPanel?: boolean;
        visible?: boolean;
      };
      if (typeof saved.volume === "number") setVolumeState(Math.min(1, Math.max(0, saved.volume)));
      if (typeof saved.muted === "boolean") setIsMuted(saved.muted);
      if (typeof saved.openPanel === "boolean") setOpenPanelState(saved.openPanel);
      if (typeof saved.visible === "boolean") setIsVisibleState(saved.visible);
    } catch {
      // Local storage is optional; defaults keep the player usable.
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = isMuted;
  }, [isMuted, volume]);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ volume, muted: isMuted, openPanel, visible: isVisible }),
    );
  }, [isMuted, isVisible, openPanel, volume]);

  useEffect(() => {
    if (radioMode === "off") return;
    let pollingTimer: number | undefined;
    let cancelled = false;
    const poll = async () => {
      await refreshNowPlaying();
      if (!cancelled) {
        pollingTimer = window.setTimeout(poll, metadataFailedRef.current ? 30_000 : 15_000);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (pollingTimer) window.clearTimeout(pollingTimer);
      controllerRef.current?.abort();
    };
  }, [refreshNowPlaying]);

  const setOpenPanel = useCallback(
    (open: boolean) => {
      setOpenPanelState(open);
      if (open) void refreshNowPlaying();
    },
    [refreshNowPlaying],
  );

  const setIsVisible = useCallback((visible: boolean) => {
    setIsVisibleState(visible);
    if (!visible) setOpenPanelState(false);
  }, []);

  const setVolume = useCallback((nextVolume: number) => {
    setVolumeState(Math.min(1, Math.max(0, nextVolume)));
  }, []);

  const toggleMuted = useCallback(() => setIsMuted((muted) => !muted), []);

  const togglePlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      if (audio.src !== streamUrlRef.current) {
        audio.src = streamUrlRef.current;
        audio.load();
      }
      await audio.play();
    } catch (caught) {
      if (import.meta.env.DEV) console.error("Karmel Radio playback failed", caught);
      setError("Unable to start Karmel Radio. Please check your connection and try again.");
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo<RadioContextValue>(
    () => ({
      isPlaying,
      isMuted,
      volume,
      nowPlaying,
      stationOnline,
      isLoading,
      error,
      openPanel,
      isVisible,
      togglePlayback,
      toggleMuted,
      setVolume,
      setOpenPanel,
      setIsVisible,
      refreshNowPlaying,
    }),
    [
      error,
      isLoading,
      isMuted,
      isPlaying,
      isVisible,
      nowPlaying,
      openPanel,
      refreshNowPlaying,
      setOpenPanel,
      setIsVisible,
      setVolume,
      stationOnline,
      toggleMuted,
      togglePlayback,
      volume,
    ],
  );

  return (
    <RadioContext.Provider value={value}>
      <audio
        ref={audioRef}
        preload="none"
        onPlaying={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setIsPlaying(false);
          setError("The live stream could not be played right now.");
        }}
      />
      {children}
      {isAuthed && isVisible && <RadioPlayer />}
    </RadioContext.Provider>
  );
}

import { useEffect } from "react";
import { LoaderCircle, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { RadioToggle } from "./RadioToggle";
import { useRadio } from "./useRadio";

export function RadioPlayer() {
  const {
    error,
    isLoading,
    isMuted,
    isPlaying,
    nowPlaying,
    openPanel,
    setOpenPanel,
    setVolume,
    stationOnline,
    toggleMuted,
    togglePlayback,
    volume,
  } = useRadio();

  useEffect(() => {
    if (!openPanel) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenPanel(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [openPanel, setOpenPanel]);

  const status = error
    ? "Radio status: error"
    : !stationOnline
      ? "Radio status: station temporarily offline"
      : isLoading
        ? "Radio status: connecting"
        : isPlaying
          ? "Radio status: live"
          : "Radio status: paused";

  return (
    <div className="karmel-radio" aria-live="polite">
      {openPanel && (
        <section className="karmel-radio-panel" aria-label="Karmel Radio player">
          <div className="karmel-radio-header">
            <div>
              <p className="karmel-radio-eyebrow">KARMEL RADIO</p>
              <p className="karmel-radio-live-label">
                <span className={isPlaying && stationOnline ? "karmel-radio-dot is-live" : "karmel-radio-dot"} />
                {stationOnline ? (isPlaying ? "LIVE / NOW PLAYING" : "LIVE BROADCAST") : "OFFLINE"}
              </p>
            </div>
            <button type="button" className="karmel-radio-icon-button" onClick={() => setOpenPanel(false)} aria-label="Close Karmel Radio player">
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="karmel-radio-track">
            {nowPlaying.artwork ? (
              <img className="karmel-radio-art" src={nowPlaying.artwork} alt="Album artwork" />
            ) : (
              <div className="karmel-radio-art karmel-radio-placeholder" aria-label="Karmel Radio artwork">
                <span>K</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="karmel-radio-title" title={nowPlaying.title}>{stationOnline ? nowPlaying.title : "Station temporarily offline"}</p>
              <p className="karmel-radio-artist" title={nowPlaying.artist}>{nowPlaying.artist}</p>
              {nowPlaying.album && <p className="karmel-radio-album" title={nowPlaying.album}>{nowPlaying.album}</p>}
            </div>
          </div>

          <div className="karmel-radio-controls">
            <button
              type="button"
              className="karmel-radio-play-button"
              onClick={() => void togglePlayback()}
              disabled={isLoading || !stationOnline}
              aria-label={isPlaying ? "Pause Karmel Radio" : "Play Karmel Radio"}
            >
              {isLoading ? <LoaderCircle className="animate-spin" size={19} aria-hidden="true" /> : isPlaying ? <Pause size={19} aria-hidden="true" /> : <Play size={19} aria-hidden="true" />}
            </button>
            <button type="button" className="karmel-radio-icon-button" onClick={toggleMuted} aria-label={isMuted ? "Unmute Karmel Radio" : "Mute Karmel Radio"}>
              {isMuted || volume === 0 ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
            </button>
            <label className="karmel-radio-volume">
              <span className="sr-only">Karmel Radio volume</span>
              <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} aria-label="Karmel Radio volume" />
            </label>
          </div>

          <p className={`karmel-radio-status${error ? " is-error" : ""}`} role="status">{error ?? (stationOnline ? "Live broadcast" : "Station temporarily offline")}</p>
          <span className="sr-only">{status}</span>
        </section>
      )}
      <RadioToggle />
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { usePathname } from "expo-router";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";

import { speakText } from "@/features/scan/api";
import { resolveTtsAudioUrl } from "@/features/scan/audioUrl";
import { ApiError, toApiError } from "@/lib/api/errors";

// Global singleton tracking across the entire application
let activeGlobalPlayer: AudioPlayer | null = null;
let activeGlobalGeneration = 0;
const activeStopListeners = new Set<() => void>();

/**
 * Halts ALL active TTS audio immediately across all screens and components.
 */
export function stopGlobalTts() {
  activeGlobalGeneration += 1;

  if (activeGlobalPlayer) {
    try {
      activeGlobalPlayer.pause();
      activeGlobalPlayer.remove();
    } catch {}
    activeGlobalPlayer = null;
  }

  // Web safeguard: silence any lingering HTMLAudioElements immediately
  if (Platform.OS === "web" && typeof document !== "undefined") {
    try {
      document.querySelectorAll("audio").forEach((el) => {
        el.pause();
        el.currentTime = 0;
      });
    } catch {}
  }

  // Notify all hook instances to reset their speaking state
  activeStopListeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });
}

export function useTtsPlayer(options?: { onError?: (messageAr: string) => void }) {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const pathname = usePathname();
  const prevPathnameRef = useRef(pathname);

  // Stop audio immediately whenever the user navigates or route changes
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      stopGlobalTts();
    }
  }, [pathname]);

  // Register listener to reset speakingId when stopGlobalTts is called
  useEffect(() => {
    const handleStop = () => {
      setSpeakingId(null);
    };
    activeStopListeners.add(handleStop);
    return () => {
      activeStopListeners.delete(handleStop);
    };
  }, []);

  // Browser back/forward button (popstate) listener
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const handlePopState = () => stopGlobalTts();
      window.addEventListener("popstate", handlePopState);
      return () => window.removeEventListener("popstate", handlePopState);
    }
  }, []);

  // Stop playback on component unmount
  useEffect(() => {
    return () => {
      stopGlobalTts();
    };
  }, []);

  const stopCurrent = useCallback(() => {
    stopGlobalTts();
  }, []);

  /**
   * Speak raw text by calling POST /api/voice/tts, then playing the audio.
   */
  const speakTextContent = useCallback(
    async (text: string, id: string = "default") => {
      stopGlobalTts();
      const currentGen = activeGlobalGeneration;
      setSpeakingId(id);

      try {
        const { audio_url } = await speakText(text);
        if (activeGlobalGeneration !== currentGen) return;

        const url = resolveTtsAudioUrl(audio_url);
        const player = createAudioPlayer(url);
        activeGlobalPlayer = player;

        player.addListener("playbackStatusUpdate", (status) => {
          if (status.didJustFinish && activeGlobalGeneration === currentGen) {
            try {
              player.remove();
            } catch {}
            if (activeGlobalPlayer === player) {
              activeGlobalPlayer = null;
            }
            setSpeakingId(null);
          }
        });

        await player.seekTo(0);
        if (activeGlobalGeneration !== currentGen) {
          try {
            player.pause();
            player.remove();
          } catch {}
          return;
        }
        player.play();
      } catch (error) {
        if (activeGlobalGeneration !== currentGen) return;
        setSpeakingId(null);
        const apiError = error instanceof ApiError ? error : toApiError(error);
        options?.onError?.(apiError.friendlyMessageAr);
      }
    },
    [options]
  );

  /**
   * Play an already synthesized audio URL directly.
   */
  const playAudioUrl = useCallback(
    async (audioUrl: string, id: string = "default") => {
      stopGlobalTts();
      const currentGen = activeGlobalGeneration;
      setSpeakingId(id);

      try {
        const url = resolveTtsAudioUrl(audioUrl);
        const player = createAudioPlayer(url);
        activeGlobalPlayer = player;

        player.addListener("playbackStatusUpdate", (status) => {
          if (status.didJustFinish && activeGlobalGeneration === currentGen) {
            try {
              player.remove();
            } catch {}
            if (activeGlobalPlayer === player) {
              activeGlobalPlayer = null;
            }
            setSpeakingId(null);
          }
        });

        await player.seekTo(0);
        if (activeGlobalGeneration !== currentGen) {
          try {
            player.pause();
            player.remove();
          } catch {}
          return;
        }
        player.play();
      } catch (error) {
        if (activeGlobalGeneration !== currentGen) return;
        setSpeakingId(null);
        const apiError = error instanceof ApiError ? error : toApiError(error);
        options?.onError?.(apiError.friendlyMessageAr);
      }
    },
    [options]
  );

  return {
    speakTextContent,
    playAudioUrl,
    speakingId,
    stopCurrent,
    isPlaying: speakingId !== null,
  };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";

import { speakText } from "@/features/scan/api";
import { resolveTtsAudioUrl } from "@/features/scan/audioUrl";
import { ApiError, toApiError } from "@/lib/api/errors";

// Promotion candidate: move to src/lib/ if another feature besides Scan ever
// needs backend TTS playback.
//
// Single-flight audio playback for the Scan screen's speaker buttons: only
// one row's clip plays at a time, playback only ever starts from an
// explicit call to `speak()` (never automatically), and failures resolve
// quietly via the existing ApiError/errors.ts path instead of throwing.
export function useTtsPlayer(options?: { onError?: (messageAr: string) => void }) {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  // Guards against a late "finished"/error callback from a clip that was
  // already superseded by a newer speak() call updating state for the wrong row.
  const generationRef = useRef(0);

  const releasePlayer = useCallback(() => {
    generationRef.current += 1;
    if (playerRef.current) {
      playerRef.current.pause();
      playerRef.current.remove();
      playerRef.current = null;
    }
  }, []);

  const stopCurrent = useCallback(() => {
    releasePlayer();
    setSpeakingId(null);
  }, [releasePlayer]);

  const speak = useCallback(
    async (text: string, rowId: string) => {
      stopCurrent();
      const generation = generationRef.current;
      setSpeakingId(rowId);

      try {
        const { audio_url } = await speakText(text);
        if (generationRef.current !== generation) return; // superseded while awaiting the network

        const url = resolveTtsAudioUrl(audio_url);
        const player = createAudioPlayer(url);
        playerRef.current = player;
        player.addListener("playbackStatusUpdate", (status) => {
          if (status.didJustFinish && generationRef.current === generation) {
            player.remove();
            playerRef.current = null;
            setSpeakingId(null);
          }
        });

        // expo-audio does not reset playback position after a clip finishes,
        // so a fresh player is explicitly seeked to 0 before every play().
        await player.seekTo(0);
        if (generationRef.current !== generation) return;
        player.play();
      } catch (error) {
        if (generationRef.current !== generation) return;
        setSpeakingId(null);
        const apiError = error instanceof ApiError ? error : toApiError(error);
        options?.onError?.(apiError.friendlyMessageAr);
      }
    },
    [options, stopCurrent]
  );

  useEffect(() => releasePlayer, [releasePlayer]);

  return { speak, speakingId };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
  useAudioRecorder,
  RecordingPresets,
} from "expo-audio";

export function useAudioRecorderHook() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [isRecordingWeb, setIsRecordingWeb] = useState(false);
  const [durationMillisWeb, setDurationMillisWeb] = useState(0);

  // Native expo-audio recorder (active only on iOS / Android)
  const nativeRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Web-specific refs to avoid any closure stale-state or MediaRecorder reuse bugs
  const webMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const webStreamRef = useRef<MediaStream | null>(null);
  const webChunksRef = useRef<Blob[]>([]);
  const webTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const webStartTimeRef = useRef<number>(0);

  // Request permissions cleanly
  const requestPermission = useCallback(async () => {
    if (Platform.OS === "web") {
      try {
        if (typeof navigator !== "undefined" && navigator.mediaDevices) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((t) => t.stop());
          setHasPermission(true);
          setIsPermissionDenied(false);
          return true;
        }
      } catch {
        setHasPermission(false);
        setIsPermissionDenied(true);
        return false;
      }
    }

    try {
      const current = await getRecordingPermissionsAsync();
      if (current.granted) {
        setHasPermission(true);
        setIsPermissionDenied(false);
        return true;
      }
      const response = await requestRecordingPermissionsAsync();
      setHasPermission(response.granted);
      setIsPermissionDenied(!response.granted);
      return response.granted;
    } catch {
      setIsPermissionDenied(true);
      return false;
    }
  }, []);

  // ── START RECORDING ────────────────────────────────────────────────────────
  const startRecording = useCallback(async (): Promise<boolean> => {
    setRecordedUri(null);

    if (Platform.OS === "web") {
      try {
        // Clean up any lingering web stream or recorder
        if (webStreamRef.current) {
          webStreamRef.current.getTracks().forEach((t) => t.stop());
          webStreamRef.current = null;
        }
        if (webTimerRef.current) {
          clearInterval(webTimerRef.current);
          webTimerRef.current = null;
        }

        webChunksRef.current = [];
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        webStreamRef.current = stream;

        // Choose best supported mime type in browser
        let mimeType = "audio/webm;codecs=opus";
        if (typeof MediaRecorder !== "undefined") {
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = "audio/webm";
          }
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = "";
          }
        }

        const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
        const mediaRecorder = new MediaRecorder(stream, options);
        webMediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            webChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.start(100); // 100ms timeslices for reliable chunk streaming
        webStartTimeRef.current = Date.now();
        setIsRecordingWeb(true);
        setDurationMillisWeb(0);

        webTimerRef.current = setInterval(() => {
          setDurationMillisWeb(Date.now() - webStartTimeRef.current);
        }, 200);

        setHasPermission(true);
        setIsPermissionDenied(false);
        return true;
      } catch (err) {
        console.error("[WEB AUDIO RECORDER START ERROR]", err);
        setIsRecordingWeb(false);
        return false;
      }
    }

    // Native path (iOS / Android)
    const granted = await requestPermission();
    if (!granted) return false;

    try {
      await nativeRecorder.prepareToRecordAsync();
      nativeRecorder.record();
      return true;
    } catch (err) {
      console.warn("Failed to start native audio recording", err);
      return false;
    }
  }, [nativeRecorder, requestPermission]);

  // ── STOP RECORDING ─────────────────────────────────────────────────────────
  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (Platform.OS === "web") {
      if (webTimerRef.current) {
        clearInterval(webTimerRef.current);
        webTimerRef.current = null;
      }

      const mediaRecorder = webMediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state === "inactive") {
        setIsRecordingWeb(false);
        return null;
      }

      try {
        const freshBlob = await new Promise<Blob>((resolve) => {
          mediaRecorder.onstop = () => {
            const mime = mediaRecorder.mimeType || "audio/webm";
            const blob = new Blob(webChunksRef.current, { type: mime });
            webChunksRef.current = [];
            resolve(blob);
          };
          mediaRecorder.stop();
        });

        // Release hardware mic tracks immediately
        if (webStreamRef.current) {
          webStreamRef.current.getTracks().forEach((t) => t.stop());
          webStreamRef.current = null;
        }

        webMediaRecorderRef.current = null;
        setIsRecordingWeb(false);

        if (freshBlob.size === 0) {
          console.warn("[WEB AUDIO RECORDER] Recorded blob is empty");
          return null;
        }

        // Fresh self-contained Blob URL for THIS EXACT SESSION ONLY
        const freshUri = URL.createObjectURL(freshBlob);
        setRecordedUri(freshUri);
        return freshUri;
      } catch (err) {
        console.error("[WEB AUDIO RECORDER STOP ERROR]", err);
        setIsRecordingWeb(false);
        return null;
      }
    }

    // Native path (iOS / Android)
    try {
      await nativeRecorder.stop();
      // Read url directly from current recorder status instead of stale state
      const status = nativeRecorder.getStatus();
      const freshUri = status.url || null;
      setRecordedUri(freshUri);
      return freshUri;
    } catch (err) {
      console.warn("Failed to stop native audio recording", err);
      return null;
    }
  }, [nativeRecorder]);

  // ── CANCEL RECORDING ───────────────────────────────────────────────────────
  const cancelRecording = useCallback(async () => {
    if (Platform.OS === "web") {
      if (webTimerRef.current) {
        clearInterval(webTimerRef.current);
        webTimerRef.current = null;
      }
      if (webMediaRecorderRef.current && webMediaRecorderRef.current.state !== "inactive") {
        try {
          webMediaRecorderRef.current.stop();
        } catch {}
      }
      if (webStreamRef.current) {
        webStreamRef.current.getTracks().forEach((t) => t.stop());
        webStreamRef.current = null;
      }
      webMediaRecorderRef.current = null;
      webChunksRef.current = [];
      setIsRecordingWeb(false);
      setRecordedUri(null);
      return;
    }

    try {
      await nativeRecorder.stop();
    } catch {
      // ignore cancel errors
    } finally {
      setRecordedUri(null);
    }
  }, [nativeRecorder]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (Platform.OS === "web") {
        if (webTimerRef.current) clearInterval(webTimerRef.current);
        if (webStreamRef.current) {
          webStreamRef.current.getTracks().forEach((t) => t.stop());
        }
      }
    };
  }, []);

  const isRecording = Platform.OS === "web" ? isRecordingWeb : nativeRecorder.isRecording;
  const durationMillis = Platform.OS === "web" ? durationMillisWeb : 0;

  return {
    isRecording,
    durationMillis,
    recordedUri,
    hasPermission,
    isPermissionDenied,
    startRecording,
    stopRecording,
    cancelRecording,
    requestPermission,
  };
}


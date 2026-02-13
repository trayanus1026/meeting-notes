import { useState, useCallback, useRef } from 'react';
import { Audio } from 'expo-av';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { getExpoPushToken } from '@/lib/notifications';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

export function useRecording() {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const startRecording = useCallback(async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: 2, // DoNotMix
        interruptionModeAndroid: 1, // DoNotMix
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setIsPaused(false);
      setDurationSec(0);

      durationIntervalRef.current = setInterval(() => {
        setDurationSec((s) => s + 1);
      }, 1000);
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    const recording = recordingRef.current;
    if (!recording || !user) return null;

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    recordingRef.current = null;
    setIsRecording(false);
    setIsPaused(false);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) throw new Error('No recording URI');

      const fileName = `meetings/${user.id}/${Date.now()}.m4a`;
      const fileResponse = await fetch(uri);
      const blob = await fileResponse.blob();
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('recordings')
        .upload(fileName, blob, {
          contentType: 'audio/mp4',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('recordings').getPublicUrl(uploadData.path);
      const audioUrl = urlData.publicUrl;

      const { data: meetingRow, error: insertError } = await supabase
        .from('meetings')
        .insert({
          user_id: user.id,
          title: null,
          summary: null,
          transcript: null,
          audio_url: audioUrl,
          status: 'pending',
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      const meetingId = meetingRow?.id;
      if (!meetingId) throw new Error('No meeting id returned');

      const pushToken = await getExpoPushToken();

      const apiResponse = await fetch(`${BACKEND_URL}/process-meeting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_url: audioUrl,
          meeting_id: meetingId,
          push_token: pushToken,
        }),
      });
      if (!apiResponse.ok) {
        const errText = await apiResponse.text();
        console.warn('Backend process-meeting failed:', errText);
        await supabase
          .from('meetings')
          .update({ status: 'failed' })
          .eq('id', meetingId);
      }

      return meetingId;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }, [user]);

  const pauseRecording = useCallback(async () => {
    const recording = recordingRef.current;
    if (recording) {
      await recording.pauseAsync();
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      setIsPaused(true);
    }
  }, []);

  const resumeRecording = useCallback(async () => {
    const recording = recordingRef.current;
    if (recording) {
      await recording.startAsync();
      setIsPaused(false);
      durationIntervalRef.current = setInterval(() => {
        setDurationSec((s) => s + 1);
      }, 1000);
    }
  }, []);

  return {
    isRecording,
    isPaused,
    durationSec,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    error,
    clearError,
  };
}

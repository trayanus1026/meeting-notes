import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useRecording } from '@/lib/recording';
import { useAuth } from '@/lib/auth';

export default function RecordScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    isRecording,
    isPaused,
    durationSec,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    error: recordingError,
    clearError,
  } = useRecording();

  const [uploading, setUploading] = useState(false);

  const handleStart = useCallback(async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to record meetings.');
      return;
    }
    clearError();
    try {
      await startRecording();
    } catch (e) {
      Alert.alert('Recording failed', (e as Error).message);
    }
  }, [user, startRecording, clearError]);

  const handleStop = useCallback(async () => {
    try {
      setUploading(true);
      const meetingId = await stopRecording();
      if (meetingId) {
        router.push(`/meeting/${meetingId}`);
      }
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setUploading(false);
    }
  }, [stopRecording, router]);

  if (recordingError) {
    Alert.alert('Recording error', recordingError, [{ text: 'OK', onPress: clearError }]);
  }

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Meeting Notes</Text>
      <Text style={styles.subtitle}>
        Tap record, put your phone away, and get a transcript when you're done.
      </Text>

      <View style={styles.recordSection}>
        {!isRecording && !uploading && (
          <TouchableOpacity style={styles.recordButton} onPress={handleStart} activeOpacity={0.8}>
            <Text style={styles.recordButtonText}>Start recording</Text>
          </TouchableOpacity>
        )}

        {isRecording && (
          <>
            <View style={styles.durationContainer}>
              <View style={styles.pulse} />
              <Text style={styles.duration}>{formatDuration(durationSec)}</Text>
            </View>
            <Text style={styles.hint}>Recording in progress. App can run in background.</Text>
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.pauseButton]}
                onPress={isPaused ? resumeRecording : pauseRecording}
              >
                <Text style={styles.secondaryButtonText}>{isPaused ? 'Resume' : 'Pause'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
                <Text style={styles.stopButtonText}>Stop & upload</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {uploading && (
          <View style={styles.uploadingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.uploadingText}>Uploading and processing…</Text>
          </View>
        )}
      </View>

      {!user && (
        <Text style={styles.authHint}>Sign in on the Meetings tab to record.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 48,
    paddingHorizontal: 16,
  },
  recordSection: {
    alignItems: 'center',
    minHeight: 200,
  },
  recordButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 20,
    paddingHorizontal: 48,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  pulse: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ef4444',
    marginRight: 12,
  },
  duration: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  hint: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
  },
  pauseButton: {
    minWidth: 100,
  },
  secondaryButtonText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
  stopButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadingContainer: {
    alignItems: 'center',
    gap: 16,
  },
  uploadingText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  authHint: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    color: '#64748b',
    fontSize: 14,
  },
});

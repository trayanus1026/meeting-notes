import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  useLocalSearchParams,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import type { Meeting } from '@/lib/types';

export default function MeetingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const fetchMeeting = async () => {
      try {
        const { data, error: err } = await supabase
          .from('meetings')
          .select('*')
          .eq('id', id)
          .single();

        if (err) throw err;
        if (!cancelled) setMeeting(data as Meeting);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchMeeting();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading meeting…</Text>
      </View>
    );
  }

  if (error || !meeting) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error || 'Meeting not found'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{meeting.title || 'Meeting'}</Text>
      <View style={styles.meta}>
        <Text style={styles.date}>{new Date(meeting.created_at).toLocaleString()}</Text>
        <View style={[styles.badge, meeting.status === 'processed' && styles.badgeDone]}>
          <Text style={styles.badgeText}>{meeting.status}</Text>
        </View>
      </View>

      {meeting.summary && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <Text style={styles.summary}>{meeting.summary}</Text>
        </View>
      )}

      {meeting.transcript && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transcript</Text>
          <Text style={styles.transcript}>{meeting.transcript}</Text>
        </View>
      )}

      {meeting.status === 'processing' && (
        <Text style={styles.processing}>Transcript and summary are being generated…</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  centered: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
  },
  error: {
    color: '#ef4444',
    fontSize: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  date: {
    fontSize: 14,
    color: '#94a3b8',
  },
  badge: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeDone: {
    backgroundColor: '#065f46',
  },
  badgeText: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'capitalize',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 8,
  },
  summary: {
    fontSize: 16,
    color: '#cbd5e1',
    lineHeight: 24,
  },
  transcript: {
    fontSize: 15,
    color: '#94a3b8',
    lineHeight: 24,
    whiteSpace: 'pre-wrap',
  },
  processing: {
    color: '#94a3b8',
    fontStyle: 'italic',
  },
});

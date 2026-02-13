import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Meeting } from '@/lib/types';

export default function MeetingsScreen() {
  const router = useRouter();
  const { user, signIn, signOut } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMeetings = async () => {
    if (!user) {
      setMeetings([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('id, title, summary, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMeetings((data as Meeting[]) || []);
    } catch (e) {
      console.error('Fetch meetings error:', e);
      setMeetings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, [user?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMeetings();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Meetings</Text>
        <Text style={styles.subtitle}>Sign in to see your meetings and recordings.</Text>
        <TouchableOpacity style={styles.signInButton} onPress={signIn}>
          <Text style={styles.signInButtonText}>Sign in (demo)</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Meetings</Text>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#6366f1" style={styles.loader} />
      ) : (
        <FlatList
          data={meetings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No meetings yet. Record one from the Record tab.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/meeting/${item.id}`)}
              activeOpacity={0.7}
            >
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title || 'Untitled meeting'}
              </Text>
              {item.summary && (
                <Text style={styles.cardSummary} numberOfLines={2}>
                  {item.summary}
                </Text>
              )}
              <View style={styles.cardFooter}>
                <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
                <View style={[styles.badge, item.status === 'processed' && styles.badgeDone]}>
                  <Text style={styles.badgeText}>{item.status}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  signOut: {
    color: '#94a3b8',
    fontSize: 14,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 24,
  },
  signInButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  list: {
    paddingBottom: 24,
  },
  loader: {
    marginTop: 48,
  },
  empty: {
    color: '#64748b',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 48,
  },
  card: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  cardSummary: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDate: {
    fontSize: 12,
    color: '#64748b',
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
});

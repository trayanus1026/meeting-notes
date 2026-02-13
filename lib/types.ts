export interface Meeting {
  id: string;
  user_id: string;
  title: string | null;
  summary: string | null;
  transcript: string | null;
  audio_url: string | null;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  created_at: string;
  updated_at: string;
}

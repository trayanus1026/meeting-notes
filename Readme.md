# In-Person Meeting Notes App

Mobile app that records in-person meetings, keeps recording in the background, and delivers AI-generated transcripts via push notifications.

**User flow:** Tap record → put phone in pocket → stop recording later → get a notification when the transcript and summary are ready → open the meeting from the notification.

---

## How to run locally

### Prerequisites

- Node.js 18+
- Python 3.11+
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (or use `npx expo`)
- Supabase project ([supabase.com](https://supabase.com))
- OpenAI API key ([platform.openai.com](https://platform.openai.com))

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In SQL Editor, run the migration in `supabase/migrations/001_meetings.sql` (creates `meetings` table, RLS, and `recordings` storage bucket).
3. In Authentication → Providers, enable **Anonymous** if you want the demo “Sign in” without email.
4. Copy **Project URL** and **anon key** from Settings → API. For the backend, also copy **service_role** key (Settings → API → service_role).

### 2. Backend (Python)

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
```

Create `backend/.env`:

```env
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Run the API:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Mobile app (Expo)

```bash
# from repo root
npm install
```

Create `.env` in the repo root (or `app.config.js` with `extra`):

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_BACKEND_URL=http://YOUR_LOCAL_IP:8000
```

For a physical device, set `EXPO_PUBLIC_BACKEND_URL` to your machine’s LAN IP (e.g. `http://192.168.1.10:8000`) so the phone can reach the backend.

Start the app:

```bash
npx expo start
```

Then run on a device/simulator (e.g. press `i` for iOS or `a` for Android).

**If you see "PlatformConstants could not be found" (red screen):** Expo Go can hit this with SDK 54. Use a **development build** instead:

1. Install [JDK 17](https://adoptium.net/) and ensure `JAVA_HOME` is set.
2. Run `npx expo run:android` (or `npx expo run:ios` on Mac). This builds a native app with your config.
3. The built app will run on the emulator/device and avoid the TurboModule error.

A development build is also required for full background recording and the custom config plugin.

### 4. Push notifications (optional)

- Create an [Expo](https://expo.dev) account and link the project: `npx expo install expo-dev-client` and use EAS or run `expo prebuild` so the app has a native project.
- Push tokens are requested when you start/stop a recording; the backend sends a notification when the transcript is ready. For local testing you can leave push_token unused and just open the meeting from the Meetings tab.

---

## Architecture decisions

- **Expo Router (file-based routing)** for tabs and deep links: `(tabs)/index`, `(tabs)/meetings`, `meeting/[id]`. Scheme `meetingnotes` in `app.json` so notifications can open `meetingnotes://meeting/<id>`.
- **Custom config plugin** (`plugins/withBackgroundAudio.js`) configures native projects so background recording is allowed: iOS `UIBackgroundModes` → `audio`, Android `RECORD_AUDIO`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE`, and a placeholder foreground service declaration. This keeps the app evaluable without ejecting; a production app could implement the actual Android foreground service in native code.
- **Background recording** uses **expo-av** with `staysActiveInBackground: true` and the above native config. On iOS this is sufficient for recording while backgrounded; on Android, long-running reliability may require a real foreground service (e.g. with Notifee or custom native code), which the plugin is set up for.
- **Supabase** for auth (anonymous sign-in for demo), Postgres (`meetings` table with RLS so users only see their own rows), and Storage (`recordings` bucket) for audio files. Backend uses the **service_role** key to update `meetings` after processing.
- **Backend** is a single FastAPI app: `POST /process-meeting` receives `audio_url`, `meeting_id`, and optional `push_token`. It downloads the file, transcribes with **OpenAI Whisper** (`whisper-1`), summarizes with **GPT-4o-mini**, updates the meeting row in Supabase, and sends an **Expo push** with `data.meetingId` for deep linking.
- **Push + deep link**: Backend sends the notification with `meetingId`; the app’s notification response handler opens `Linking.createURL(\`/meeting/${meetingId}\`)` so the user lands on the meeting detail screen.

---

## What I’d improve with more time

1. **Android foreground service** – Implement the actual `RecordingForegroundService` (or use a library like Notifee) so recording is stable when the app is backgrounded for a long time; the config plugin already declares the service and permissions.
2. **Auth** – Replace anonymous auth with email or OAuth and tie push tokens to the user in the DB for targeted notifications.
3. **Retries and idempotency** – Retry transcription/summary on failure; idempotent `process-meeting` so duplicate calls don’t double-send push or overwrite data.
4. **Security** – Validate `audio_url` (e.g. allowlist Supabase storage domain); rate-limit the endpoint; avoid logging sensitive content.
5. **UX** – Show “Processing…” on the meeting detail screen with optional polling or Supabase Realtime; better errors and offline handling in the app.
6. **Testing** – E2E test: start record → background → stop → wait for notification → open meeting; unit tests for backend pipeline and plugin output.

---

## Evaluation checklist

| Requirement | Implementation |
|------------|----------------|
| Config plugin | `plugins/withBackgroundAudio.js`: iOS `UIBackgroundModes` + `audio`, Android RECORD_AUDIO, FOREGROUND_SERVICE, FOREGROUND_SERVICE_MICROPHONE, service declaration, NSMicrophoneUsageDescription |
| Background recording | expo-av with `staysActiveInBackground`, pause/resume, upload on stop |
| Expo Router + deep link | File-based routes; scheme `meetingnotes`; notification opens `/meeting/[id]` |
| Supabase | Auth (anonymous), Storage (recordings), Postgres (meetings + RLS) |
| Push notifications | Expo Push; backend sends when transcript ready; payload includes `meetingId` |
| Backend | FastAPI `POST /process-meeting`; Whisper-1 transcription; GPT-4o-mini summary; DB update; Expo push |

---

## References

- [OpenAI Whisper model](https://platform.openai.com/docs/models/whisper-1)
- [OpenAI Audio transcriptions API](https://platform.openai.com/docs/api-reference/audio/createTranscription)
- [Expo config plugins](https://docs.expo.dev/config-plugins/introduction/)
- [Expo Push notifications](https://docs.expo.dev/push-notifications/overview/)

"""
Meeting Notes Backend — Process audio, transcribe (Whisper), summarize, update DB, send push.
"""
import io
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import httpx
from fastapi import FastAPI, HTTPException
from openai import OpenAI
from pydantic import BaseModel
from supabase import create_client, Client

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not OPENAI_API_KEY:
    logger.warning("OPENAI_API_KEY not set; transcription/summary will fail")
if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    logger.warning("Supabase env vars not set; DB update will fail")


class ProcessMeetingRequest(BaseModel):
    audio_url: str
    meeting_id: str
    push_token: str | None = None


def get_openai_client() -> OpenAI:
    return OpenAI(api_key=OPENAI_API_KEY or "sk-placeholder")


def get_supabase() -> Client:
    return create_client(SUPABASE_URL or "", SUPABASE_SERVICE_KEY or "")


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # shutdown if needed


app = FastAPI(title="Meeting Notes API", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/process-meeting")
async def process_meeting(body: ProcessMeetingRequest):
    """
    Download audio from audio_url, transcribe with Whisper, summarize with GPT,
    update Supabase meeting row, send Expo push if push_token provided.
    """
    meeting_id = body.meeting_id
    push_token = body.push_token

    await _set_meeting_status(meeting_id, "processing")

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(body.audio_url)
            resp.raise_for_status()
            audio_bytes = resp.content
    except Exception as e:
        logger.exception("Failed to download audio")
        await _set_meeting_status(meeting_id, "failed")
        raise HTTPException(status_code=502, detail=f"Failed to download audio: {e}")

    if not OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY not configured")

    openai_client = get_openai_client()

    # Transcribe with Whisper (whisper-1)
    try:
        transcript = await _transcribe_audio(openai_client, audio_bytes)
    except Exception as e:
        logger.exception("Transcription failed")
        await _set_meeting_status(meeting_id, "failed")
        raise HTTPException(status_code=502, detail=f"Transcription failed: {e}")

    # Summarize
    try:
        summary = await _summarize(openai_client, transcript)
    except Exception as e:
        logger.exception("Summarization failed")
        summary = "(Summary unavailable)"

    # Update Supabase
    try:
        supabase = get_supabase()
        supabase.table("meetings").update({
            "transcript": transcript,
            "summary": summary,
            "status": "processed",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", meeting_id).execute()
    except Exception as e:
        logger.exception("DB update failed")
        raise HTTPException(status_code=502, detail=f"DB update failed: {e}")

    # Send push notification
    if push_token:
        try:
            await _send_expo_push(push_token, meeting_id, summary)
        except Exception as e:
            logger.warning("Push notification failed: %s", e)

    return {"meeting_id": meeting_id, "status": "processed"}


async def _transcribe_audio(client: OpenAI, audio_bytes: bytes) -> str:
    """Transcribe using OpenAI Whisper (whisper-1)."""
    file_like = io.BytesIO(audio_bytes)
    file_like.name = "audio.m4a"
    transcript = client.audio.transcriptions.create(
        model="whisper-1",
        file=file_like,
        response_format="text",
    )
    if isinstance(transcript, str):
        return transcript
    return getattr(transcript, "text", "") or str(transcript)


async def _summarize(client: OpenAI, transcript: str) -> str:
    """Generate a short summary using GPT."""
    if not transcript.strip():
        return "No speech detected."
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a concise assistant. Summarize the following meeting transcript in 2–4 short sentences."},
            {"role": "user", "content": transcript[:12000]},
        ],
        max_tokens=300,
    )
    return (response.choices[0].message.content or "").strip()


async def _set_meeting_status(meeting_id: str, status: str) -> None:
    try:
        get_supabase().table("meetings").update({"status": status}).eq("id", meeting_id).execute()
    except Exception as e:
        logger.warning("Could not set meeting status: %s", e)


async def _send_expo_push(push_token: str, meeting_id: str, summary: str) -> None:
    """Send Expo push notification with deep link to meeting."""
    title = "Meeting transcript ready"
    body = (summary[:100] + "…") if len(summary) > 100 else summary
    payload = {
        "to": push_token,
        "title": title,
        "body": body,
        "data": {"meetingId": meeting_id},
        "channelId": "default",
        "priority": "high",
    }
    async with httpx.AsyncClient() as client:
        r = await client.post("https://exp.host/--/api/v2/push/send", json=payload, timeout=10.0)
        r.raise_for_status()

import { useState } from 'react';
import { playAudio } from '../services/audioController';
import { authHeaders } from '../services/auth';
import { API_BASE } from '../services/apiBase';

export interface NarrateResult {
  text: string;
  conversationId: string;
  audioUrl?: string;
}

interface AudioPlayerProps {
  onAdventureStart: (narration?: NarrateResult) => void;
  characterClass?: string;
  pronouns?: string;
}

export function AudioPlayer({ onAdventureStart, characterClass, pronouns }: AudioPlayerProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleStartAdventure() {
    if (status === 'loading' || status === 'playing') return;
    setErrorMsg('');

    setStatus('loading');

    try {
      const response = await fetch(`${API_BASE}/api/narrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          ...(characterClass ? { characterClass } : {}),
          ...(pronouns ? { pronouns } : {}),
        }),
      });

      if (!response.ok) {
        let details = `narrate returned ${response.status}`;
        try {
          const errorBody = await response.json() as { error?: string; requestId?: string };
          if (errorBody.error) details = errorBody.error;
          if (errorBody.requestId) details = `${details} (request: ${errorBody.requestId})`;
        } catch {
          // no-op: keep status-based fallback details
        }
        throw new Error(`[AudioPlayer] ${details}`);
      }

      const data = await response.json() as {
        audio?: string;
        text?: string;
        conversationId?: string;
        ttsError?: string;
        requestId?: string;
      };

      if (!data.text || !data.conversationId) {
        throw new Error('[AudioPlayer] narrate response missing text or conversationId');
      }

      if (!data.audio) {
        if (data.ttsError || data.requestId) {
          console.error('[AudioPlayer] narration audio unavailable', {
            ttsError: data.ttsError,
            requestId: data.requestId,
          });
        }
        setStatus('idle');
        // Pass Bedrock-generated text + conversationId to chat even if TTS audio failed.
        onAdventureStart({ text: data.text, conversationId: data.conversationId });
        return;
      }

      // Decode base64 audio
      const binaryStr = atob(data.audio);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      const objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(objectUrl);

      setStatus('playing');
      onAdventureStart({ text: data.text, conversationId: data.conversationId, audioUrl: objectUrl });

      playAudio(audio);
    } catch (error) {
      console.error('[AudioPlayer] narrate fetch failed:', error);
      if (error instanceof TypeError) {
        // Server unreachable (ECONNREFUSED, socket hang up) — chat will also fail
        setStatus('error');
        setErrorMsg('Unable to reach the server. Please try again.');
        return;
      }
      setStatus('idle');
      // Graceful degradation: start adventure without narration
      onAdventureStart();
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={handleStartAdventure}
        disabled={status === 'loading'}
        className="font-cinzel text-xl text-parchment px-8 py-4 border border-blood bg-blood/20 hover:bg-blood/40 tracking-widest disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === 'loading'
          ? 'The Dungeon Master is speaking...'
          : status === 'error'
            ? 'Try Again'
            : 'Enter the Realm'}
      </button>
      {errorMsg && (
        <p className="font-fell text-sm text-blood-light">{errorMsg}</p>
      )}
    </div>
  );
}

const fetch = require('node-fetch');

const BASE = 'https://api.assemblyai.com/v2';
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 40; // 2 minutes max

function headers() {
  return {
    authorization: process.env.ASSEMBLYAI_API_KEY,
    'content-type': 'application/json',
  };
}

/**
 * Uploads a raw audio Buffer to AssemblyAI and returns the upload URL.
 */
async function uploadAudio(buffer) {
  const res = await fetch(`${BASE}/upload`, {
    method: 'POST',
    headers: {
      authorization: process.env.ASSEMBLYAI_API_KEY,
      'content-type': 'application/octet-stream',
      'transfer-encoding': 'chunked',
    },
    body: buffer,
  });
  if (!res.ok) {
    console.log('[assemblyai] upload response:', res.status, await res.text());
    throw new Error(`AssemblyAI upload failed: ${res.status}`);
  }
  const { upload_url } = await res.json();
  return upload_url;
}

/**
 * Submits a transcription job for the given audio URL.
 * Returns the job ID.
 */
async function submitTranscript(audioUrl) {
  const res = await fetch(`${BASE}/transcript`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      audio_url: audioUrl,
      speech_model: 'universal-2',
      language_code: 'pt',
    }),
  });
  const data = await res.json();
  console.log('[assemblyai] submit response:', res.status, JSON.stringify(data));
  if (!res.ok) throw new Error(`AssemblyAI submit failed: ${res.status}`);
  return data.id;
}

/**
 * Polls until the transcription is complete or fails.
 * Returns the transcribed text.
 */
async function pollTranscript(id) {
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(`${BASE}/transcript/${id}`, { headers: headers() });
    if (!res.ok) throw new Error(`AssemblyAI poll failed: ${res.status}`);
    const data = await res.json();

    if (data.status === 'completed') return data.text;
    if (data.status === 'error') throw new Error(`AssemblyAI error: ${data.error}`);
    // status === 'processing' or 'queued' → keep polling
  }
  throw new Error('AssemblyAI transcription timed out');
}

/**
 * Full pipeline: Buffer → upload → transcribe → poll → text.
 * @param {Buffer} audioBuffer
 * @returns {Promise<string>} Transcribed text in Portuguese
 */
async function transcribe(audioBuffer) {
  const uploadUrl = await uploadAudio(audioBuffer);
  const jobId     = await submitTranscript(uploadUrl);
  const text      = await pollTranscript(jobId);
  return text;
}

module.exports = { transcribe };

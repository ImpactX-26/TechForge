import { useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../../api';
import type { VideoItem } from '../../types';

const MAX_SECONDS = 90;
const MIME_CANDIDATES = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];

const FACE_TEXT: Record<string, { cls: string; label: string }> = {
  MATCHED: { cls: 'ok', label: 'Identity matched' },
  NOT_MATCHED: { cls: 'bad', label: 'Not matched, flagged for review' },
  NO_FACE_DETECTED: { cls: 'warn', label: 'No clear face found' },
  NO_REFERENCE: { cls: 'warn', label: 'ID photo missing' },
  NOT_CONFIGURED: { cls: 'warn', label: 'Manual review required' },
  ERROR: { cls: 'bad', label: 'Check failed' },
};

export default function Video() {
  const [consent, setConsent] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<VideoItem | null>(null);

  const liveRef = useRef<HTMLVideoElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    api
      .get<VideoItem>('/video/latest')
      .then(setResult)
      .catch(() => undefined); // 404 = no video yet
    return () => {
      window.clearInterval(timer.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (recording && seconds >= MAX_SECONDS) stop();
  }, [seconds, recording]);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (liveRef.current) liveRef.current.srcObject = null;
  }

  async function start() {
    setErr('');
    setFile(null);
    setPreviewUrl(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (liveRef.current) {
        liveRef.current.srcObject = stream;
        await liveRef.current.play().catch(() => undefined);
      }
      const mime = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size) chunks.current.push(ev.data);
      };
      rec.onstop = () => {
        const type = (rec.mimeType || 'video/webm').split(';')[0];
        const ext = type.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(chunks.current, { type });
        setFile(new File([blob], `intro.${ext}`, { type }));
        setPreviewUrl(URL.createObjectURL(blob));
        stopStream();
      };
      rec.start();
      recRef.current = rec;
      setSeconds(0);
      setRecording(true);
      timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (ex) {
      setErr(`Could not access camera/microphone: ${errorMessage(ex)}`);
    }
  }

  function stop() {
    window.clearInterval(timer.current);
    setRecording(false);
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
  }

  function pickFile(f: File | null) {
    setFile(f);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  }

  async function upload() {
    if (!file || !consent) return;
    setErr('');
    setBusy(true);
    try {
      const form = new FormData();
      form.append('consent', 'true');
      form.append('video', file);
      setResult(await api.upload<VideoItem>('/video/upload', form));
      setFile(null);
      setPreviewUrl(null);
    } catch (ex) {
      setErr(errorMessage(ex));
    } finally {
      setBusy(false);
    }
  }

  const face = result?.faceMatch ? FACE_TEXT[result.faceMatch.status] : null;

  return (
    <>
      <h1>Introduction video</h1>
      <div className="card">
        <p>Record 20 to 60 seconds. Look at the camera in good light and say:</p>
        <ul>
          <li>Your name and background (education and work)</li>
          <li>Why you want to move to Germany</li>
          <li>Your career goals and preferred city or field</li>
        </ul>
        <p className="muted">
          Before recording, upload a clear <strong>JPG/PNG photo of your passport/ID</strong> (Documents page, type
          "Passport / ID"). We compare the face in your video with that photo to verify your identity.
        </p>

        {recording ? (
          <p><span className="badge bad">● REC</span> {seconds}s / {MAX_SECONDS}s</p>
        ) : null}
        <video ref={liveRef} muted playsInline style={{ display: recording ? 'block' : 'none', width: '100%', maxWidth: 480 }} />
        {!recording && previewUrl && <video src={previewUrl} controls style={{ width: '100%', maxWidth: 480 }} />}

        <div className="row" style={{ marginTop: '.75rem' }}>
          {!recording ? (
            <button className="btn secondary" onClick={start} disabled={busy}>
              {file ? 'Record again' : 'Record with camera'}
            </button>
          ) : (
            <button className="btn danger" onClick={stop}>Stop recording</button>
          )}
          <span className="muted">or</span>
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            style={{ maxWidth: 300 }}
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            disabled={recording}
          />
        </div>

        <label style={{ marginTop: '1rem', fontWeight: 400 }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          I consent to my video and ID photo being processed, including facial comparison, to verify my identity
          and to analyse what I say. I understand this is biometric data and a human reviewer makes the final decision.
        </label>

        {err && <div className="error">{err}</div>}
        <button className="btn" style={{ marginTop: '.75rem' }} onClick={upload} disabled={!file || !consent || busy || recording}>
          {busy ? 'Processing (up to a minute)…' : 'Upload and analyse'}
        </button>
      </div>

      {result && (
        <div className="card">
          <h2>Latest video result</h2>
          {face && (
            <p>
              <span className={`badge ${face.cls}`}>{face.label}</span>{' '}
              {result.faceMatch?.similarity !== undefined && (
                <span className="muted">similarity {result.faceMatch.similarity}%</span>
              )}
            </p>
          )}
          {result.faceMatch && <p className="muted">{result.faceMatch.message}</p>}
          {result.notes?.map((n, i) => <div className="warn" key={i}>{n}</div>)}
          {result.analysis && (
            <>
              <h3>What we understood (from your words)</h3>
              <ul>
                {result.analysis.background && <li><strong>Background:</strong> {result.analysis.background}</li>}
                {result.analysis.motivation && <li><strong>Motivation:</strong> {result.analysis.motivation}</li>}
                {result.analysis.careerGoals && <li><strong>Career goals:</strong> {result.analysis.careerGoals}</li>}
                {result.analysis.preferredCity && <li><strong>Preferred city:</strong> {result.analysis.preferredCity}</li>}
              </ul>
              {(result.analysis.discrepanciesWithProfile?.length ?? 0) > 0 && (
                <div className="warn">
                  <strong>Please clarify (video vs profile):</strong>
                  <ul>{result.analysis.discrepanciesWithProfile?.map((d, i) => <li key={i}>{d}</li>)}</ul>
                </div>
              )}
            </>
          )}
          {result.transcript && (
            <details>
              <summary>Transcript</summary>
              <p style={{ whiteSpace: 'pre-wrap' }}>{result.transcript}</p>
            </details>
          )}
        </div>
      )}
    </>
  );
}

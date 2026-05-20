'use client'

import { useState, useRef, useEffect } from 'react'

type State = 'idle' | 'recording' | 'stopped' | 'uploading' | 'saved'

export default function ScreenRecorder() {
  const [state, setState] = useState<State>('idle')
  const [description, setDescription] = useState('')
  const [savedId, setSavedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)

  const liveVideoRef = useRef<HTMLVideoElement>(null)
  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function startRecording() {
    setError(null)
    setRecordedBlob(null)
    setSavedId(null)
    chunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })
      streamRef.current = stream

      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        setRecordedBlob(blob)
        if (previewVideoRef.current) {
          previewVideoRef.current.src = URL.createObjectURL(blob)
        }
        setState('stopped')
      }

      stream.getVideoTracks()[0].onended = () => {
        if (recorder.state === 'recording') recorder.stop()
        streamRef.current?.getTracks().forEach((t) => t.stop())
        setState('stopped')
      }

      recorder.start()
      setState('recording')
    } catch (err) {
      setError('No se pudo iniciar la grabación. ' + (err as Error).message)
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null
    }
  }

  async function saveRecording() {
    if (!recordedBlob) return
    setState('uploading')
    setError(null)

    try {
      // Upload video to Rustfs via upload API
      const formData = new FormData()
      formData.append('video', recordedBlob, 'recording.webm')

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadRes.ok) throw new Error('Upload failed')
      const { s3Key } = await uploadRes.json()

      // Save metadata to MongoDB
      const saveRes = await fetch('/api/recordings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, s3Key }),
      })

      if (!saveRes.ok) throw new Error('Save failed')
      const { id } = await saveRes.json()

      setSavedId(id)
      setState('saved')
    } catch (err) {
      setError('Error al guardar: ' + (err as Error).message)
      setState('stopped')
    }
  }

  function reset() {
    setState('idle')
    setDescription('')
    setSavedId(null)
    setError(null)
    setRecordedBlob(null)
    if (previewVideoRef.current) previewVideoRef.current.src = ''
  }

  return (
    <div className="recorder-card">
      {/* Status indicator */}
      <div className="status-bar">
        <span className={`status-dot ${state}`} />
        <span className="status-label">
          {state === 'idle' && 'Listo para grabar'}
          {state === 'recording' && 'Grabando...'}
          {state === 'stopped' && 'Grabación detenida'}
          {state === 'uploading' && 'Guardando...'}
          {state === 'saved' && 'Guardado exitosamente'}
        </span>
      </div>

      {/* Description */}
      <div className="field-group">
        <label htmlFor="description" className="field-label">
          Descripción
        </label>
        <textarea
          id="description"
          className="field-textarea"
          rows={2}
          placeholder="Describe tu grabación (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={state === 'recording' || state === 'uploading'}
        />
      </div>

      {/* Live preview during recording */}
      {state === 'recording' && (
        <div className="video-wrapper">
          <div className="video-label">Vista previa en vivo</div>
          <video
            ref={liveVideoRef}
            autoPlay
            muted
            className="video-el"
          />
        </div>
      )}

      {/* Recorded preview */}
      {(state === 'stopped' || state === 'saved') && recordedBlob && (
        <div className="video-wrapper">
          <div className="video-label">Vista previa de la grabación</div>
          <video ref={previewVideoRef} controls className="video-el" />
        </div>
      )}

      {/* Error */}
      {error && <div className="error-msg">{error}</div>}

      {/* Success */}
      {state === 'saved' && savedId && (
        <div className="success-msg">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>Guardado. ID: <code className="id-code">{savedId}</code></span>
        </div>
      )}

      {/* Actions */}
      <div className="actions">
        {state === 'idle' && (
          <button onClick={startRecording} className="btn btn-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="8" />
            </svg>
            Iniciar grabación
          </button>
        )}

        {state === 'recording' && (
          <button onClick={stopRecording} className="btn btn-danger">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
            Detener grabación
          </button>
        )}

        {state === 'stopped' && (
          <>
            <button onClick={saveRecording} className="btn btn-primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              Guardar grabación
            </button>
            <button onClick={reset} className="btn btn-ghost">
              Cancelar
            </button>
          </>
        )}

        {state === 'uploading' && (
          <button disabled className="btn btn-primary btn-loading">
            <span className="spinner" />
            Guardando...
          </button>
        )}

        {state === 'saved' && (
          <div className="saved-actions">
            <button onClick={reset} className="btn btn-ghost">
              Nueva grabación
            </button>
            <a href="/recordings" className="btn btn-secondary">
              Ver grabaciones
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import jsQR from 'jsqr'
import { ThemeProvider } from '../theme'
import { getGameById } from '../../games'
import { publicApi } from '../../api/publicApi'

type ScanStatus = 'idle' | 'scanning' | 'redeeming' | 'ok' | 'already' | 'error'

const PRIZE_LABEL: Record<string, string> = {
  validation: 'Premio por pareja',
  raffle: 'Premio del sorteo',
}

export default function ValidatorShell() {
  const { gameId = '' } = useParams()
  const game = getGameById('EMPAREJA2')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const busyRef = useRef(false)
  const [status, setStatus] = useState<ScanStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const redeemToken = useCallback(async (raw: string) => {
    const token = raw.trim()
    if (!token || busyRef.current) return
    busyRef.current = true
    setStatus('redeeming')
    setMessage(null)
    try {
      const res = await publicApi.redeem(token)
      setStatus('ok')
      const kindLabel = PRIZE_LABEL[res.kind] || res.kind
      setMessage(`${kindLabel} entregado${res.label ? ` a ${res.label}` : ''}.`)
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err.status === 409 || err.message === 'AlreadyDelivered') {
        setStatus('already')
        setMessage('Este premio ya se había entregado.')
      } else {
        setStatus('error')
        setMessage(err.message || 'No se pudo validar el QR')
      }
    } finally {
      busyRef.current = false
    }
  }, [])

  const startScan = useCallback(async () => {
    stopCamera()
    setCameraError(null)
    setStatus('scanning')
    setMessage(null)
    busyRef.current = false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()
    } catch {
      setCameraError('No se pudo abrir la cámara. Revisa permisos.')
      setStatus('idle')
    }
  }, [stopCamera])

  useEffect(() => {
    if (!gameId) return
    void startScan()
    return () => stopCamera()
  }, [gameId, startScan, stopCamera])

  useEffect(() => {
    if (status !== 'scanning') return
    let raf = 0
    const tick = () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video && canvas && video.readyState >= 2 && !busyRef.current) {
        const w = video.videoWidth
        const h = video.videoHeight
        if (w && h) {
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h)
            const image = ctx.getImageData(0, 0, w, h)
            const code = jsQR(image.data, w, h, { inversionAttempts: 'dontInvert' })
            if (code?.data) {
              stopCamera()
              void redeemToken(code.data)
              return
            }
          }
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [status, redeemToken, stopCamera])

  const colors = game?.colors

  return (
    <ThemeProvider game={game ?? null}>
      <div
        className="min-h-dvh text-textMain font-sans px-4 py-6"
        style={{ background: colors?.background ?? '#0B0A12', color: colors?.textMain ?? '#EAEAF2' }}
      >
        <div className="mx-auto max-w-md w-full space-y-4">
          <h1 className="text-xl font-bold text-center">Validador de premios</h1>
          {gameId && <p className="text-center text-xs text-textSub font-mono">{gameId}</p>}

          <div className="relative overflow-hidden rounded-xl border border-white/15 bg-black/40 aspect-[3/4]">
            <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />
            {(status === 'redeeming' || status === 'ok' || status === 'already' || status === 'error') && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4 text-center">
                <div className="space-y-2">
                  {status === 'redeeming' && <p className="text-textSub">Validando...</p>}
                  {status === 'ok' && <p className="text-green-300 font-semibold">{message}</p>}
                  {status === 'already' && <p className="text-amber-300 font-semibold">{message}</p>}
                  {status === 'error' && <p className="text-red-300 font-semibold">{message}</p>}
                </div>
              </div>
            )}
          </div>

          {cameraError && <p className="text-sm text-red-300 text-center">{cameraError}</p>}
          {status === 'scanning' && (
            <p className="text-sm text-textSub text-center">Apunta al QR del premio del jugador</p>
          )}

          {(status === 'ok' || status === 'already' || status === 'error' || status === 'idle') && (
            <button
              type="button"
              onClick={() => void startScan()}
              className="w-full rounded-xl py-3 font-semibold border border-white/15"
            >
              Escanear otro
            </button>
          )}
        </div>
      </div>
    </ThemeProvider>
  )
}

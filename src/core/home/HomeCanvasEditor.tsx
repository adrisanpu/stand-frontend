import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { getHomeCanvas, saveHomeCanvas, type HomeCanvasResponse } from '../../api/homeCanvas'
import { fetchUserMedia, uploadHomeBackground, type UserMediaItem } from '../../api/userMedia'
import { getGameById } from '../../games'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import type { ParticipantAppearance } from '../theme/appearance'
import HomeCanvas from './HomeCanvas'
import useHomeSamples from './HomeSamples'
import {
  HOME_GRID, HOME_ITEM_TYPES, HOME_MIN_SIZE, canPlaceHomeItem, findHomeSpace,
  type HomeCanvasConfig, type HomeComposition, type HomeItem, type HomeItemType, type HomeOrientation,
} from './canvasModel'
import { homePreviewTheme } from './previewTheme'

type Props = {
  gameId: string
  gameName: string
  appearance: ParticipantAppearance | null
  logoSrc?: string | null
  readOnly?: boolean
  advanced: boolean
  onDirtyChange?: (dirty: boolean) => void
  onBusyChange?: (busy: boolean) => void
  onReadyChange?: (ready: boolean) => void
  onPreviewChange?: (config: HomeCanvasConfig, orientation: HomeOrientation, urls: Record<HomeOrientation, string | null>) => void
}

export default function HomeCanvasEditor({ gameId, gameName, appearance, logoSrc, readOnly = false, advanced, onDirtyChange, onBusyChange, onPreviewChange, onReadyChange }: Props) {
  const { t } = useOperatorLanguage()
  const samples = useHomeSamples()
  const [confirmed, setConfirmed] = useState<HomeCanvasResponse | null>(null)
  const [draft, setDraft] = useState<HomeCanvasConfig | null>(null)
  const [orientation, setOrientation] = useState<HomeOrientation>('landscape')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [colorEditorId, setColorEditorId] = useState<string | null>(null)
  const backgroundControl = useRef<HTMLSelectElement>(null)
  useEffect(() => {
    if (colorEditorId && colorEditorId === selectedId) backgroundControl.current?.focus()
  }, [colorEditorId, selectedId])
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const [reload, setReload] = useState(0)
  const [confirmReload, setConfirmReload] = useState(false)
  const [media, setMedia] = useState<UserMediaItem[]>([])
  const drag = useRef<{ item: HomeItem; x: number; y: number; unit: number; resize: boolean } | null>(null)
  const callbacks = useRef({ onDirtyChange, onBusyChange, onPreviewChange, onReadyChange })
  callbacks.current = { onDirtyChange, onBusyChange, onPreviewChange, onReadyChange }
  const dirty = !!confirmed && !!draft && JSON.stringify(confirmed.homeCanvas) !== JSON.stringify(draft)
  useEffect(() => { callbacks.current.onDirtyChange?.(dirty) }, [dirty])
  useEffect(() => {
    callbacks.current.onReadyChange?.(!!confirmed && !!draft && !busy && !dirty && !error && !uncertain)
  }, [confirmed, draft, busy, dirty, error, uncertain])
  useEffect(() => {
    if (!draft || !confirmed) return
    const url = (key: HomeOrientation) => media.find(item => item.key === draft[key].background?.key)?.url
      ?? (draft[key].background?.key === confirmed.homeCanvas[key].background?.key ? confirmed.homeBackgroundUrls[key] : null)
    callbacks.current.onPreviewChange?.(draft, orientation, { landscape: url('landscape') ?? null, portrait: url('portrait') ?? null })
  }, [draft, orientation, confirmed, media])
  useEffect(() => () => {
    callbacks.current.onDirtyChange?.(false)
    callbacks.current.onBusyChange?.(false)
  }, [])
  useEffect(() => {
    let active = true
    busyRef.current = true
    setBusy(true)
    callbacks.current.onBusyChange?.(true)
    setError('')
    setConfirmed(null)
    setDraft(null)
    void getHomeCanvas(gameId).then(result => {
      if (!active) return
      setConfirmed(result)
      setDraft(result.homeCanvas)
      setUncertain(false)
      setSelectedId(null)
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : t('No se pudo cargar el lienzo.', 'Could not load the canvas.'))
    }).finally(() => {
      if (!active) return
      busyRef.current = false
      setBusy(false)
      callbacks.current.onBusyChange?.(false)
    })
    return () => { active = false }
  }, [gameId, reload, t])
  const disabled = busy || readOnly || confirmed?.readOnly || uncertain
  const composition = draft?.[orientation]
  const selected = composition?.items.find(item => item.id === selectedId)
  const definition = confirmed ? getGameById(confirmed.gameType) : undefined
  const labels: Record<HomeItemType, string> = {
    qr: 'QR', logo: t('Logo / nombre', 'Logo / name'), players: t('Jugadores', 'Players'),
    ranking: t('Ranking', 'Leaderboard'), raffle: t('Sorteo y ganadores', 'Raffle and winners'),
    prizes: t('Premios', 'Prizes'), text: t('Texto', 'Text'),
  }
  const change = (patch: Partial<HomeComposition>) => {
    setDraft(current => current ? { ...current, [orientation]: { ...current[orientation], ...patch } } : current)
    setNotice('')
  }
  const updateItem = (next: HomeItem) => {
    if (!composition) return
    if (!canPlaceHomeItem(next, composition.items, orientation)) {
      setNotice(t('No cabe: evita solapamientos, respeta el tamaño mínimo y los límites del lienzo.', 'Cannot fit: avoid overlaps and respect minimum sizes and canvas bounds.'))
      return
    }
    change({ items: composition.items.map(item => item.id === next.id ? next : item) })
  }
  const add = (type: HomeItemType) => {
    if (!composition || disabled) return
    const minimum = HOME_MIN_SIZE[type]
    const item = findHomeSpace({
      id: crypto.randomUUID(), type, x: 0, y: 0,
      w: type === 'qr' ? 8 : type === 'text' ? 6 : type === 'prizes' ? 8 : Math.max(6, minimum.w),
      h: type === 'qr' ? 9 : type === 'text' ? 2 : type === 'prizes' ? 3 : Math.max(4, minimum.h),
      ...(type === 'text' ? { text: t('Tu texto aquí', 'Your text here'), fontSize: 48, align: 'left' as const } : {}),
    }, composition.items, orientation)
    if (!item) { setNotice(t('No hay espacio libre. Reduce o elimina otro componente.', 'No free space. Resize or remove another component.')); return }
    change({ items: [...composition.items, item] })
    setSelectedId(item.id)
  }
  const start = (event: PointerEvent<HTMLButtonElement>, item: HomeItem, resize: boolean) => {
    if (disabled || event.button !== 0) return
    const stage = event.currentTarget.closest('[data-home-stage]')
    if (!stage) return
    setSelectedId(item.id)
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      item, x: event.clientX, y: event.clientY,
      unit: stage.getBoundingClientRect().width / HOME_GRID[orientation].cols, resize,
    }
  }
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current
    if (!current || current.unit <= 0 || disabled) return
    const x = Math.round((event.clientX - current.x) / current.unit)
    const y = Math.round((event.clientY - current.y) / current.unit)
    updateItem(current.resize ? { ...current.item, w: current.item.w + x, h: current.item.h + y }
      : { ...current.item, x: current.item.x + x, y: current.item.y + y })
  }
  const keyboard = (event: KeyboardEvent<HTMLButtonElement>, item: HomeItem, resize: boolean) => {
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
    if (!delta || disabled) return
    event.preventDefault()
    updateItem(resize ? { ...item, w: item.w + delta[0], h: item.h + delta[1] }
      : { ...item, x: item.x + delta[0], y: item.y + delta[1] })
  }
  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    callbacks.current.onBusyChange?.(true)
    setError('')
    try { await action() } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('No se pudo completar la operación.', 'Could not complete the operation.'))
    } finally {
      busyRef.current = false
      setBusy(false)
      callbacks.current.onBusyChange?.(false)
    }
  }
  const refreshMedia = async () => {
    const result = await fetchUserMedia()
    setMedia(result['home-background']?.items ?? [])
  }
  const background = composition?.background
  const backgroundUrl = media.find(item => item.key === background?.key)?.url
    ?? (background?.key === confirmed?.homeCanvas[orientation].background?.key ? confirmed?.homeBackgroundUrls[orientation] : null)
  const reloadCanvas = () => { setConfirmReload(false); setNotice(''); setReload(value => value + 1) }
  return <section className="min-w-0 w-full max-w-full space-y-4 rounded-xl border border-current/20 p-3 sm:p-4" aria-label={t('Editor del Home', 'Home editor')}>
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-xl font-semibold">{t('Lienzo del Home', 'Home canvas')}</h3>
        <p className="text-sm text-textSub">{t('Añade componentes y arrástralos. Las flechas mueven o redimensionan el elemento enfocado.', 'Add and drag components. Arrow keys move or resize the focused element.')}</p></div>
      <div className="flex gap-2" role="group" aria-label={t('Orientación del lienzo', 'Canvas orientation')}>
        {(['landscape', 'portrait'] as const).map(value => <button key={value} type="button" disabled={busy} aria-pressed={orientation === value}
          className={`min-h-11 rounded-lg border px-3 py-2 ${value === orientation ? 'border-primary bg-primary/10 font-semibold' : 'border-current/20'}`}
          onClick={() => { drag.current = null; setOrientation(value); setSelectedId(null); setNotice('') }}>
          {value === 'landscape' ? t('Horizontal', 'Landscape') : t('Vertical', 'Portrait')}
        </button>)}
      </div>
    </header>
    {draft && composition && <fieldset disabled={disabled} className="min-w-0 w-full max-w-full space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('Añadir componente', 'Add component')}>
        {HOME_ITEM_TYPES.filter(type => (type !== 'ranking' || definition?.showRanking)
          && (type !== 'raffle' || confirmed?.showRaffleOnHome !== false)).map(type => <button
          key={type} type="button" disabled={composition.items.length >= 40 || (type !== 'text' && composition.items.some(item => item.type === type))}
          className="min-h-11 rounded-lg border border-current/20 px-3 py-2 text-sm disabled:opacity-40" onClick={() => add(type)}>
          + {labels[type]}
        </button>)}
      </div>
      <div className={`mx-auto min-w-0 w-full rounded-xl border border-current/20 overflow-hidden ${orientation === 'portrait' ? 'max-w-[420px]' : 'max-w-full'}`}>
        <div style={homePreviewTheme(definition, appearance)}>
          <HomeCanvas composition={composition} orientation={orientation} gameId={gameId} gameName={gameName}
            logoSrc={logoSrc || definition?.assets?.logo} backgroundUrl={backgroundUrl} preview {...samples}
            overlay={item => <>
              <button type="button" disabled={disabled} className="home-item-select" aria-pressed={item.id === selectedId}
                aria-label={`${t('Mover', 'Move')} ${labels[item.type]}`} onClick={() => setSelectedId(item.id)}
                onPointerDown={event => start(event, item, false)} onPointerMove={move}
                onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}
                onKeyDown={event => keyboard(event, item, false)} />
              {item.id === selectedId && <button type="button" disabled={disabled} className="home-item-color"
                aria-label={`${t('Cambiar fondo', 'Change background')} ${labels[item.type]}`}
                title={t('Cambiar fondo', 'Change background')}
                aria-expanded={colorEditorId === item.id && selectedId === item.id}
                onClick={() => {
                  setSelectedId(item.id)
                  setColorEditorId(current => current === item.id && selectedId === item.id ? null : item.id)
                }}>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="m4 10 7-7 9 9-7 7-9-9ZM3 3l8 8M3 20h18M18 5s3 3 3 5a3 3 0 0 1-6 0c0-2 3-5 3-5Z" />
                </svg>
              </button>}
              {item.id === selectedId && <button type="button" disabled={disabled} className="home-item-resize"
                aria-label={`${t('Redimensionar', 'Resize')} ${labels[item.type]}`}
                onPointerDown={event => start(event, item, true)} onPointerMove={move}
                onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}
                onKeyDown={event => keyboard(event, item, true)}>↘</button>}
            </>} />
        </div>
      </div>
      {selected && <div className="space-y-3 rounded-lg border border-current/15 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><strong>{labels[selected.type]}</strong>
          <button type="button" className="min-h-11 rounded border border-current/20 px-3"
            onClick={() => { change({ items: composition.items.filter(item => item.id !== selected.id) }); setSelectedId(null) }}>
            {t('Eliminar componente', 'Remove component')}
          </button>
        </div>
        {colorEditorId === selected.id && <div className="flex flex-wrap items-center gap-4">
          <label className="text-sm">{t('Fondo del componente', 'Component background')}
            <select ref={backgroundControl} className="ml-2 rounded border border-current/20 bg-transparent p-2"
              value={selected.backgroundColor === undefined ? 'default' : selected.backgroundColor === 'transparent' ? 'transparent' : 'color'}
              onChange={event => {
                if (event.target.value === 'default') {
                  const next = { ...selected }
                  delete next.backgroundColor
                  updateItem(next)
                } else updateItem({ ...selected, backgroundColor: event.target.value === 'transparent' ? 'transparent' : '#152F3A' })
              }}>
              <option value="default">{t('Predeterminado', 'Default')}</option>
              <option value="transparent">{t('Transparente (sin color)', 'Transparent (no color)')}</option>
              <option value="color">{t('Color', 'Color')}</option>
            </select>
          </label>
          {selected.backgroundColor !== undefined && selected.backgroundColor !== 'transparent' && <label className="text-sm">
            {t('Color de fondo del componente', 'Component background color')}
            <input type="color" className="ml-2" value={selected.backgroundColor}
              onChange={event => updateItem({ ...selected, backgroundColor: event.target.value })} />
          </label>}
        </div>}
        {selected.type === 'qr' && <p className="text-xs">{t('El propio código QR conserva su contraste para poder escanearlo.', 'The QR code itself retains its contrast so it remains scannable.')}</p>}
        {selected.type === 'text' && <div className="space-y-3">
          <label className="block text-sm">{t('Texto', 'Text')}
            <textarea maxLength={1000} rows={3} value={selected.text ?? ''}
              className="mt-1 w-full rounded border border-current/20 bg-transparent p-2" onChange={event => updateItem({ ...selected, text: event.target.value })} /></label>
          <div className="flex flex-wrap gap-4">
            <label className="text-sm">{t('Tamaño del texto', 'Text size')}
              <input type="number" min={16} max={160} step={1} value={selected.fontSize ?? 48}
                className="ml-2 w-20 rounded border border-current/20 bg-transparent p-2"
                onChange={event => {
                  const fontSize = Number(event.target.value)
                  if (Number.isInteger(fontSize) && fontSize >= 16 && fontSize <= 160) updateItem({ ...selected, fontSize })
                  else setNotice(t('El tamaño del texto debe ser un entero entre 16 y 160.', 'Text size must be an integer between 16 and 160.'))
                }} /></label>
            <label className="text-sm">{t('Alineación', 'Alignment')}
              <select value={selected.align ?? 'left'} className="ml-2 rounded border border-current/20 bg-transparent p-2"
                onChange={event => updateItem({ ...selected, align: event.target.value as HomeItem['align'] })}>
                <option value="left">{t('Izquierda', 'Left')}</option><option value="center">{t('Centro', 'Center')}</option><option value="right">{t('Derecha', 'Right')}</option>
              </select></label>
            <label className="text-sm">{t('Color', 'Color')} {!advanced && '(Event)'}
              <input type="color" disabled={!advanced} value={selected.color ?? '#FFFFFF'} className="ml-2"
                onChange={event => updateItem({ ...selected, color: event.target.value })} /></label>
          </div>
        </div>}
      </div>}
      <details className="rounded-lg border border-current/15 p-3">
        <summary className="cursor-pointer font-medium">{t('Fondo de este lienzo', 'Background for this canvas')} {!advanced && '(Event)'}</summary>
        <fieldset disabled={!advanced} className="mt-3 space-y-3">
          <button type="button" className="min-h-11 underline" onClick={() => void run(refreshMedia)}>{t('Abrir biblioteca de fondos', 'Open background library')}</button>
          <label className="block text-sm">{t('Fondo guardado', 'Saved background')}
            <select className="mt-1 w-full rounded border border-current/20 bg-transparent p-2" value={background?.key ?? ''}
              onChange={event => {
                const item = media.find(item => item.key === event.target.value)
                change({ background: item ? { key: item.key, type: item.contentType.startsWith('video/') ? 'video' : 'image' } : null })
              }}>
              <option value="">{t('Sin fondo', 'No background')}</option>
              {background && !media.some(item => item.key === background.key) && <option value={background.key}>{t('Fondo actual', 'Current background')}</option>}
              {media.map(item => <option key={item.id} value={item.key}>{item.name || item.fileName}</option>)}
            </select>
          </label>
          <label className="block text-sm">{t('Subir imagen o vídeo', 'Upload image or video')}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,video/mp4,video/webm" className="mt-2 block w-full"
              onChange={event => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                void run(async () => {
                  const item = await uploadHomeBackground(file)
                  change({ background: { key: item.key, type: file.type.startsWith('video/') ? 'video' : 'image' } })
                  await refreshMedia()
                })
              }} />
          </label>
          <p className="text-xs">{t('Imágenes hasta 5 MB. MP4/WebM hasta 100 MB, en bucle y con sonido. La vista del editor permanece silenciada.', 'Images up to 5 MB. MP4/WebM up to 100 MB, looped with sound. The editor preview stays muted.')}</p>
        </fieldset>
      </details>
    </fieldset>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {error && <p role="alert" className="text-sm">{error}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-current/15 pt-3">
      <p className="text-xs">{dirty ? t('Lienzo con cambios sin guardar', 'Canvas has unsaved changes') : t('Lienzo sin cambios pendientes', 'Canvas has no pending changes')}</p>
      <div className="flex gap-3">
        <button type="button" disabled={busy} className="min-h-11 rounded-lg border border-current/20 px-3 py-2"
          onClick={() => dirty ? setConfirmReload(true) : reloadCanvas()}>{t('Recargar lienzo', 'Reload canvas')}</button>
        <button type="button" disabled={disabled || !dirty} className="min-h-11 rounded-lg bg-primary px-4 py-2 text-white disabled:opacity-40"
          onClick={() => {
            if (!draft || !confirmed) return
            void run(async () => {
              try {
                const result = await saveHomeCanvas(gameId, draft, confirmed.homeRevision)
                setConfirmed(result)
                setDraft(result.homeCanvas)
                setNotice(t('Lienzo guardado y confirmado.', 'Canvas saved and confirmed.'))
                window.dispatchEvent(new CustomEvent('home-canvas-updated', { detail: { gameId } }))
              } catch (reason) {
                setUncertain(true)
                throw new Error(`${t('No se confirmó el guardado. Recarga antes de reintentar.', 'Saving was not confirmed. Reload before retrying.')} ${reason instanceof Error ? reason.message : ''}`)
              }
            })
          }}>{busy ? t('Guardando…', 'Saving…') : t('Guardar lienzo', 'Save canvas')}</button>
      </div>
    </div>
    {confirmReload && <div role="alertdialog" aria-label={t('Descartar cambios del lienzo', 'Discard canvas changes')} className="space-y-2 border rounded p-3">
      <p>{t('Recargar descartará los cambios del lienzo.', 'Reloading will discard canvas changes.')}</p>
      <button type="button" className="mr-4 underline" onClick={reloadCanvas}>{t('Recargar y descartar', 'Reload and discard')}</button>
      <button type="button" className="underline" onClick={() => setConfirmReload(false)}>{t('Seguir editando', 'Keep editing')}</button>
    </div>}
  </section>
}

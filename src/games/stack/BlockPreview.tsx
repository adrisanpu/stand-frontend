import { useEffect, useRef, useState } from 'react'
import type { WebGLRenderer } from 'three'
import { useOperatorLanguage } from '../../core/shell/operatorLanguage'
import type { createStackVisuals } from './stackVisuals'
import type { StackSkin } from './stackLogic'

export default function BlockPreview({ skin }: { skin: StackSkin }) {
  const { t } = useOperatorLanguage()
  const canvas = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const element = canvas.current
    if (!element) return
    setFailed(false)
    setReady(false)
    let renderer: WebGLRenderer | undefined
    let visuals: ReturnType<typeof createStackVisuals> | undefined
    let cancelled = false
    const lost = (event: Event) => { event.preventDefault(); setFailed(true) }
    element.addEventListener('webglcontextlost', lost)
    void Promise.all([import('three'), import('./stackVisuals')]).then(([
      { AmbientLight, DirectionalLight, OrthographicCamera, Scene, WebGLRenderer }, { createStackVisuals },
    ]) => {
      if (cancelled) return
      const context = element.getContext('webgl2', { alpha: true, antialias: false })
      if (!context) throw new Error('WebGL 2 unavailable')
      renderer = new WebGLRenderer({ canvas: element, context, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
      renderer.setSize(240, 160, false)
      const scene = new Scene()
      const camera = new OrthographicCamera(-3.75, 3.75, 2.5, -2.5, 0.1, 40)
      camera.position.set(6, 6, 8)
      camera.lookAt(0, 0, 0)
      scene.add(new AmbientLight('#fff1dc', 1.65))
      const light = new DirectionalLight('#fff0d5', 2.3)
      light.position.set(-3, 8, 5)
      scene.add(light)
      visuals = createStackVisuals(skin)
      const piece = visuals.create()
      const rectangle = { x: 0, z: 0, width: 3, depth: 3 }
      visuals.update(piece, { ...rectangle, y: 0 }, rectangle, skin === 'baklava' ? 0.8 : 0.4)
      scene.add(piece)
      renderer.render(scene, camera)
      setReady(true)
    }).catch(() => { if (!cancelled) setFailed(true) })
    return () => {
      cancelled = true
      element.removeEventListener('webglcontextlost', lost)
      visuals?.dispose()
      renderer?.dispose()
    }
  }, [skin, revision])
  return <figure className="rounded-xl border border-white/10 bg-white/5 p-2">
    <canvas ref={canvas} width={240} height={160} role="img" aria-label={t('Vista previa del bloque', 'Block preview')}
      className={`mx-auto h-40 w-60 max-w-full ${failed || !ready ? 'hidden' : ''}`} />
    {!failed && !ready && <p role="status" className="p-3 text-sm text-textSub">{t('Cargando vista previa...', 'Loading preview...')}</p>}
    {failed && <div role="alert" className="p-3 text-sm text-amber-300">
      <p>{t('No se pudo mostrar la vista previa 3D.', 'Could not display the 3D preview.')}</p>
      <button type="button" className="underline" onClick={() => setRevision((value) => value + 1)}>{t('Reintentar', 'Retry')}</button>
    </div>}
  </figure>
}

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Group, Scene } from 'three'
import BlockPreview from './BlockPreview'

const { renderer } = vi.hoisted(() => ({
  renderer: { setPixelRatio: vi.fn(), setSize: vi.fn(), render: vi.fn(), dispose: vi.fn() },
}))
vi.mock('three', async (original) => ({ ...await original<typeof import('three')>(), WebGLRenderer: vi.fn(() => renderer) }))
beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as WebGL2RenderingContext)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
it('renders one static block per selected skin and disposes resources when changing', async () => {
  const { rerender, unmount } = render(<BlockPreview skin="blocks" />)
  await waitFor(() => expect(renderer.render).toHaveBeenCalledTimes(1))
  let count = 1
  for (const skin of ['pizza', 'baklava'] as const) {
    rerender(<BlockPreview skin={skin} />)
    count += 1
    await waitFor(() => expect(renderer.render).toHaveBeenCalledTimes(count))
    const scene = renderer.render.mock.lastCall![0] as Scene
    const blocks = scene.children.filter((child) => child instanceof Group)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].scale.y).toBe(skin === 'baklava' ? 0.8 : 0.4)
  }
  expect(renderer.render).toHaveBeenCalledTimes(3)
  expect(renderer.dispose).toHaveBeenCalledTimes(2)
  unmount()
  expect(renderer.dispose).toHaveBeenCalledTimes(3)
})
it('shows explicit failure and a retry instead of a wrong-skin fallback', async () => {
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null)
  render(<BlockPreview skin="pizza" />)
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo mostrar la vista previa 3D.')
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue({} as WebGL2RenderingContext)
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  await waitFor(() => expect(renderer.render).toHaveBeenCalledTimes(1))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

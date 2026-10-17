import { describe, expect, it } from 'vitest'
import {
  advanceStackMotion,
  cutStackLayer,
  DEFAULT_STACK_CONFIG,
  followStackHeight,
  intersectStackRectangles,
  isStackConfig,
  STACK_PLACING_SECONDS,
  StackEngine,
  stackSpeed,
} from './stackLogic'
import type { StackPlacement, StackRectangle } from './stackLogic'

describe('STACK configuration contract', () => {
  it('accepts the shared defaults', () => {
    expect(isStackConfig(DEFAULT_STACK_CONFIG)).toBe(true)
  })

  const base: StackRectangle = { x: 0, z: 0, width: 3, depth: 2 }

  describe('STACK rectangle geometry', () => {
    it.each([
      ['x', 0.5, 2.5, 2, 0.25],
      ['x', -0.5, 2.5, 2, -0.25],
      ['z', 0.5, 3, 1.5, 0.25],
      ['z', -0.5, 3, 1.5, -0.25],
    ] as const)('cuts %s offset %s with an independent fragment', (axis, offset, width, depth, centre) => {
      const moving = { ...base, [axis]: offset }
      const result = cutStackLayer(moving, base, axis, 0.06)
      expect(result.placement).toEqual({ axis, offset, perfect: false })
      expect(result.retained?.width).toBeCloseTo(width, 14)
      expect(result.retained?.depth).toBeCloseTo(depth, 14)
      expect(result.retained?.[axis]).toBeCloseTo(centre, 14)
      expect(result.fragments).toHaveLength(1)
      const area = result.fragments.reduce((sum, piece) => sum + piece.width * piece.depth, 0)
      expect(area + width * depth).toBeCloseTo(base.width * base.depth, 14)
      expect(Math.sign(result.fragments[0][axis])).toBe(Math.sign(offset))
      expect(result.fragments[0]).not.toBe(moving)
    })

    it.each(['x', 'z'] as const)('snaps %s inside and exactly at tolerance, preserving signed raw offsets and area', (axis) => {
      for (const offset of [-0.06, -0.02, 0, 0.02, 0.06]) {
        const result = cutStackLayer({ ...base, [axis]: offset }, base, axis, 0.06)
        expect(result.placement).toEqual({ axis, offset, perfect: true })
        expect(result.retained).toEqual(base)
        expect(result.fragments).toEqual([])
      }
      expect(cutStackLayer({ ...base, [axis]: 0.06000001 }, base, axis, 0.06).placement.perfect).toBe(false)
    })

    it.each([
      ['x', 3], ['x', -3], ['x', 4], ['x', -4],
      ['z', 2], ['z', -2], ['z', 3], ['z', -3],
    ] as const)('treats %s offset %s (including touching edges) as a full falling miss', (axis, offset) => {
      const moving = { ...base, [axis]: offset }
      const result = cutStackLayer(moving, base, axis, 0.06)
      expect(result.retained).toBeNull()
      expect(result.placement.perfect).toBe(false)
      expect(result.fragments).toEqual([moving])
    })

    it('rejects zero thickness and retains tiny positive overlaps without a gameplay epsilon', () => {
      expect(intersectStackRectangles(base, { ...base, width: 0 })).toBeNull()
      expect(intersectStackRectangles(base, { ...base, depth: 0 })).toBeNull()
      const result = cutStackLayer({ ...base, x: 3 - 1e-10 }, base, 'x', 0)
      expect(result.retained!.width).toBeGreaterThan(0)
      expect(result.retained!.width).toBeLessThan(1e-9)
      const narrow = { x: 0, z: 0, width: 0.01, depth: 2 }
      expect(cutStackLayer({ ...narrow, x: 0.01 }, narrow, 'x', 0.06).retained).toBeNull()
    })

    it('intersects and partitions both axes without double-counting corner fragments', () => {
      const moving = { ...base, x: -0.7, z: 0.4 }
      const result = cutStackLayer(moving, base, 'x', 0.06)
      expect(result.retained!.width).toBeCloseTo(2.3)
      expect(result.retained!.depth).toBeCloseTo(1.6)
      const pieces = [result.retained!, ...result.fragments]
      expect(pieces.reduce((area, piece) => area + piece.width * piece.depth, 0)).toBeCloseTo(6, 12)
      for (let i = 0; i < pieces.length; i++) {
        for (let j = i + 1; j < pieces.length; j++) {
          const intersection = intersectStackRectangles(pieces[i], pieces[j])
          expect(intersection ? intersection.width * intersection.depth : 0).toBeLessThan(1e-12)
        }
      }
      expect(result.placement.perfect).toBe(false)
    })
  })

  describe('STACK delta-time motion and camera', () => {
    it('reflects large overshoots including several full pingpong periods', () => {
      expect(advanceStackMotion(-4, 1, 2, 5, 4)).toEqual({ position: 2, direction: -1 })
      expect(advanceStackMotion(-4, 1, 2, 13, 4)).toEqual({ position: 2, direction: -1 })
      expect(advanceStackMotion(4, -1, 2, 4, 4)).toEqual({ position: -4, direction: 1 })
      expect(advanceStackMotion(-4, 1, 2, 4, 4)).toEqual({ position: 4, direction: -1 })
    })

    it.each([30, 60, 120])('matches a single elapsed-time step at %s FPS', (fps) => {
      let motion = { position: -4, direction: 1 as 1 | -1 }
      for (let i = 0; i < fps * 13; i++) {
        motion = advanceStackMotion(motion.position, motion.direction, 2.3, 1 / fps, 4)
      }
      const once = advanceStackMotion(-4, 1, 2.3, 13, 4)
      expect(motion.position).toBeCloseTo(once.position, 10)
      expect(motion.direction).toBe(once.direction)
      let camera = 0
      for (let i = 0; i < fps; i++) camera = followStackHeight(camera, 10, 1 / fps)
      expect(camera).toBeCloseTo(followStackHeight(0, 10, 1), 12)
    })

    it('uses the authoritative speed increment and cap without a level limit', () => {
      expect(stackSpeed(DEFAULT_STACK_CONFIG, 0)).toBe(2)
      expect(stackSpeed(DEFAULT_STACK_CONFIG, 1)).toBe(2.08)
      expect(stackSpeed(DEFAULT_STACK_CONFIG, 100000)).toBe(5)
      const engine = new StackEngine(DEFAULT_STACK_CONFIG)
      engine.start()
      engine.update(2)
      engine.place()
      engine.update(STACK_PLACING_SECONDS + 0.5)
      expect(engine.moving!.z - engine.top.z).toBeCloseTo(-4 + 2.08 * 0.5, 12)
    })
  })

  describe('STACK gameplay state machine', () => {
    it('is static IDLE until explicit confirmation and copies authoritative config', () => {
      const config = { ...DEFAULT_STACK_CONFIG }
      const engine = new StackEngine(config)
      config.initialWidth = 99
      engine.update(100)
      expect(engine.snapshot).toEqual({ state: 'IDLE', score: 0, perfect: false, placements: [] })
      expect(engine.moving).toBeNull()
      expect(engine.place()).toBeNull()
      expect(engine.start({ ...DEFAULT_STACK_CONFIG, initialSpeed: 3 })).toBe(true)
      expect(engine.config.initialSpeed).toBe(3)
      expect(engine.top.width).toBe(3)
      expect(engine.start()).toBe(false)
    })

    it('rejects invalid config at construction and explicit start', () => {
      expect(() => new StackEngine({ ...DEFAULT_STACK_CONFIG, initialSpeed: NaN })).toThrow()
      const engine = new StackEngine(DEFAULT_STACK_CONFIG)
      expect(() => engine.start({ ...DEFAULT_STACK_CONFIG, initialWidth: -1 })).toThrow()
      expect(engine.state).toBe('IDLE')
    })

    it('alternates axes, inherits trimmed dimensions, scores only valid placements, locks duplicate input', () => {
      const rules = { ...DEFAULT_STACK_CONFIG, speedIncrement: 0 }
      const engine = new StackEngine(rules)
      engine.start()
      engine.update(2.25)
      const first = engine.place()
      expect(first?.placement).toEqual({ axis: 'x', offset: 0.5, perfect: false })
      expect(engine.state).toBe('PLACING')
      expect(engine.score).toBe(1)
      expect(engine.place()).toBeNull()
      engine.update(STACK_PLACING_SECONDS - 0.001)
      expect(engine.place()).toBeNull()
      engine.update(0.001)
      expect(engine.state).toBe('PLAYING')
      expect(engine.axis).toBe('z')
      expect(engine.moving).toMatchObject({ width: 2.5, depth: 2, x: 0.25, y: 0.48 })
      engine.update(1.75)
      expect(engine.place()?.placement).toEqual({ axis: 'z', offset: -0.5, perfect: false })
      expect(engine.top).toEqual({ width: 2.5, depth: 1.5, x: 0.25, z: -0.25, y: 0.48 })
      expect(engine.score).toBe(2)
      engine.update(STACK_PLACING_SECONDS)
      expect(engine.moving).toMatchObject({ width: 2.5, depth: 1.5, z: -0.25 })
      const miss = engine.place()
      expect(miss?.retained).toBeNull()
      expect(engine.snapshot.state).toBe('GAME_OVER')
      expect(engine.snapshot.score).toBe(2)
      expect(engine.snapshot.placements).toHaveLength(3)
      expect(engine.start()).toBe(false)
      expect(engine.place()).toBeNull()
    })

    it('preserves area and raw signed placement for Perfect without bonus points', () => {
      const engine = new StackEngine(DEFAULT_STACK_CONFIG)
      engine.start()
      engine.update((4 - 0.04) / 2)
      const result = engine.place()
      expect(result?.placement.offset).toBeCloseTo(-0.04, 12)
      expect(result?.placement.perfect).toBe(true)
      expect(engine.top).toMatchObject({ x: 0, width: 3, depth: 2 })
      expect(engine.snapshot).toMatchObject({ state: 'PLACING', score: 1, perfect: true })
      engine.update(STACK_PLACING_SECONDS)
      expect(engine.snapshot).toMatchObject({ state: 'PLAYING', score: 1, perfect: false })
      expect(engine.snapshot.placements[0].perfect).toBe(true)
    })

    it('freezes motion and placement delay while paused, even when started paused', () => {
      const engine = new StackEngine(DEFAULT_STACK_CONFIG)
      engine.setPaused(true)
      engine.start()
      const start = { ...engine.moving! }
      engine.update(100)
      expect(engine.moving).toEqual(start)
      expect(engine.place()).toBeNull()
      engine.setPaused(false)
      engine.update(2)
      engine.place()
      engine.setPaused(true)
      engine.update(100)
      expect(engine.state).toBe('PLACING')
      engine.setPaused(false)
      engine.update(STACK_PLACING_SECONDS)
      expect(engine.state).toBe('PLAYING')
    })

    it('does not leak mutable placement history through snapshots or alter old snapshots', () => {
      const engine = new StackEngine(DEFAULT_STACK_CONFIG)
      const initial = engine.snapshot
      engine.start()
      engine.update(2)
      engine.place()
      const placed = engine.snapshot
      expect(Object.isFrozen(placed.placements)).toBe(true)
      expect(Object.isFrozen(placed.placements[0])).toBe(true)
      expect(() => (placed.placements as StackPlacement[]).push({ axis: 'x', offset: 99, perfect: false })).toThrow()
      expect(initial.placements).toHaveLength(0)
      expect(initial.state).toBe('IDLE')
      engine.update(1)
      expect(placed.state).toBe('PLACING')
    })

    it.each([NaN, Infinity, -1, 0])('ignores invalid elapsed time %s', (delta) => {
      const engine = new StackEngine(DEFAULT_STACK_CONFIG)
      engine.start()
      const moving = { ...engine.moving! }
      engine.update(delta)
      expect(engine.moving).toEqual(moving)
    })
  })

  it.each([undefined, null, {}, { ...DEFAULT_STACK_CONFIG, configVersion: '2' }])('rejects missing or unsupported rules: %s', (config) => {
    expect(isStackConfig(config)).toBe(false)
  })

  it.each([
    { initialSpeed: NaN },
    { maxSpeed: Infinity },
    { initialWidth: 0 },
    { speedIncrement: -1 },
    { perfectTolerance: -1 },
    { perfectTolerance: 1 },
    { maxSpeed: 1 },
  ])('rejects invalid numeric rules: %s', (patch) => {
    expect(isStackConfig({ ...DEFAULT_STACK_CONFIG, ...patch })).toBe(false)
  })

  it('accepts known skins and legacy configs without one, rejects unknown skins', () => {
    const { skin: _skin, ...legacy } = DEFAULT_STACK_CONFIG
    expect(isStackConfig(legacy)).toBe(true)
    expect(isStackConfig({ ...DEFAULT_STACK_CONFIG, skin: 'baklava' })).toBe(true)
    expect(isStackConfig({ ...DEFAULT_STACK_CONFIG, skin: 'donut' })).toBe(false)
  })
})

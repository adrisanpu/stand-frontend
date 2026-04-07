type Direction = 'up' | 'down' | 'left' | 'right'

type FocusNode = {
  id: string
  element: HTMLElement
  neighbors?: Partial<Record<Direction, string>>
}

export class FocusController {
  private nodes = new Map<string, FocusNode>()
  private orderedIds: string[] = []
  private activeId: string | null = null

  register(node: FocusNode) {
    this.nodes.set(node.id, node)
    if (!this.orderedIds.includes(node.id)) {
      this.orderedIds.push(node.id)
    }
  }

  unregister(id: string) {
    this.nodes.delete(id)
    this.orderedIds = this.orderedIds.filter((item) => item !== id)
    if (this.activeId === id) {
      this.activeId = null
    }
  }

  focus(id: string): boolean {
    const node = this.nodes.get(id)
    if (!node) return false
    node.element.focus()
    this.activeId = id
    return true
  }

  focusFirst(): boolean {
    const first = this.orderedIds[0]
    return first ? this.focus(first) : false
  }

  move(direction: Direction): boolean {
    if (!this.activeId) {
      return this.focusFirst()
    }

    const current = this.nodes.get(this.activeId)
    if (!current) return this.focusFirst()

    const explicitNextId = current.neighbors?.[direction]
    if (explicitNextId && this.nodes.has(explicitNextId)) {
      return this.focus(explicitNextId)
    }

    const currentIndex = this.orderedIds.indexOf(this.activeId)
    if (currentIndex < 0) return this.focusFirst()

    const delta = direction === 'left' || direction === 'up' ? -1 : 1
    const nextIndex = (currentIndex + delta + this.orderedIds.length) % this.orderedIds.length
    const nextId = this.orderedIds[nextIndex]
    return this.focus(nextId)
  }

  getActiveId() {
    return this.activeId
  }
}


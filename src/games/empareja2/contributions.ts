import { api } from '../../api/api'

export const MAX_DRAFT_PAIRS = 10
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export type DraftCharacter = { name: string; file: File | null; uploadId: string }
export type DraftPair = { id: string; characters: [DraftCharacter, DraftCharacter] }

export const newId = () => crypto.randomUUID().replace(/-/g, '')
export function newPair(): DraftPair {
  return { id: newId(), characters: [
    { name: '', file: null, uploadId: newId() },
    { name: '', file: null, uploadId: newId() },
  ] }
}

export function validateDrafts(pairs: DraftPair[]): string | null {
  if (pairs.length > MAX_DRAFT_PAIRS) return 'Se permiten hasta 10 parejas por guardado.'
  for (const pair of pairs) {
    for (const character of pair.characters) {
      if (!character.name.trim() || character.name.trim().length > 80 || /[\x00-\x1f]/.test(character.name)) {
        return 'Cada personaje necesita un nombre de hasta 80 caracteres.'
      }
      if (!character.file) return 'Selecciona una imagen para cada personaje.'
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(character.file.type)) return 'Las imágenes deben ser PNG, JPEG o WebP.'
      if (character.file.size < 1 || character.file.size > MAX_IMAGE_BYTES) return 'Cada imagen debe ocupar como máximo 5 MB.'
    }
  }
  return null
}

async function toPng(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('No se pudo leer la imagen.'))
      image.src = url
    })
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth > 4096 || image.naturalHeight > 4096) {
      throw new Error('Las imágenes deben tener dimensiones de hasta 4096 × 4096 píxeles.')
    }
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight))
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo procesar la imagen.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!png || png.size > MAX_IMAGE_BYTES) throw new Error('La imagen procesada supera 5 MB.')
    return png
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function uploadDrafts(gameId: string, pairs: DraftPair[]) {
  const uploaded: Array<Array<{ name: string; imageKey: string }>> = []
  for (const pair of pairs) {
    const characters: Array<{ name: string; imageKey: string }> = []
    for (const character of pair.characters) {
      if (!character.file) throw new Error('Falta una imagen de personaje.')
      const png = await toPng(character.file)
      const result = await api.post<{ ok: boolean; key: string; url: string; fields: Record<string, string> }>(
        '/v1/game/empareja2/catalog', { gameId, uploadId: character.uploadId, sizeBytes: png.size },
      )
      if (!result.ok || !result.key || !result.url || !result.fields) throw new Error('No se pudo preparar la subida.')
      const form = new FormData()
      Object.entries(result.fields).forEach(([key, value]) => form.append(key, value))
      form.append('file', png, 'character.png')
      const response = await fetch(result.url, { method: 'POST', body: form })
      if (!response.ok) throw new Error('No se pudo subir la imagen del personaje.')
      characters.push({ name: character.name.trim(), imageKey: result.key })
    }
    uploaded.push(characters)
  }
  return uploaded
}

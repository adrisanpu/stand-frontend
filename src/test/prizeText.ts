/** Matches a PrizeSticker label by its full accessible text, e.g. "PREMIO TOP 2: Copa" (badge and name are separate spans). */
export const prizeText = (text: string) => (_content: string, element: Element | null) =>
  element?.tagName === 'P' && element.hasAttribute('title') && element.textContent === text

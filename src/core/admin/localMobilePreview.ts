import { useState } from 'react'
import type { InfoCard, MobileAssignment, MobileMove } from '../../api/publicApi'
import type { useMobilePlay } from '../participant/useMobilePlay'
import type { FormQuestion } from '../formConfig'

export type PreviewSettings = Record<string, unknown>

const SAMPLE_PAIR_QUESTIONS: FormQuestion[] = [
  { id: 'preview-1', text: '¿Playa o montaña? (simulado)', options: [{ title: 'Playa', payload: 'beach' }, { title: 'Montaña', payload: 'mountain' }] },
  { id: 'preview-2', text: '¿Qué plan prefieres? (simulado)', options: [{ title: 'Playa', payload: 'beach' }, { title: 'Montaña', payload: 'mountain' }] },
]

export function localPairQuestions(settings: PreviewSettings): FormQuestion[] {
  return ((settings.questions as FormQuestion[] | undefined) ?? SAMPLE_PAIR_QUESTIONS).filter(question => question.id !== 'q1').slice(0, 3)
}

export function localPairAnswer(question: FormQuestion, round: number) {
  return question.options[(round % 2) % question.options.length]
}

export function initialLocalAssignment(gameType: 'L3TRAS' | 'SEMAFORO' | 'INFOCARDS', settings: PreviewSettings): MobileAssignment {
  const word = typeof settings.objectiveWord === 'string' ? settings.objectiveWord : ''
  return {
    gameType, playerId: 1, displayName: 'Alex (simulación)', validationCode: 1000, validated: false,
    letter: word[0],
    cards: settings.cards as InfoCard[] | undefined,
    play: { revision: 0, phase: 'idle', word, slots: Array.from(word, () => null) },
  }
}

export function advanceLocalAssignment(assignment: MobileAssignment, move: MobileMove, settings: PreviewSettings, now = Date.now()): MobileAssignment {
  const next = { ...assignment, play: { ...assignment.play, revision: assignment.play.revision + 1 } }
  if (assignment.gameType === 'L3TRAS') {
    const word = String(settings.objectiveWord)
    if (move.move === 'reset') return initialLocalAssignment('L3TRAS', settings)
    if (move.move !== 'code') throw new Error('Acción no disponible.')
    if (assignment.validated) throw new Error('La palabra ya está completa. Reinicia la prueba.')
    const index = Number(move.code) - 1000
    if (!/^\d{4}$/.test(move.code ?? '') || !Number.isInteger(index) || index < 0 || index >= word.length) {
      throw new Error('Ese código no pertenece a los jugadores simulados.')
    }
    const expired = !!next.play.expiresAt && now >= next.play.expiresAt
    const slots = expired ? Array.from(word, () => null as string | null) : [...(next.play.slots ?? [])]
    if (slots[index]) throw new Error('Ya has añadido ese código.')
    slots[index] = word[index]
    next.play.slots = slots
    next.play.phase = slots.every(Boolean) ? 'finished' : 'collecting'
    next.validated = next.play.phase === 'finished'
    if (!next.play.expiresAt || expired) next.play.expiresAt = now + Number(settings.validationTimeLimitSeconds ?? 60) * 1000
    return next
  }
  if (assignment.gameType === 'SEMAFORO') {
    const questions = localPairQuestions(settings)
    if (move.move === 'pair') {
      if (move.code !== '1001') throw new Error('Usa el código 1001 de Sam, tu pareja simulada.')
      next.play = { ...next.play, phase: 'quiz', participants: ['Alex', 'Sam'], strikes: 0, roundIndex: 0,
        turn: { guesser: 'Alex', target: 'Sam', ready: false } }
      if (!questions.length || (settings.quizMoment !== undefined && settings.quizMoment !== 'after_registration')) {
        next.play.phase = 'finished'
        next.play.result = 'won'
        next.validated = true
      }
    } else if (move.move === 'ready' && next.play.phase === 'quiz' && !next.play.turn?.ready) {
      const round = next.play.roundIndex ?? 0
      const question = questions[Math.floor(round / 2)]
      next.play.expiresAt = now + 5000
      next.play.turn = {
        guesser: round % 2 ? 'Sam' : 'Alex', target: round % 2 ? 'Alex' : 'Sam', ready: true,
        question,
      }
    } else if (move.move === 'answer' && next.play.phase === 'quiz' && next.play.turn?.ready) {
      const round = next.play.roundIndex ?? 0
      const correct = now < (next.play.expiresAt ?? 0) && move.answer === localPairAnswer(questions[Math.floor(round / 2)], round).payload
      next.play.lastCorrect = correct
      next.play.strikes = (next.play.strikes ?? 0) + (correct ? 0 : 1)
      next.play.roundIndex = round + 1
      next.play.expiresAt = undefined
      if (next.play.strikes >= 3 || round + 1 >= questions.length * 2) {
        next.play.phase = 'finished'
        next.play.result = next.play.strikes >= 3 ? 'lost' : 'won'
        next.validated = next.play.result === 'won'
      } else {
        next.play.turn = { guesser: round % 2 ? 'Alex' : 'Sam', target: round % 2 ? 'Sam' : 'Alex', ready: false }
      }
    } else throw new Error('Acción no disponible en este turno.')
    return next
  }
  return next
}

export function useLocalMobilePreview(gameType: 'L3TRAS' | 'SEMAFORO' | 'INFOCARDS', settings: PreviewSettings): ReturnType<typeof useMobilePlay> {
  const [assignment, setAssignment] = useState(() => initialLocalAssignment(gameType, settings))
  const [error, setError] = useState<string | null>(null)
  return {
    assignment, busy: false, error, loaded: true, pending: false,
    refresh: async () => { setError(null) },
    send: async move => {
      try {
        const next = advanceLocalAssignment(assignment, move, settings)
        setAssignment(next)
        setError(null)
        return true
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'No se pudo simular la acción.')
        return false
      }
    },
  }
}

import { useState, useEffect } from 'react'
import type { GameScreenProps } from '../../core/types'
import { LandscapeInfoInstruction } from '../../core/widgets/GameLandscapeInfoColumn'
import GameLandscapeLeftColumn from '../../core/widgets/GameLandscapeLeftColumn'
import BackButton from '../../core/widgets/BackButton'
import { api } from '../../api/api'
import { CODE_INPUT_PLACEHOLDER, VALIDATE_LABEL } from '../../core/ui/gameValidationCopy'
import {
  GAME_LANDSCAPE_CENTER_CARD,
  GAME_LANDSCAPE_THREE_COL_GRID,
} from '../../core/ui/gameScreenLayout'
import Empareja2OperatorScreen from './OperatorScreen'
import { resolveGameAccess } from '../../core/settings/gameAccess'
import { useOperatorLanguage } from '../../core/shell/operatorLanguage'
import { localizeOperatorMessage } from '../operatorText'

type GameState = 'idle' | 'validating' | 'valid' | 'invalid' | 'finished'

type ValidationResponse = {
  valid: boolean
  gameId: string
  pairId: string | null
  players: Array<{
    playerId: number
    username?: string
    characterId: number
    characterName: string
    characterImageUrl?: string | null
    profilePicUrl?: string | null
  }>
  message: string
  notified?: boolean
}

type PanelVariant = 'landscape' | 'portrait'

const SLOT_DIM: Record<PanelVariant, string> = {
  landscape: 'h-40 w-40 sm:h-44 sm:w-44',
  portrait: 'h-36 w-36 sm:h-40 sm:w-40',
}

const INPUT_ROW_CLASS: Record<PanelVariant, string> = {
  landscape: 'h-14 px-4 text-lg',
  portrait: 'h-12 px-4 text-lg',
}

const VALIDATE_BTN_PADDING: Record<PanelVariant, string> = {
  landscape: 'p-5 text-sm',
  portrait: 'p-4 text-base',
}

function ValidateCodesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function PairCharacterSlot({
  variant,
  player,
  filled,
  slotLabel,
}: {
  variant: PanelVariant
  player?: ValidationResponse['players'][0]
  filled: boolean
  slotLabel: string
}) {
  const { t } = useOperatorLanguage()
  const dim = SLOT_DIM[variant]
  const imgUrl = player?.characterImageUrl || null
  const profilePic =
    typeof player?.profilePicUrl === 'string' && player.profilePicUrl.trim() !== ''
      ? player.profilePicUrl.trim()
      : null
  const handle = player?.username?.trim() || null

  return (
    <div
      className={`relative ${dim} shrink-0 mx-auto rounded-xl overflow-hidden bg-[rgba(255,255,255,0.04)] border-2 border-[rgba(176,38,255,0.4)] flex items-center justify-center shadow-lg`}
    >
      {filled && imgUrl ? (
        <img
          src={imgUrl}
          alt={player?.characterName || slotLabel}
          className="max-w-full max-h-full w-auto h-auto object-contain"
        />
      ) : filled ? (
        <span className="text-xs text-gray-500 px-2 text-center">{slotLabel}</span>
      ) : (
        <span className="text-2xl text-gray-600 select-none" aria-hidden>
          ?
        </span>
      )}
      {filled && handle ? (
        <div className="absolute top-2 left-2 z-10 flex max-w-[calc(100%-0.5rem)] items-center gap-1.5">
          {profilePic ? (
            <img
              src={profilePic}
              alt={handle ? t(`Foto de perfil de ${handle}`, `Profile picture of ${handle}`) : t('Foto de perfil', 'Profile picture')}
              referrerPolicy="no-referrer"
              className="h-8 w-8 shrink-0 rounded-full border-2 border-[rgba(176,38,255,0.5)] object-cover shadow-md sm:h-9 sm:w-9"
            />
          ) : null}
          <span className="min-w-0 truncate rounded-md bg-black/70 px-2 py-1 text-xs font-semibold text-white sm:text-sm">
            {handle}
          </span>
        </div>
      ) : null}
    </div>
  )
}

export default function Empareja2GameScreen({
  gameId,
  orientation,
  logoElement,
  playersElement,
  sidebarElement,
  joinChannel,
  playMode,
}: GameScreenProps) {
  const { t } = useOperatorLanguage()
  const isPhoneMode = resolveGameAccess('EMPAREJA2', { playMode, joinChannel }).playMode === 'mobile'
  const [gameState, setGameState] = useState<GameState>('idle')
  const [code1, setCode1] = useState('')
  const [code2, setCode2] = useState('')
  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showInvalidMessage, setShowInvalidMessage] = useState(false)

  useEffect(() => {
    if (gameState !== 'invalid') {
      setShowInvalidMessage(false)
      return
    }
    setShowInvalidMessage(true)
    const t = setTimeout(() => setShowInvalidMessage(false), 3000)
    return () => clearTimeout(t)
  }, [gameState])

  const handleCodeChange = (value: string, setter: (value: string) => void) => {
    const numericValue = value.replace(/\D/g, '').slice(0, 4)
    setter(numericValue)
  }

  const validateCodes = async () => {
    if (!code1 || !code2 || code1.length !== 4 || code2.length !== 4) {
      setError(t('Ambos códigos deben tener 4 dígitos', 'Both codes must have 4 digits'))
      return
    }

    if (!gameId) {
      setError(t('No hay gameId disponible', 'No gameId available'))
      return
    }

    setGameState('validating')
    setError(null)
    setValidationResult(null)

    try {
      const result = await api.post<ValidationResponse>('/v1/game/validate', {
        gameId: gameId,
        codes: [code1, code2],
      })
      setValidationResult(result)

      if (result.valid) {
        setGameState('valid')
      } else {
        setGameState('invalid')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Error al validar los códigos', 'Error validating the codes'))
      setGameState('invalid')
    }
  }

  const handleReset = () => {
    setGameState('idle')
    setCode1('')
    setCode2('')
    setValidationResult(null)
    setError(null)
  }

  const renderCentralPairPanel = (variant: PanelVariant) => {
    const ic = INPUT_ROW_CLASS[variant]
    const bp = VALIDATE_BTN_PADDING[variant]
    const playersOk =
      gameState === 'valid' &&
      validationResult?.valid &&
      validationResult.players &&
      validationResult.players.length === 2
    const p0 = playersOk ? validationResult!.players[0] : undefined
    const p1 = playersOk ? validationResult!.players[1] : undefined

    if (playersOk) {
      return (
        <div className="animate-fade-in grid grid-cols-[1fr_auto_1fr] gap-3 sm:gap-4 items-center">
          <div className="flex flex-col items-center justify-center animate-scale-in min-w-0">
            <PairCharacterSlot variant={variant} player={p0} filled slotLabel={t('Jugador 1', 'Player 1')} />
          </div>
          <div className="flex flex-col items-center justify-center space-y-3 sm:space-y-4 text-center px-1">
            <span
              className={
                variant === 'portrait'
                  ? 'text-xl font-semibold text-green-400'
                  : 'text-2xl font-semibold text-green-400'
              }
            >
              {t('¡Pareja Válida!', 'Valid match!')}
            </span>
            <BackButton onClick={handleReset} aria-label={t('Validar otra pareja', 'Validate another match')} />
          </div>
          <div className="flex flex-col items-center justify-center animate-scale-in min-w-0" style={{ animationDelay: '0.2s' }}>
            <PairCharacterSlot variant={variant} player={p1} filled slotLabel={t('Jugador 2', 'Player 2')} />
          </div>
        </div>
      )
    }

    const showFormBlock = gameState === 'idle' || gameState === 'invalid' || gameState === 'validating'
    if (!showFormBlock) return null

    const validating = gameState === 'validating'
    const hideSubmit = gameState === 'invalid' && showInvalidMessage
    const inputDisabled = validating

    return (
      <div className="space-y-4">
        {error && gameState === 'invalid' && showInvalidMessage && (
          <div className="p-3 sm:p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">{localizeOperatorMessage(error, t)}</div>
        )}

        <div className="grid grid-cols-2 gap-4 justify-items-center">
          <PairCharacterSlot variant={variant} filled={false} slotLabel={t('Jugador 1', 'Player 1')} />
          <PairCharacterSlot variant={variant} filled={false} slotLabel={t('Jugador 2', 'Player 2')} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <input
            id="code1"
            type="number"
            inputMode="numeric"
            min={1000}
            max={9999}
            value={code1}
            disabled={inputDisabled}
            aria-label={t('Código del jugador 1', 'Player 1 code')}
            placeholder={t(CODE_INPUT_PLACEHOLDER, 'Enter code')}
            onChange={(e) => handleCodeChange(e.target.value, setCode1)}
            className={`w-full rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-center font-mono focus:border-white/20 focus:outline-none disabled:opacity-60 ${ic}`}
          />
          <input
            id="code2"
            type="number"
            inputMode="numeric"
            min={1000}
            max={9999}
            value={code2}
            disabled={inputDisabled}
            aria-label={t('Código del jugador 2', 'Player 2 code')}
            placeholder={t(CODE_INPUT_PLACEHOLDER, 'Enter code')}
            onChange={(e) => handleCodeChange(e.target.value, setCode2)}
            className={`w-full rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-center font-mono focus:border-white/20 focus:outline-none disabled:opacity-60 ${ic}`}
          />
        </div>

        {!hideSubmit && (
          <button
            type="button"
            onClick={() => void validateCodes()}
            disabled={validating || code1.length !== 4 || code2.length !== 4}
            className={`w-full rounded-xl bg-[rgba(176,38,255,0.2)] border border-[rgba(176,38,255,0.3)] hover:bg-[rgba(176,38,255,0.3)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold ${bp}`}
          >
            <div className="flex items-center justify-center gap-3">
              {validating ? (
                <svg className="w-6 h-6 shrink-0 animate-spin text-neonMagenta" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              ) : (
                <ValidateCodesIcon className="w-6 h-6 shrink-0" />
              )}
              {validating ? t('Validando…', 'Validating…') : t(VALIDATE_LABEL, 'Validate')}
            </div>
          </button>
        )}
      </div>
    )
  }

  const isLandscape = orientation === 'landscape' && logoElement != null && sidebarElement != null
  const gameName = localStorage.getItem('gameName') || gameId

  const renderPhoneCenter = () => {
    return <Empareja2OperatorScreen gameId={gameId} gameName={gameName} />
  }

  if (isLandscape) {
    return (
      <div className={GAME_LANDSCAPE_THREE_COL_GRID}>
        <GameLandscapeLeftColumn gameId={gameId} joinChannel={joinChannel} logoElement={logoElement} playersElement={playersElement}>
          {isPhoneMode ? (
            <>
              <LandscapeInfoInstruction>
                {t('Los asistentes juegan desde su móvil (/play).', 'Attendees play on their phones (/play).')}
              </LandscapeInfoInstruction>
              <LandscapeInfoInstruction>
                {t('Esta es la pantalla del evento para el monitor o proyector.', 'This is the event screen for the monitor or projector.')}
              </LandscapeInfoInstruction>
              <LandscapeInfoInstruction>
                {t('Los enlaces están en Configurar juego.', 'Links are in Game Settings.')}
              </LandscapeInfoInstruction>
            </>
          ) : (
            <>
              <LandscapeInfoInstruction>
                {t('Escanea el QR y completa el formulario web desde tu móvil.', 'Scan the QR code and complete the web form on your phone.')}
              </LandscapeInfoInstruction>
              <LandscapeInfoInstruction>
                {t('Recibe tu pareja asignada y tu código de validación.', 'Receive your assigned match and validation code.')}
              </LandscapeInfoInstruction>
              <LandscapeInfoInstruction>
                {t('Encuentra a tu pareja físicamente.', 'Find your match in person.')}
              </LandscapeInfoInstruction>
              <LandscapeInfoInstruction>
                {t('Cuando os encontréis, validad juntos vuestros códigos.', 'When you meet, validate your codes together.')}
              </LandscapeInfoInstruction>
            </>
          )}
        </GameLandscapeLeftColumn>
        <div className={`${GAME_LANDSCAPE_CENTER_CARD} justify-center items-center min-h-0`}>
          {isPhoneMode ? (
            renderPhoneCenter()
          ) : (
            <>
              {renderCentralPairPanel('landscape')}
              {gameState === 'invalid' && validationResult && !validationResult.valid && showInvalidMessage && (
                <div className="p-5 rounded-xl bg-red-500/20 border border-red-500/30 text-center animate-fade-in">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="text-xl font-semibold text-red-400">{t('Pareja Inválida', 'Invalid match')}</span>
                  </div>
                  {(validationResult.message || error) && (
                    <p className="text-base text-red-300">{validationResult.message || (error && localizeOperatorMessage(error, t))}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex flex-col gap-0 min-h-0 min-w-0 overflow-hidden items-center w-full">
          <div className="flex flex-col gap-1.5 p-0 flex-1 min-h-0 overflow-hidden items-center w-full min-w-0 bg-transparent border-0">
            {sidebarElement}
          </div>
        </div>
      </div>
    )
  }

  if (isPhoneMode) {
    return (
      <div className="w-full h-full min-h-0 flex flex-col overflow-hidden items-center justify-center">
        {renderPhoneCenter()}
      </div>
    )
  }

  return (
    <div className="w-full h-full min-h-0 flex flex-col overflow-hidden">
      <div className="flex flex-col overflow-hidden min-h-0 flex-1 gap-3">
        <div className="flex-shrink-0 space-y-3">
          {renderCentralPairPanel('portrait')}
        </div>

        {gameState === 'invalid' && validationResult && !validationResult.valid && showInvalidMessage && (
          <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-center animate-fade-in flex-shrink-0">
            <div className="flex items-center justify-center gap-3 mb-2">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="text-lg font-semibold text-red-400">{t('Pareja Inválida', 'Invalid match')}</span>
            </div>
            {(validationResult.message || error) && (
              <p className="text-sm text-red-300">{validationResult.message || (error && localizeOperatorMessage(error, t))}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

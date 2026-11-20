import { useParticipantLanguage } from './participantLanguage'

/** Shown instead of the QR when the operator delivers prizes by email only. */
export default function PrizeEmailNotice() {
  const { t } = useParticipantLanguage()
  return <p role="status" className="flex items-center gap-2 text-sm text-textSub">
    <span aria-hidden>📧</span>
    {t('Te enviamos el QR de tu premio por email. Revisa tu bandeja de entrada y spam.')}
  </p>
}

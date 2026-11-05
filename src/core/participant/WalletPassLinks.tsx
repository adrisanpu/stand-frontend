import { publicApi } from '../../api/publicApi'
import { useParticipantLanguage } from './participantLanguage'

export default function WalletPassLinks({ token }: { token: string }) {
  const { t } = useParticipantLanguage()
  return <div className="flex flex-wrap justify-center gap-2">
    <a className="rounded-lg border border-white/20 px-3 py-2 text-sm font-medium hover:bg-white/10"
      href={publicApi.walletPassUrl(token, 'apple')} target="_blank" rel="noopener noreferrer">
      {t('Añadir a Apple Wallet')}
    </a>
    <a className="rounded-lg border border-white/20 px-3 py-2 text-sm font-medium hover:bg-white/10"
      href={publicApi.walletPassUrl(token, 'google')} target="_blank" rel="noopener noreferrer">
      {t('Añadir a Google Wallet')}
    </a>
  </div>
}

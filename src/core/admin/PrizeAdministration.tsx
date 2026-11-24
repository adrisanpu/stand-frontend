import SharedPrizeCatalog from './SharedPrizeCatalog'
import PrizeInventory from './PrizeInventory'
import { useState } from 'react'
import { getGeneralRedeemUrl } from '../lib/joinUrl'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import QRCode from '../widgets/QRCode'

export default function PrizeAdministration() {
  const [inventoryVersion, setInventoryVersion] = useState(0)
  const { t } = useOperatorLanguage()
  const redeemUrl = getGeneralRedeemUrl()
  return <>
    <section aria-label={t('Validador de premios', 'Prize validator')}
      className="card flex w-fit max-w-full items-center gap-3 p-3">
      <QRCode data={redeemUrl} size={80} margin={4}
        alt={t('QR validador de premios', 'Prize validator QR code')} className="!bg-white !p-1" />
      <a className="min-w-0 break-all text-sm underline" href={redeemUrl} target="_blank" rel="noopener noreferrer">
        {t('Abrir validador de premios', 'Open prize validator')}
      </a>
    </section>
    <SharedPrizeCatalog onSaved={() => setInventoryVersion(value => value + 1)}>
    {({ catalog, actions, add, editor, busy }) => <PrizeInventory catalogVersion={inventoryVersion}
      catalog={catalog} catalogActions={actions} catalogAdd={add} catalogEditor={editor} catalogBusy={busy} />}
    </SharedPrizeCatalog>
  </>
}

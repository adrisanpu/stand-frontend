import SharedPrizeCatalog from './SharedPrizeCatalog'
import PrizeInventory from './PrizeInventory'
import { useState } from 'react'

export default function PrizeAdministration() {
  const [inventoryVersion, setInventoryVersion] = useState(0)
  const [inventoryBlocked, setInventoryBlocked] = useState(false)
  return <SharedPrizeCatalog disabled={inventoryBlocked} onSaved={() => setInventoryVersion(value => value + 1)}>
    {({ catalog, actions, editor, busy }) => <PrizeInventory catalogVersion={inventoryVersion}
      catalog={catalog} catalogActions={actions} catalogEditor={editor} catalogBusy={busy}
      onBlockedChange={setInventoryBlocked} />}
  </SharedPrizeCatalog>
}

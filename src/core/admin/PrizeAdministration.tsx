import SharedPrizeCatalog from './SharedPrizeCatalog'
import PrizeInventory from './PrizeInventory'
import { useState } from 'react'

export default function PrizeAdministration() {
  const [inventoryVersion, setInventoryVersion] = useState(0)
  return <SharedPrizeCatalog onSaved={() => setInventoryVersion(value => value + 1)}>
    {({ catalog, actions, add, editor, busy }) => <PrizeInventory catalogVersion={inventoryVersion}
      catalog={catalog} catalogActions={actions} catalogAdd={add} catalogEditor={editor} catalogBusy={busy} />}
  </SharedPrizeCatalog>
}

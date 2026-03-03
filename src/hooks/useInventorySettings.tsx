/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

const STORAGE_KEY = 'grey-store-inventory-enabled'

interface InventorySettingsContextValue {
  inventoryEnabled: boolean
  setInventoryEnabled: (enabled: boolean) => void
}

const InventorySettingsContext = createContext<InventorySettingsContextValue>({
  inventoryEnabled: true,
  setInventoryEnabled: () => {},
})

export function InventorySettingsProvider({ children }: { children: ReactNode }) {
  const [inventoryEnabled, setInventoryEnabledState] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === null ? true : stored === 'true'
  })

  const setInventoryEnabled = (enabled: boolean) => {
    localStorage.setItem(STORAGE_KEY, String(enabled))
    setInventoryEnabledState(enabled)
  }

  return (
    <InventorySettingsContext.Provider value={{ inventoryEnabled, setInventoryEnabled }}>
      {children}
    </InventorySettingsContext.Provider>
  )
}

export function useInventorySettings() {
  return useContext(InventorySettingsContext)
}

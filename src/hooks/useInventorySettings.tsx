/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { fetchInventoryEnabled, updateInventoryEnabled } from '../lib/api'

interface InventorySettingsContextValue {
  inventoryEnabled: boolean
  setInventoryEnabled: (enabled: boolean) => Promise<void>
}

const InventorySettingsContext = createContext<InventorySettingsContextValue>({
  inventoryEnabled: true,
  setInventoryEnabled: async () => {},
})

export function InventorySettingsProvider({ children }: { children: ReactNode }) {
  const [inventoryEnabled, setInventoryEnabledState] = useState<boolean>(true)

  useEffect(() => {
    // Load initial value from Supabase
    fetchInventoryEnabled()
      .then(setInventoryEnabledState)
      .catch((err) => { console.error('Failed to load inventory setting:', err) })

    // Reflect changes made by other users/devices in real time
    const channel = supabase
      .channel('app_settings_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_settings' },
        (payload) => {
          const record = payload.new as { inventory_enabled: boolean }
          setInventoryEnabledState(record.inventory_enabled)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const setInventoryEnabled = async (enabled: boolean) => {
    setInventoryEnabledState(enabled) // optimistic update
    try {
      await updateInventoryEnabled(enabled)
    } catch (err) {
      setInventoryEnabledState(!enabled) // revert on failure
      throw err
    }
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

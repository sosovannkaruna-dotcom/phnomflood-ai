import { createContext, useContext, type ReactNode } from 'react'

/**
 * Two versions of the same app, one codebase:
 * - demo: scripted and offline. Mock reports, a scripted storm, pre-written photo verdicts.
 * - live: real services. Open-Meteo rainfall, a real Vision AI check, reports shared between devices.
 */
export type AppMode = 'demo' | 'live'

const ModeContext = createContext<AppMode>('demo')

export function ModeProvider({ mode, children }: { mode: AppMode; children: ReactNode }) {
  return <ModeContext.Provider value={mode}>{children}</ModeContext.Provider>
}

export const useMode = () => useContext(ModeContext)

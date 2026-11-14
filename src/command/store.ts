// Typed view of the shared JavaScript store, so the command center sees the same
// flood reports and drain tickets as the rider app.
import { useFlood as useFloodUntyped } from '../store/FloodStore'
import type { FloodApi } from './types'

export const useFlood = useFloodUntyped as unknown as () => FloodApi

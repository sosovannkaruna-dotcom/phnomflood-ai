// Typed view of the shared JavaScript flood store.
import { useFlood as useFloodUntyped } from '../store/FloodStore'
import type { FloodApi } from './types'

export const useFlood = useFloodUntyped as unknown as () => FloodApi

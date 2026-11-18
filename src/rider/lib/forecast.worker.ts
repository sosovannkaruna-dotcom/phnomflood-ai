// Runs the flood forecast off the main thread: the terrain grid is loaded and decoded once, then
// each request runs the model (a few hundred milliseconds) and hands the depth frames back.

import { decodeHydrology, runForecast, type ForecastInput, type Hydrology, type HydrologyFile } from './forecast'

let grid: Promise<Hydrology> | null = null
const port = self as unknown as Worker

port.onmessage = async (e: MessageEvent<{ id: number; input: ForecastInput }>) => {
  const { id, input } = e.data
  try {
    grid ??= import('../../data/hydrology.generated.json').then(({ default: file }) => decodeHydrology(file as unknown as HydrologyFile))
    const result = runForecast(await grid, input)
    port.postMessage({ id, result }, [result.depth.buffer])
  } catch (error) {
    grid = null
    port.postMessage({ id, error: error instanceof Error ? error.message : String(error) })
  }
}

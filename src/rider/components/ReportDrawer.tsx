import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { BadgeCheck, Camera, CircleX, ImageOff, Loader2, TriangleAlert, Upload, X } from 'lucide-react'
import { DEPTHS } from '../../lib/severity'
import { DEMO_SCENARIOS, analyzeFloodPhoto } from '../../services/visionAI'
import type { DepthId } from '../../command/types'
import type { LatLng, Place, VisionResult } from '../types'

type ReportDepth = Exclude<DepthId, 'clear'>

// Depth references a rider can judge from the saddle, without typing.
const PRESETS: { id: ReportDepth; title: string; depth: string }[] = [
  { id: 'ankle', title: 'Ankle / Exhaust Safe', depth: '~10 cm' },
  { id: 'knee', title: 'Knee / Engine Risk', depth: '~25 cm' },
  { id: 'waist', title: 'Impassable / Deep Water', depth: '>40 cm' },
]
const SCAN_STEPS = ['Analyzing tire submersion...', 'Checking drainage database...', 'Finalizing verdict...']
const scenarios = DEMO_SCENARIOS as { id: string; title: string; hint: string; image: string; credit: string }[]

function Thumb({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div className={`grid place-items-center bg-white/[0.06] text-zinc-500 ${className}`}>
        <ImageOff className="h-5 w-5" />
      </div>
    )
  }
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
}

interface Props {
  place: Place
  position: LatLng
  onClose: () => void
  onSubmit: (report: { depth: ReportDepth; ai: VisionResult | null; photo: string | null }) => void
}

/** Two-tap field report: the shallowest depth is preselected, so Report → Submit works without another choice. */
export default function ReportDrawer({ place, position, onClose, onSubmit }: Props) {
  const [claimed, setClaimed] = useState<ReportDepth>('ankle')
  const [camera, setCamera] = useState(false)
  const [photo, setPhoto] = useState<{ url: string; credit: string | null } | null>(null)
  const [scanning, setScanning] = useState(false)
  const [step, setStep] = useState(0)
  const [ai, setAi] = useState<VisionResult | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const run = useRef(0)

  useEffect(() => () => void run.current++, [])
  useEffect(() => {
    if (!scanning) return
    setStep(0)
    const timer = window.setInterval(() => setStep((s) => Math.min(s + 1, SCAN_STEPS.length - 1)), 520)
    return () => window.clearInterval(timer)
  }, [scanning])

  async function verify(next: { url: string; credit: string | null }, input: { scenarioId?: string; file?: File }) {
    const id = ++run.current
    setPhoto(next)
    setAi(null)
    setScanning(true)
    const result = (await analyzeFloodPhoto({ ...input, userDepth: claimed })) as VisionResult
    if (id !== run.current) return
    setAi(result)
    setScanning(false)
  }

  function clearPhoto() {
    run.current++
    setPhoto(null)
    setAi(null)
    setScanning(false)
  }

  const verified = ai?.status === 'verified'
  const rejected = ai?.status === 'rejected'
  const depth: ReportDepth = verified && ai.depth ? ai.depth : claimed
  const canSubmit = !scanning && !rejected

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <motion.button aria-label="Close report" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60" />

      <motion.div
        role="dialog"
        aria-label="Report a flood"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 36 }}
        className="pb-safe relative flex max-h-[92%] flex-col rounded-t-2xl border-t border-white/[0.08] bg-[#0F1117]"
      >
        <span className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-white/20" />
        <div className="flex shrink-0 items-start justify-between gap-3 px-4 pb-3 pt-2">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-zinc-100">Flood on {place.area}</h2>
            <p className="truncate text-sm text-zinc-400">
              Khan {place.khan} · Sangkat {place.sangkat}
            </p>
            <p className="mt-1 font-mono text-xs text-zinc-400">
              {position[0].toFixed(5)}, {position[1].toFixed(5)} <span className="text-emerald-500">· GPS LOCKED</span>
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rd-press grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-white/[0.08] text-zinc-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="cc-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3">
          {/* Depth presets */}
          <div role="radiogroup" aria-label="Water depth" className="space-y-2">
            {PRESETS.map((p) => {
              const color = DEPTHS[p.id].color
              const selected = depth === p.id
              const overruled = verified && claimed === p.id && ai.depth !== p.id
              return (
                <button
                  key={p.id}
                  role="radio"
                  aria-checked={selected}
                  disabled={verified}
                  onClick={() => setClaimed(p.id)}
                  className={`rd-press flex min-h-[56px] w-full items-center gap-3 rounded-lg border px-3 text-left ${verified && !selected ? 'opacity-40' : ''}`}
                  style={selected ? { borderColor: color, background: `${color}1F` } : { borderColor: 'rgba(255,255,255,0.08)' }}
                >
                  <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                  <span className={`min-w-0 flex-1 text-base font-medium text-zinc-100 ${overruled ? 'line-through' : ''}`}>{p.title}</span>
                  <span className="shrink-0 font-mono text-sm" style={{ color }}>
                    {p.depth}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Optional photo for the Vision AI check */}
          {!camera && !photo && (
            <button onClick={() => setCamera(true)} className="rd-press flex min-h-[48px] w-full items-center gap-3 rounded-lg border border-white/[0.08] px-3 text-left text-sm text-zinc-300">
              <Camera className="h-5 w-5 shrink-0 text-sky-400" />
              Add a photo for AI depth check <span className="ml-auto text-xs text-zinc-500">optional</span>
            </button>
          )}

          {camera && !photo && (
            <div className="space-y-2 rounded-lg border border-white/[0.08] p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Demo photos</p>
              <div className="grid grid-cols-3 gap-2">
                {scenarios.map((s) => (
                  <button key={s.id} onClick={() => verify({ url: s.image, credit: s.credit }, { scenarioId: s.id })} className="rd-press overflow-hidden rounded-md border border-white/[0.08] text-left">
                    <Thumb src={s.image} alt={s.title} className="h-14 w-full object-cover" />
                    <span className="block px-2 py-1.5 text-xs font-medium leading-tight text-zinc-100">{s.title}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => fileInput.current?.click()} className="rd-press flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md border border-dashed border-white/20 text-sm text-zinc-300">
                <Upload className="h-5 w-5" /> Take or upload a photo
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) verify({ url: URL.createObjectURL(file), credit: null }, { file })
                  e.target.value = ''
                }}
              />
            </div>
          )}

          {photo && (
            <div className="space-y-2">
              <div className="relative h-28 overflow-hidden rounded-lg bg-white/[0.06]">
                <Thumb src={photo.url} alt="Submitted street" className="h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-black/75 px-3 py-2 font-mono text-xs text-zinc-100" aria-live="polite">
                  {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : verified ? <BadgeCheck className="h-4 w-4 text-emerald-500" /> : <CircleX className="h-4 w-4 text-red-500" />}
                  {scanning ? SCAN_STEPS[step] : verified ? 'VERIFIED' : rejected ? 'REJECTED' : 'NOT ANALYSED'}
                </span>
                <button onClick={clearPhoto} aria-label="Remove photo" className="rd-press absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-md bg-black/70 text-zinc-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {photo.credit && <p className="text-[11px] text-zinc-500">Photo: {photo.credit}</p>}

              {scanning && (
                <div className="space-y-2 rounded-lg border border-white/[0.08] p-3" aria-hidden>
                  <div className="cc-shimmer h-3 w-3/4 rounded-sm" />
                  <div className="cc-shimmer h-3 w-full rounded-sm" />
                  <div className="cc-shimmer h-3 w-2/3 rounded-sm" />
                </div>
              )}

              {verified && ai.reference && ai.drainage && (
                <div className="rounded-lg border border-white/[0.08] text-sm">
                  <p className={`flex items-start gap-2 border-b border-white/[0.08] px-3 py-2.5 leading-snug ${ai.correction ? 'text-amber-400' : 'text-zinc-100'}`}>
                    {ai.correction ? <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> : <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}
                    {ai.correction ? ai.correction.message : `AI confirms ${DEPTHS[ai.depth!].label} (~${ai.depthCm}cm).`}
                  </p>
                  <dl className="grid grid-cols-3 divide-x divide-white/[0.08] font-mono text-xs">
                    <div className="p-2.5">
                      <dt className="text-zinc-400">Reference</dt>
                      <dd className="mt-1 text-zinc-100">{ai.reference.object}</dd>
                    </div>
                    <div className="p-2.5">
                      <dt className="text-zinc-400">Submersion</dt>
                      <dd className="mt-1 text-zinc-100">~{ai.reference.submersionPct}%</dd>
                    </div>
                    <div className="p-2.5">
                      <dt className="text-zinc-400">Debris</dt>
                      <dd className="mt-1 text-zinc-100">{ai.reference.debris ? 'Yes' : 'No'}</dd>
                    </div>
                  </dl>
                  <p className="border-t border-white/[0.08] px-3 py-2 text-xs text-zinc-400">
                    {ai.drainage.status} ({Math.round(ai.drainage.confidence * 100)}% confidence) · {ai.source}
                  </p>
                </div>
              )}
              {rejected && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm leading-snug text-red-400">
                  <p className="font-medium">{ai.message}</p>
                  {ai.reason && <p className="mt-1 text-xs text-red-400/80">What the AI saw: {ai.reason}</p>}
                </div>
              )}
              {ai?.status === 'unavailable' && <p className="rounded-lg border border-white/[0.08] p-3 text-sm text-zinc-300">{ai.message} The report will be filed unverified.</p>}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-white/[0.08] p-3">
          <button
            disabled={!canSubmit}
            onClick={() => onSubmit({ depth, ai: verified ? ai : null, photo: photo?.url ?? null })}
            className="rd-press h-14 w-full rounded-lg bg-amber-500 font-mono text-base font-medium tracking-wide text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-zinc-500"
          >
            {rejected ? 'REPORT REJECTED' : scanning ? 'ANALYZING...' : 'SUBMIT TELEMETRY'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

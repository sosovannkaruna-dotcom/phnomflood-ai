import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { SealCheck as BadgeCheck, Camera, XCircle as CircleX, ImageBroken as ImageOff, CircleNotch as Loader2, Warning as TriangleAlert, UploadSimple as Upload, ArrowRight, X } from '@phosphor-icons/react'
import { DEPTHS } from '../../lib/severity'
import { DEMO_SCENARIOS, analyzeFloodPhoto } from '../../services/visionAI'
import type { DepthId } from '../../shared/types'
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
      <motion.button aria-label="Close report" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/65" />

      <motion.div
        role="dialog"
        aria-label="Report a flood"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 36 }}
        className="pb-safe relative flex max-h-[92%] flex-col border-t border-white/[0.15] bg-void"
      >
        <div className="tl-stripe shrink-0" aria-hidden />
        <div className="flex shrink-0 items-start justify-between gap-3 px-4 pb-3 pt-4">
          <div className="min-w-0">
            <p className="tl-label">Report a flood</p>
            <h2 className="tl-title mt-1 truncate text-2xl text-zinc-50">{place.area}</h2>
            <p className="mt-1 truncate text-sm text-zinc-400">
              Khan {place.khan} · Sangkat {place.sangkat}
            </p>
            <p className="mt-1 font-mono text-xs text-zinc-400">
              {position[0].toFixed(5)}, {position[1].toFixed(5)} <span className="text-emerald-400">GPS lock</span>
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rd-press grid h-12 w-12 shrink-0 place-items-center border border-white/[0.15] text-zinc-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="cc-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
          {/* Depth presets: one hairline-divided stack */}
          <div role="radiogroup" aria-label="Water depth" className="tl-grid border border-white/[0.15]">
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
                  className={`rd-press flex min-h-[60px] w-full items-stretch text-left ${verified && !selected ? 'opacity-40' : ''}`}
                  style={selected ? { background: `${color}22` } : undefined}
                >
                  <span className="w-1.5 shrink-0" style={{ background: color }} />
                  <span className={`flex min-w-0 flex-1 items-center px-3 text-base font-medium text-zinc-100 ${overruled ? 'line-through' : ''}`}>{p.title}</span>
                  <span className="flex shrink-0 items-center border-l border-white/[0.12] px-3 font-mono text-sm" style={{ color }}>
                    {p.depth}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Optional photo for the Vision AI check */}
          {!camera && !photo && (
            <button onClick={() => setCamera(true)} className="rd-press flex min-h-[52px] w-full items-center gap-3 border border-white/[0.15] px-3 text-left text-sm text-zinc-200">
              <Camera className="h-5 w-5 shrink-0 text-flare" />
              Add a photo for AI depth check <span className="tl-label ml-auto">Optional</span>
            </button>
          )}

          {camera && !photo && (
            <div className="space-y-2 border border-white/[0.15] p-3">
              <p className="tl-label">Demo photos</p>
              <div className="tl-grid grid-cols-2 border border-white/[0.12]">
                {scenarios.map((s) => (
                  <button key={s.id} onClick={() => verify({ url: s.image, credit: s.credit }, { scenarioId: s.id })} className="rd-press group overflow-hidden text-left">
                    <Thumb src={s.image} alt={s.title} className="ln-halftone h-16 w-full object-cover transition-transform duration-500 ease-punch group-hover:scale-105" />
                    <span className="block px-2 py-1.5 text-xs font-medium leading-tight text-zinc-100">{s.title}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => fileInput.current?.click()} className="rd-press flex min-h-[48px] w-full items-center justify-center gap-2 border border-dashed border-white/25 text-sm text-zinc-300">
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
              <div className="relative h-32 overflow-hidden border border-white/[0.15] bg-white/[0.06]">
                <Thumb src={photo.url} alt="Submitted street" className="h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-void/90 px-3 py-2 font-mono text-xs uppercase tracking-wider text-zinc-100" aria-live="polite">
                  {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : verified ? <BadgeCheck className="h-4 w-4 text-emerald-400" /> : <CircleX className="h-4 w-4 text-red-500" />}
                  {scanning ? SCAN_STEPS[step] : verified ? 'Verified' : rejected ? 'Rejected' : 'Not analysed'}
                </span>
                <button onClick={clearPhoto} aria-label="Remove photo" className="rd-press absolute right-2 top-2 grid h-9 w-9 place-items-center bg-void/80 text-zinc-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {photo.credit && <p className="text-[11px] text-zinc-500">Photo: {photo.credit}</p>}

              {scanning && (
                <div className="space-y-2 border border-white/[0.15] p-3" aria-hidden>
                  <div className="cc-shimmer h-3 w-3/4" />
                  <div className="cc-shimmer h-3 w-full" />
                  <div className="cc-shimmer h-3 w-2/3" />
                </div>
              )}

              {verified && ai.reference && ai.drainage && (
                <div className="border border-white/[0.15] text-sm">
                  <p className={`flex items-start gap-2 border-b border-white/[0.12] px-3 py-2.5 leading-snug ${ai.correction ? 'text-amber-400' : 'text-zinc-100'}`}>
                    {ai.correction ? <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> : <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />}
                    {ai.correction ? ai.correction.message : `AI confirms ${DEPTHS[ai.depth!].label} (~${ai.depthCm}cm).`}
                  </p>
                  <dl className="grid grid-cols-3 divide-x divide-white/[0.12] font-mono text-xs">
                    <div className="p-2.5">
                      <dt className="tl-label">Reference</dt>
                      <dd className="mt-1 text-zinc-100">{ai.reference.object}</dd>
                    </div>
                    <div className="p-2.5">
                      <dt className="tl-label">Submersion</dt>
                      <dd className="mt-1 text-zinc-100">~{ai.reference.submersionPct}%</dd>
                    </div>
                    <div className="p-2.5">
                      <dt className="tl-label">Debris</dt>
                      <dd className="mt-1 text-zinc-100">{ai.reference.debris ? 'Yes' : 'No'}</dd>
                    </div>
                  </dl>
                  <p className="border-t border-white/[0.12] px-3 py-2 text-xs text-zinc-400">
                    {ai.drainage.status} ({Math.round(ai.drainage.confidence * 100)}% confidence) · {ai.source}
                  </p>
                </div>
              )}
              {rejected && (
                <div className="border border-red-500/50 bg-red-500/10 p-3 text-sm leading-snug text-red-400">
                  <p className="font-medium">{ai.message}</p>
                  {ai.reason && <p className="mt-1 text-xs text-red-400/80">What the AI saw: {ai.reason}</p>}
                </div>
              )}
              {ai?.status === 'unavailable' && <p className="border border-white/[0.15] p-3 text-sm text-zinc-300">{ai.message} The report will be filed unverified.</p>}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-white/[0.12] p-3">
          <button disabled={!canSubmit} onClick={() => onSubmit({ depth, ai: verified ? ai : null, photo: photo?.url ?? null })} className="tl-cta h-14 text-base">
            <span>{rejected ? 'Report rejected' : scanning ? 'Analyzing...' : 'Submit report'}</span>
            <span>{scanning ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}</span>
          </button>
        </div>
      </motion.div>
    </div>
  )
}

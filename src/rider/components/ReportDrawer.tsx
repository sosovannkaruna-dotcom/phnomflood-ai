import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { SealCheck as BadgeCheck, Camera, MapPin, XCircle as CircleX, ImageBroken as ImageOff, CircleNotch as Loader2, Warning as TriangleAlert, UploadSimple as Upload, ArrowRight, X } from '@phosphor-icons/react'
import { DEPTHS } from '../../lib/severity'
import { DEMO_SCENARIOS, analyzeFloodPhoto } from '../../services/visionAI'
import { useT, type Key } from '../../i18n'
import { useMode } from '../../shared/mode'
import type { DepthId } from '../../shared/types'
import type { LatLng, Place, VisionResult } from '../types'
import { provenance, readPhotoMeta, type Provenance } from '../lib/photoMeta'
import TrustBadge from './TrustBadge'

type ReportDepth = Exclude<DepthId, 'clear'>

// Depth references a rider can judge from the saddle, without typing.
const PRESETS: { id: ReportDepth; depth: string }[] = [
  { id: 'ankle', depth: '~10 cm' },
  { id: 'knee', depth: '~25 cm' },
  { id: 'waist', depth: '>40 cm' },
]
const SCAN_STEPS: Key[] = ['scan.1', 'scan.2', 'scan.3']
const SCENARIO_TITLE: Record<string, Key> = { ankle: 'depth.ankle', knee: 'depth.knee', waist: 'depth.waist', dry: 'weather.dry' }
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
  /** Guided tour: pick "knee", add the stalled-bike photo, let the AI correct it, then submit */
  autoplay?: boolean
}

/** Two-tap field report: the shallowest depth is preselected, so Report → Submit works without another choice. */
export default function ReportDrawer({ place, position, onClose, onSubmit, autoplay = false }: Props) {
  const { t } = useT()
  const mode = useMode()
  const [claimed, setClaimed] = useState<ReportDepth>('ankle')
  const [camera, setCamera] = useState(false)
  const [photo, setPhoto] = useState<{ url: string; credit: string | null } | null>(null)
  const [scanning, setScanning] = useState(false)
  const [step, setStep] = useState(0)
  const [ai, setAi] = useState<VisionResult | null>(null)
  // Does the photo show this place, now? Only then does its check count for the report.
  const [prov, setProv] = useState<Provenance | null>(null)
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
    setProv(null)
    setScanning(true)
    if (input.file) {
      const file = input.file
      void readPhotoMeta(file).then((meta) => id === run.current && setProv(provenance(meta, file.lastModified || null, position)))
    } else setProv(mode === 'live' ? { ok: false, kind: 'sample' } : { ok: true, kind: 'demo' })
    const result = (await analyzeFloodPhoto({ ...input, mode, userDepth: claimed })) as VisionResult
    if (id !== run.current) return
    setAi(result)
    setScanning(false)
  }

  function clearPhoto() {
    run.current++
    setPhoto(null)
    setAi(null)
    setProv(null)
    setScanning(false)
  }

  // Guided tour: the same taps a rider would make, paced so a viewer can follow each one.
  // (The photo step reads the latest `verify`, so it sends the depth picked a moment earlier.)
  const verifyLatest = useRef(verify)
  verifyLatest.current = verify
  useEffect(() => {
    if (!autoplay) return
    const bike = scenarios.find((s) => s.id === 'waist')
    const timers = [
      window.setTimeout(() => setClaimed('knee'), 900),
      window.setTimeout(() => setCamera(true), 1800),
      window.setTimeout(() => bike && void verifyLatest.current({ url: bike.image, credit: bike.credit }, { scenarioId: bike.id }), 2900),
    ]
    return () => timers.forEach((t) => window.clearTimeout(t))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay])

  const verified = ai?.status === 'verified'
  const rejected = ai?.status === 'rejected'
  // The photo's verdict sets the depth and travels with the report only when the photo is of this place, now.
  const counts = verified && !!prov?.ok
  const depth: ReportDepth = counts && ai.depth ? ai.depth : claimed
  const canSubmit = !scanning && !rejected

  // Guided tour: once the AI verdict has been on screen long enough to read, submit.
  useEffect(() => {
    if (!autoplay || !ai) return
    const timer = window.setTimeout(() => onSubmit({ depth: counts && ai.depth ? ai.depth : claimed, ai: counts ? ai : null, photo: photo?.url ?? null }), 3800)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, ai])
  const provText = (p: Provenance) => {
    switch (p.kind) {
      case 'here':
        if (p.metres < 0) return t('prov.timeOnly', { n: p.minutes ?? 0 })
        return p.minutes === null ? t('prov.hereNoTime', { m: p.metres }) : t('prov.hereAgo', { m: p.metres, n: p.minutes })
      case 'fresh':
        return t('prov.fresh')
      case 'demo':
        return t('prov.demo')
      case 'far':
        return t('prov.far', { km: (p.metres / 1000).toFixed(1) })
      case 'old':
        return t('prov.old', { h: p.hours })
      case 'sample':
        return t('prov.sample')
      default:
        return t('prov.unknown')
    }
  }
  const depthLabel = (d: ReportDepth) => t(`depth.${d}` as Key)
  const unavailableText = ai?.code === 'not_configured' ? t('ai.notConfigured') : ai?.code === 'demo_upload' ? t('ai.demoUpload') : t('ai.failed')

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <motion.button aria-label={t('report.closeBackdrop')} onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/65" />

      <motion.div
        role="dialog"
        aria-label={t('report.title')}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 36 }}
        className="pb-safe relative flex max-h-[92%] flex-col border-t border-white/[0.15] bg-void"
      >
        <div className="tl-stripe shrink-0" aria-hidden />
        <div className="flex shrink-0 items-start justify-between gap-3 px-4 pb-3 pt-4">
          <div className="min-w-0">
            <p className="tl-label">{t('report.title')}</p>
            <h2 className="tl-title mt-1 truncate text-2xl text-zinc-50">{place.area}</h2>
            <p className="mt-1 truncate text-sm text-zinc-400">{t('report.khanSangkat', { khan: place.khan, sangkat: place.sangkat })}</p>
            <p className="mt-1 font-mono text-xs text-zinc-400">
              {position[0].toFixed(5)}, {position[1].toFixed(5)} <span className="text-emerald-400">{t('hud.gps')}</span>
            </p>
            <TrustBadge />
          </div>
          <button onClick={onClose} aria-label={t('report.close')} className="rd-press grid h-12 w-12 shrink-0 place-items-center border border-white/[0.15] text-zinc-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="cc-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
          {/* Depth presets: one hairline-divided stack */}
          <div role="radiogroup" aria-label={t('report.depthGroup')} className="tl-grid border border-white/[0.15]">
            {PRESETS.map((p) => {
              const color = DEPTHS[p.id].color
              const selected = depth === p.id
              const overruled = counts && claimed === p.id && ai.depth !== p.id
              return (
                <button
                  key={p.id}
                  role="radio"
                  aria-checked={selected}
                  disabled={counts}
                  onClick={() => setClaimed(p.id)}
                  className={`rd-press flex min-h-[60px] w-full items-stretch text-left ${counts && !selected ? 'opacity-40' : ''}`}
                  style={selected ? { background: `${color}22` } : undefined}
                >
                  <span className="w-1.5 shrink-0" style={{ background: color }} />
                  <span className={`flex min-w-0 flex-1 items-center px-3 text-base font-medium text-zinc-100 ${overruled ? 'line-through' : ''}`}>{t(`depth.${p.id}.title` as Key)}</span>
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
              {t('report.addPhoto')} <span className="tl-label ml-auto">{t('report.optional')}</span>
            </button>
          )}

          {camera && !photo && (
            <div className="space-y-2 border border-white/[0.15] p-3">
              <p className="tl-label">{mode === 'live' ? t('report.samplePhotos') : t('report.demoPhotos')}</p>
              <div className="tl-grid grid-cols-2 border border-white/[0.12]">
                {scenarios.map((s) => (
                  <button key={s.id} onClick={() => verify({ url: s.image, credit: s.credit }, { scenarioId: s.id })} className="rd-press group overflow-hidden text-left">
                    <Thumb src={s.image} alt={s.title} className="h-16 w-full object-cover transition-transform duration-500 ease-punch group-hover:scale-105" />
                    <span className="block px-2 py-1.5 text-xs font-medium leading-tight text-zinc-100">{t(SCENARIO_TITLE[s.id] ?? 'report.demoPhotos')}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => fileInput.current?.click()} className="rd-press flex min-h-[48px] w-full items-center justify-center gap-2 border border-dashed border-white/25 text-sm text-zinc-300">
                <Upload className="h-5 w-5" /> {t('report.upload')}
              </button>
              {mode === 'live' && <p className="text-[11px] leading-snug text-zinc-500">{t('report.privacy')}</p>}
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
                <Thumb src={photo.url} alt="" className="h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-void/90 px-3 py-2 font-mono text-xs uppercase tracking-wider text-zinc-100" aria-live="polite">
                  {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : verified ? <BadgeCheck className="h-4 w-4 text-emerald-400" /> : <CircleX className="h-4 w-4 text-red-500" />}
                  {scanning ? (mode === 'live' ? t('scan.live') : t(SCAN_STEPS[step])) : verified ? t('photo.verified') : rejected ? t('photo.rejected') : t('photo.notAnalysed')}
                </span>
                <button onClick={clearPhoto} aria-label={t('photo.remove')} className="rd-press absolute right-2 top-2 grid h-9 w-9 place-items-center bg-void/80 text-zinc-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {photo.credit && <p className="text-[11px] text-zinc-500">{t('photo.credit', { credit: photo.credit })}</p>}

              {/* Where and when the photo was taken, against this report */}
              {prov && (
                <p className={`flex items-start gap-2 border px-3 py-2 text-xs leading-snug ${prov.ok ? 'border-white/[0.15] text-zinc-200' : 'border-amber-400/40 bg-amber-400/[0.06] text-amber-300'}`} aria-live="polite">
                  {prov.ok ? <MapPin weight="fill" className="mt-px h-4 w-4 shrink-0 text-emerald-400" /> : <TriangleAlert className="mt-px h-4 w-4 shrink-0" />}
                  <span>{provText(prov)}</span>
                </p>
              )}

              {scanning && (
                <div className="space-y-2 border border-white/[0.15] p-3" aria-hidden>
                  <div className="cc-shimmer h-3 w-3/4" />
                  <div className="cc-shimmer h-3 w-full" />
                  <div className="cc-shimmer h-3 w-2/3" />
                </div>
              )}

              {verified && ai.reference && ai.drainage && ai.depth && (
                <div className="border border-white/[0.15] text-sm">
                  <p className={`flex items-start gap-2 border-b border-white/[0.12] px-3 py-2.5 leading-snug ${ai.correction ? 'text-amber-400' : 'text-zinc-100'}`}>
                    {ai.correction ? <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> : <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />}
                    {ai.correction
                      ? t('ai.corrected', {
                          from: depthLabel(ai.correction.from),
                          to: depthLabel(ai.correction.to),
                          cue: ai.cue ?? '',
                          cm: ai.depthCm ?? '',
                          dir: ai.correction.direction === 'up' ? t('ai.up') : t('ai.down'),
                        })
                      : t('ai.confirms', { label: depthLabel(ai.depth), cm: ai.depthCm ?? '' })}
                  </p>
                  <dl className="grid grid-cols-3 divide-x divide-white/[0.12] font-mono text-xs">
                    <div className="p-2.5">
                      <dt className="tl-label">{t('ai.reference')}</dt>
                      <dd className="mt-1 text-zinc-100">{ai.reference.object}</dd>
                    </div>
                    <div className="p-2.5">
                      <dt className="tl-label">{t('ai.submersion')}</dt>
                      <dd className="mt-1 text-zinc-100">~{ai.reference.submersionPct}%</dd>
                    </div>
                    <div className="p-2.5">
                      <dt className="tl-label">{t('ai.debris')}</dt>
                      <dd className="mt-1 text-zinc-100">{ai.reference.debris ? t('ai.yes') : t('ai.no')}</dd>
                    </div>
                  </dl>
                  <p className="border-t border-white/[0.12] px-3 py-2 text-xs text-zinc-400">
                    {ai.drainage.status} ({Math.round(ai.drainage.confidence * 100)}%) · {ai.source === 'live' ? t('ai.source.live') : t('ai.source.demo')}
                  </p>
                </div>
              )}
              {rejected && (
                <div className="border border-red-500/50 bg-red-500/10 p-3 text-sm leading-snug text-red-400">
                  <p className="font-medium">{t('ai.rejected')}</p>
                  {ai.reason && <p className="mt-1 text-xs text-red-400/80">{t('ai.saw', { reason: ai.reason })}</p>}
                </div>
              )}
              {ai?.status === 'unavailable' && <p className="border border-white/[0.15] p-3 text-sm leading-snug text-zinc-300">{unavailableText}</p>}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-white/[0.12] p-3">
          <button disabled={!canSubmit} onClick={() => onSubmit({ depth, ai: counts ? ai : null, photo: photo?.url ?? null })} className="tl-cta h-14 text-base">
            <span>{rejected ? t('report.rejected') : scanning ? t('report.analyzing') : t('report.submit')}</span>
            <span>{scanning ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}</span>
          </button>
        </div>
      </motion.div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  CircleX,
  ImageOff,
  LocateFixed,
  Lock,
  MapPin,
  ScanLine,
  TriangleAlert,
  Upload,
  WifiOff,
  X,
} from 'lucide-react'
import { DEPTHS, REPORTABLE_DEPTHS } from '../../lib/severity'
import { DEMO_SCENARIOS, analyzeFloodPhoto } from '../../services/visionAI'

/** Image that degrades to a neutral placeholder instead of a broken icon. */
function SafeImage({ src, alt, className }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div className={`grid place-items-center bg-slate-100 text-slate-400 ${className}`}>
        <ImageOff className="h-5 w-5" />
      </div>
    )
  }
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
}

/**
 * Bottom sheet: location → claimed depth → photo → independent Vision AI verdict.
 * The AI can confirm the claim, correct it up or down, or reject the photo.
 */
export default function ReportDrawer({ location, usingCurrentPin, onUseCurrentPin, onPickOnMap, onClose, onSubmit }) {
  const [userDepth, setUserDepth] = useState(null) // what the citizen claims
  const [photo, setPhoto] = useState(null) // { url, credit }
  const [scan, setScan] = useState('idle') // idle | scanning | done
  const [ai, setAi] = useState(null)
  const fileInput = useRef(null)
  const runId = useRef(0)

  const scroller = useRef(null)

  useEffect(() => () => void runId.current++, [])

  // Bring the AI verdict into view inside the sheet (never scroll the page itself).
  useEffect(() => {
    const el = scroller.current
    if (ai && el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [ai])

  async function runScan(nextPhoto, input) {
    const id = ++runId.current
    setPhoto(nextPhoto)
    setAi(null)
    setScan('scanning')
    const result = await analyzeFloodPhoto({ ...input, userDepth })
    if (id !== runId.current) return
    setAi(result)
    setScan('done')
  }

  function clearPhoto() {
    runId.current++
    setPhoto(null)
    setAi(null)
    setScan('idle')
  }

  function onFileChosen(event) {
    const file = event.target.files?.[0]
    if (file) runScan({ url: URL.createObjectURL(file), credit: null }, { file })
    event.target.value = ''
  }

  const verified = ai?.status === 'verified'
  const rejected = ai?.status === 'rejected'
  const finalDepth = verified ? ai.depth : userDepth
  const canSubmit = Boolean(location && finalDepth && scan !== 'scanning' && !rejected)
  const submitLabel = rejected
    ? 'Report rejected'
    : verified
      ? `Submit verified report · ${DEPTHS[ai.depth].label}`
      : photo && scan === 'done'
        ? 'Submit unverified report'
        : 'Submit report'

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <button aria-label="Close report sheet" onClick={onClose} className="absolute inset-0 animate-fade-in bg-ink/30" />

      <div className="relative flex max-h-[94%] animate-slide-up flex-col rounded-t-2xl bg-white shadow-sheet">
        <div className="shrink-0 px-4 pt-2">
          <span className="mx-auto block h-1 w-9 rounded-full bg-slate-300" />
          <div className="flex items-center justify-between pb-2 pt-2.5">
            <h2 className="text-[16px] font-semibold text-ink">Report a flood</h2>
            <button onClick={onClose} aria-label="Close" className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div ref={scroller} className="thin-scroll min-h-0 flex-1 space-y-4 overflow-y-auto border-t border-hairline px-4 py-3">
          {/* Location */}
          <section>
            <Label>Location</Label>
            <div className="grid grid-cols-2 gap-2">
              <Choice active={Boolean(location) && usingCurrentPin} onClick={onUseCurrentPin}>
                <LocateFixed className="h-4 w-4" /> Use Current Pin
              </Choice>
              <Choice active={Boolean(location) && !usingCurrentPin} onClick={onPickOnMap}>
                <MapPin className="h-4 w-4" /> Pick on Map
              </Choice>
            </div>
            {location && (
              <p className="mt-2 text-[12px] leading-snug text-muted">
                <span className="font-medium text-ink">{location.place.name}</span>
                <br />
                Khan {location.place.khan} · Sangkat {location.place.sangkat}
              </p>
            )}
          </section>

          {/* Claimed depth */}
          <section>
            <Label>
              How deep is the water?
              {verified && (
                <span className="ml-auto flex items-center gap-1 font-medium normal-case tracking-normal text-muted">
                  <Lock className="h-3 w-3" /> Set by AI
                </span>
              )}
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {REPORTABLE_DEPTHS.map((id) => {
                const d = DEPTHS[id]
                const active = finalDepth === id
                const overruled = verified && userDepth === id && ai.depth !== id
                return (
                  <button
                    key={id}
                    disabled={verified}
                    onClick={() => setUserDepth(id)}
                    className={`rounded-lg border px-1 py-2 text-center transition ${
                      active ? 'border-ink bg-white' : 'border-hairline bg-white'
                    } ${verified && !active ? 'opacity-50' : ''}`}
                    style={active ? { boxShadow: 'inset 0 0 0 1px #0F172A' } : undefined}
                  >
                    <span className="mx-auto mb-1 block h-1.5 w-6 rounded-full" style={{ background: d.color }} />
                    <span className={`block text-[12px] font-semibold text-ink ${overruled ? 'line-through' : ''}`}>{d.label}</span>
                    <span className="block text-[10px] text-muted">~{d.cm} cm</span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Photo + AI */}
          <section>
            <Label>Photo for AI verification</Label>
            {!photo ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {DEMO_SCENARIOS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => runScan({ url: s.image, credit: s.credit }, { scenarioId: s.id })}
                      className="overflow-hidden rounded-lg border border-hairline bg-white text-left transition hover:border-slate-400"
                    >
                      <SafeImage src={s.image} alt={s.title} className="h-14 w-full object-cover" />
                      <span className="block px-2 pb-1.5 pt-1">
                        <span className="block text-[11px] font-semibold leading-tight text-ink">{s.title}</span>
                        <span className="block text-[10px] leading-tight text-muted">{s.hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => fileInput.current?.click()}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 py-2.5 text-[12px] font-medium text-muted transition hover:border-slate-400 hover:text-ink"
                >
                  <Upload className="h-4 w-4" /> Upload your own photo
                </button>
                <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={onFileChosen} />
                <p className="mt-1.5 text-[10px] text-slate-400">Test photos above are bundled demo scenarios.</p>
              </>
            ) : (
              <div className="space-y-2.5">
                <div className="relative h-28 overflow-hidden rounded-lg bg-slate-100">
                  <SafeImage src={photo.url} alt="Submitted street" className="h-full w-full object-cover" />
                  {scan === 'scanning' && (
                    <>
                      <span className="absolute inset-x-0 h-px animate-scan bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.5)]" />
                      <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-ink/80 px-3 py-1.5 text-[12px] font-medium text-white">
                        <ScanLine className="h-3.5 w-3.5 animate-pulse" />
                        Analyzing image with Vision AI...
                      </span>
                    </>
                  )}
                  <button onClick={clearPhoto} aria-label="Remove photo" className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-ink/70 text-white">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {photo.credit && <p className="text-[9px] text-slate-400">Photo: {photo.credit}</p>}

                {ai && (
                  <div className="animate-fade-in">
                    {verified && <VerifiedCard ai={ai} />}
                    {rejected && (
                      <div className="rounded-lg border border-red-200 bg-[#FEF2F2] p-3">
                        <p className="flex items-start gap-2 text-[12px] font-semibold leading-snug text-[#991B1B]">
                          <CircleX className="mt-px h-4 w-4 shrink-0" />
                          {ai.message}
                        </p>
                        {ai.reason && <p className="mt-1.5 pl-6 text-[11px] leading-snug text-[#991B1B]/80">What the AI saw: {ai.reason}</p>}
                        <button onClick={clearPhoto} className="ml-6 mt-2 text-[11px] font-semibold text-[#991B1B] underline underline-offset-2">
                          Try a different photo
                        </button>
                      </div>
                    )}
                    {ai.status === 'unavailable' && (
                      <div className="rounded-lg border border-hairline bg-canvas p-3">
                        <p className="flex items-start gap-2 text-[12px] font-medium leading-snug text-ink">
                          <WifiOff className="mt-px h-4 w-4 shrink-0 text-muted" />
                          {ai.message}
                        </p>
                        <p className="mt-1 pl-6 text-[11px] text-muted">This photo was not analysed. The report will be marked unverified.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <div className="shrink-0 border-t border-hairline px-4 pb-3 pt-3">
          <button
            disabled={!canSubmit}
            onClick={() => onSubmit({ depth: finalDepth, ai: verified ? ai : null, photo: photo?.url ?? null })}
            className="w-full rounded-xl bg-ink py-3 text-[14px] font-semibold text-white transition enabled:hover:bg-slate-800 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            {submitLabel}
          </button>
          {!rejected && !canSubmit && scan !== 'scanning' && (
            <p className="mt-1.5 text-center text-[11px] text-slate-400">
              {!location ? 'Choose a location to continue' : 'Select a depth or add a photo'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function VerifiedCard({ ai }) {
  const depth = DEPTHS[ai.depth]
  const up = ai.correction?.direction === 'up'
  return (
    <div className="overflow-hidden rounded-lg border border-hairline">
      {/* Did the AI agree with the citizen? */}
      {ai.correction ? (
        <p
          className={`flex items-start gap-2 border-b px-3 py-2.5 text-[12px] font-medium leading-snug ${
            up ? 'border-amber-200 bg-[#FFFBEB] text-[#92400E]' : 'border-slate-200 bg-canvas text-ink'
          }`}
        >
          {up ? <TriangleAlert className="mt-px h-4 w-4 shrink-0" /> : <ArrowDown className="mt-px h-4 w-4 shrink-0 text-muted" />}
          {ai.correction.message}
        </p>
      ) : (
        <p className="flex items-center gap-2 border-b border-hairline bg-canvas px-3 py-2 text-[12px] font-medium text-ink">
          <BadgeCheck className="h-4 w-4 text-clear" />
          {ai.agreement === 'confirmed' ? `AI confirms your ${depth.label} estimate.` : `AI estimate: ${depth.label}.`}
        </p>
      )}

      <dl className="divide-y divide-hairline text-[12px]">
        <Row term="AI Depth Estimate">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: depth.color }} />
            {depth.label} (~{ai.depthCm}cm)
            {ai.correction && (up ? <ArrowUp className="h-3 w-3 text-danger" /> : <ArrowDown className="h-3 w-3 text-clear" />)}
          </span>
        </Row>
        <Row term="Drainage Status">
          {ai.drainage.status} ({Math.round(ai.drainage.confidence * 100)}% Confidence)
        </Row>
        <Row term="Risk Level">{ai.risk.label}</Row>
      </dl>

      {/* Visual reference breakdown: what the estimate is based on */}
      <div className="border-t border-hairline bg-canvas px-3 py-2.5">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">Visual reference breakdown</p>
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <p className="text-muted">Reference Object</p>
            <p className="font-semibold leading-tight text-ink">{ai.reference.object}</p>
          </div>
          <div>
            <p className="text-muted">Submersion</p>
            <p className="font-semibold tabular-nums text-ink">~{ai.reference.submersionPct}%</p>
            <span className="mt-1 block h-1 overflow-hidden rounded-full bg-slate-200">
              <span className="block h-full rounded-full" style={{ width: `${ai.reference.submersionPct}%`, background: depth.color }} />
            </span>
          </div>
          <div>
            <p className="text-muted">Debris Detected</p>
            <p className="font-semibold text-ink">{ai.reference.debris ? 'Yes' : 'No'}</p>
          </div>
        </div>
        <p className="mt-2 text-[9px] text-slate-400">Source: {ai.source}</p>
      </div>
    </div>
  )
}

function Row({ term, children }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2">
      <dt className="shrink-0 text-muted">{term}</dt>
      <dd className="text-right font-semibold leading-snug text-ink">{children}</dd>
    </div>
  )
}

function Label({ children }) {
  return <p className="mb-1.5 flex items-center text-[11px] font-semibold uppercase tracking-wide text-muted">{children}</p>
}

function Choice({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-lg border py-2.5 text-[12px] font-semibold transition ${
        active ? 'border-ink bg-ink text-white' : 'border-hairline bg-white text-ink hover:border-slate-400'
      }`}
    >
      {children}
    </button>
  )
}

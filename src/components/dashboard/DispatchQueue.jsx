import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'

// Status pills carry live priority only: soft background, dark text.
function priority(score) {
  if (score >= 85) return { label: 'Urgent Dispatch', style: { background: '#FEF2F2', color: '#991B1B' } }
  if (score >= 70) return { label: 'High Risk', style: { background: '#FFFBEB', color: '#92400E' } }
  return { label: 'Scheduled', style: { background: '#F1F5F9', color: '#334155' } }
}

const DISPATCH_MS = 1100

/** Work tickets for Sangkat / public-works crews, sorted by AI urgency score. */
export default function DispatchQueue({ queue, onDispatch, onFocus, focusId }) {
  const [sending, setSending] = useState([]) // ticket ids being dispatched
  const sorted = [...queue].sort((a, b) => b.urgency - a.urgency)
  const open = sorted.filter((q) => q.status !== 'dispatched')
  const primaryId = open[0]?.id // only the most urgent open ticket gets the primary button

  function dispatch(id) {
    setSending((list) => [...list, id])
    window.setTimeout(() => {
      onDispatch(id)
      setSending((list) => list.filter((x) => x !== id))
    }, DISPATCH_MS)
  }

  return (
    <section className="flex max-h-[32rem] flex-col rounded-xl border border-hairline bg-white shadow-sm lg:h-full lg:max-h-none lg:min-h-0">
      <header className="flex shrink-0 items-baseline justify-between gap-3 border-b border-hairline px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">AI Dispatch &amp; Maintenance Queue: Phnom Penh Storm Drains</h2>
        <span className="shrink-0 text-xs text-muted">
          {open.length} open · {sorted.length - open.length} dispatched
        </span>
      </header>

      <ul className="thin-scroll min-h-0 flex-1 divide-y divide-hairline overflow-y-auto">
        {sorted.map((item) => {
          const pill = priority(item.urgency)
          const dispatched = item.status === 'dispatched'
          const busy = sending.includes(item.id)
          const selected = focusId === item.id
          return (
            <li
              key={item.id}
              onClick={() => onFocus(item)}
              className={`cursor-pointer border-l-2 px-4 py-3 transition-colors duration-200 hover:bg-canvas ${
                selected ? 'border-accent bg-canvas' : 'border-transparent'
              } ${item.isNew ? 'animate-fade-in' : ''}`}
            >
              <div className="flex items-start gap-3">
                <p className="w-8 shrink-0 text-xl font-semibold text-ink" title="AI urgency score (0–100)">
                  {item.urgency}
                </p>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-compact font-semibold text-ink">{item.name}</h3>
                    <span className="rounded px-2 py-0.5 text-2xs font-semibold" style={pill.style}>
                      {pill.label}
                    </span>
                    {item.isNew && <span className="rounded border border-hairline px-2 py-0.5 text-2xs font-semibold text-ink">New report</span>}
                  </div>
                  <p className="text-xs text-muted">
                    Khan {item.khan} · Sangkat {item.sangkat}
                  </p>
                  <p className="text-xs text-ink">
                    <span className="text-muted">AI diagnosis: </span>
                    {item.diagnosis}
                  </p>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-xs text-muted">
                      Flood frequency: <span className="font-semibold text-ink">{item.frequency}x this month</span>
                    </span>
                    {dispatched ? (
                      <span className="flex animate-fade-in items-center gap-1 rounded-md px-2 py-1 text-2xs font-semibold" style={{ background: '#ECFDF5', color: '#065F46' }}>
                        <Check className="h-4 w-4" /> Crew Dispatched
                      </span>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation()
                          dispatch(item.id)
                        }}
                        className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-2xs font-semibold transition active:scale-95 disabled:cursor-wait ${
                          item.id === primaryId
                            ? 'bg-accent text-white hover:bg-sky-700'
                            : 'border border-hairline bg-white text-ink hover:border-slate-400'
                        }`}
                      >
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                        {busy ? 'Contacting crew...' : 'Dispatch Pump / Cleanup Crew'}
                      </button>
                    )}
                  </div>
                  {dispatched && <p className="text-right text-2xs text-muted">{item.crew} en route</p>}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

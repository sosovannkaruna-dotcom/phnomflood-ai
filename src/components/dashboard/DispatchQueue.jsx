import { Check } from 'lucide-react'

// Restrained status pills: soft background, dark text.
function priority(score) {
  if (score >= 85) return { label: 'Urgent Dispatch', style: { background: '#FEF2F2', color: '#991B1B' } }
  if (score >= 70) return { label: 'High Priority', style: { background: '#FFFBEB', color: '#92400E' } }
  return { label: 'Scheduled', style: { background: '#F1F5F9', color: '#475569' } }
}

/** Work queue for Sangkat / public-works crews, sorted by AI urgency score. */
export default function DispatchQueue({ queue, onDispatch, onFocus, focusId }) {
  const sorted = [...queue].sort((a, b) => b.urgency - a.urgency)
  const open = sorted.filter((q) => q.status !== 'dispatched').length

  return (
    <section className="flex h-full min-h-0 flex-col rounded-xl border border-hairline bg-white">
      <header className="flex shrink-0 items-baseline justify-between border-b border-hairline px-4 py-3">
        <div>
          <h2 className="text-[14px] font-semibold text-ink">AI Dispatch &amp; Maintenance Queue</h2>
          <p className="text-[12px] text-muted">Sangkat &amp; municipal public works · sorted by AI urgency score</p>
        </div>
        <span className="text-[12px] tabular-nums text-muted">
          {open} open · {sorted.length - open} dispatched
        </span>
      </header>

      <ul className="thin-scroll min-h-0 flex-1 divide-y divide-hairline overflow-y-auto">
        {sorted.map((item) => {
          const pill = priority(item.urgency)
          const dispatched = item.status === 'dispatched'
          return (
            <li
              key={item.id}
              onClick={() => onFocus(item)}
              className={`cursor-pointer px-4 py-3 transition hover:bg-canvas ${focusId === item.id ? 'bg-canvas' : ''} ${
                item.isNew ? 'animate-fade-in' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 shrink-0 text-center">
                  <p className="text-[20px] font-semibold leading-none tabular-nums text-ink">{item.urgency}</p>
                  <p className="mt-1 text-[9px] font-medium uppercase tracking-wide text-slate-400">Urgency</p>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="text-[13px] font-semibold text-ink">{item.name}</h3>
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={pill.style}>
                      {pill.label}
                    </span>
                    {item.isNew && (
                      <span className="rounded border border-hairline px-1.5 py-0.5 text-[10px] font-semibold text-ink">New · citizen report</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12px] text-muted">
                    Khan {item.khan} · Sangkat {item.sangkat}
                  </p>
                  <p className="mt-1.5 text-[12px] leading-snug text-ink">
                    <span className="text-muted">AI diagnosis: </span>
                    {item.diagnosis}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <span className="text-[12px] text-muted">
                      Flood frequency: <span className="font-semibold tabular-nums text-ink">{item.frequency}x this month</span>
                    </span>
                    {dispatched ? (
                      <span
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold"
                        style={{ background: '#ECFDF5', color: '#065F46' }}
                      >
                        <Check className="h-3.5 w-3.5" /> Crew Dispatched
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDispatch(item.id)
                        }}
                        className="rounded-md bg-ink px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98]"
                      >
                        Dispatch Pump / Cleanup Crew
                      </button>
                    )}
                  </div>
                  {dispatched && <p className="mt-1 text-right text-[11px] text-muted">{item.crew} en route</p>}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

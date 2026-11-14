import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { CornerDownLeft } from 'lucide-react'
import { answer, quickQueries } from '../data/analyst'
import { khanById } from '../data/hydrology'
import type { AnalystContext, Block, Part } from '../types'

interface Message {
  id: number
  query?: string
  blocks?: Block[]
  pending?: boolean
}

const STEPS = ['Reading gauge telemetry...', 'Checking drainage load...', 'Compiling briefing...']

function Parts({ parts, onKhan }: { parts: Part[]; onKhan: (id: string) => void }) {
  return (
    <>
      {parts.map((part, i) =>
        typeof part === 'string' ? (
          <span key={i}>{part}</span>
        ) : (
          <button
            key={i}
            onClick={() => onKhan(part.khan)}
            title="Show on map"
            className="rounded-sm border border-sky-500/40 px-1 font-mono text-[11px] text-sky-400 transition-colors hover:bg-sky-500/10 focus-visible:outline focus-visible:outline-1 focus-visible:outline-sky-500"
          >
            {khanById(part.khan)?.name ?? part.khan}
          </button>
        ),
      )}
    </>
  )
}

function Briefing({ blocks, onKhan }: { blocks: Block[]; onKhan: (id: string) => void }) {
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.14, duration: 0.24 }}>
          {block.type === 'p' && (
            <p className="text-xs leading-relaxed text-zinc-100">
              <Parts parts={block.parts} onKhan={onKhan} />
            </p>
          )}
          {block.type === 'list' && (
            <ul className="space-y-1.5">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-2 text-xs leading-relaxed text-zinc-300">
                  <span className="mt-2 h-px w-2 shrink-0 bg-zinc-500" />
                  <span>
                    <Parts parts={item} onKhan={onKhan} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          {block.type === 'table' && (
            <table className="w-full border-collapse border border-white/[0.08] text-left text-[11px]">
              <thead>
                <tr>
                  {block.head.map((h) => (
                    <th key={h} className="border-b border-white/[0.08] px-2 py-1.5 font-medium uppercase tracking-wider text-zinc-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={r} className="border-b border-white/[0.06] last:border-0">
                    {row.map((cell, c) => (
                      <td key={c} className={`px-2 py-1.5 ${c === 0 ? 'text-zinc-100' : 'font-mono text-zinc-300'}`}>
                        <Parts parts={[cell]} onKhan={onKhan} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </motion.div>
      ))}
    </div>
  )
}

interface Props {
  context: AnalystContext
  onKhan: (id: string) => void
}

export default function Analyst({ context, onKhan }: Props) {
  const [messages, setMessages] = useState<Message[]>(() => [{ id: 0, blocks: answer('', context) }])
  const [draft, setDraft] = useState('')
  const [step, setStep] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const stream = useRef<HTMLDivElement>(null)
  const nextId = useRef(1)
  const ctx = useRef(context)
  ctx.current = context
  const busy = messages.some((m) => m.pending)

  // ⌘K / Ctrl+K focuses the prompt
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    stream.current?.scrollTo({ top: stream.current.scrollHeight, behavior: 'smooth' })
  }, [messages, step])

  function ask(query: string) {
    const text = query.trim()
    if (!text || busy) return
    const id = nextId.current++
    setDraft('')
    setStep(0)
    setMessages((list) => [...list, { id, query: text, pending: true }])
    const ticker = window.setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 380)
    window.setTimeout(() => {
      window.clearInterval(ticker)
      setMessages((list) => list.map((m) => (m.id === id ? { ...m, pending: false, blocks: answer(text, ctx.current) } : m)))
    }, 1200)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-white/[0.08] px-4 py-3">
        <p className="text-sm font-semibold text-zinc-100">Hydrological Analysis Assistant</p>
        <p className="mt-1 font-mono text-[11px] text-zinc-400">GFS + Local Gauge Telemetry · scripted demo</p>
      </div>

      <div ref={stream} className="cc-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <div key={m.id} className="space-y-3">
            {m.query && (
              <p className="border-l border-sky-500 pl-3 text-xs font-medium text-zinc-100">{m.query}</p>
            )}
            {m.pending && (
              <div className="space-y-2" aria-live="polite">
                <p className="font-mono text-[11px] text-zinc-400">{STEPS[step]}</p>
                <div className="cc-shimmer h-3 w-11/12 rounded-sm" />
                <div className="cc-shimmer h-3 w-full rounded-sm" />
                <div className="cc-shimmer h-3 w-2/3 rounded-sm" />
              </div>
            )}
            {m.blocks && <Briefing blocks={m.blocks} onKhan={onKhan} />}
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-white/[0.08] p-3">
        <div className="flex flex-wrap gap-1.5">
          {quickQueries(context).map((q) => (
            <button
              key={q}
              onClick={() => ask(q)}
              disabled={busy}
              className="cc-btn rounded border border-white/[0.08] px-2 py-1 text-left text-[11px] text-zinc-300 disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            ask(draft)
          }}
          className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-black/20 px-3 focus-within:border-sky-500/60"
        >
          <input
            ref={input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about a Khan, pumps or the forecast"
            aria-label="Ask the analyst"
            className="h-9 min-w-0 flex-1 bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
          {draft ? (
            <button type="submit" aria-label="Send" className="text-sky-400">
              <CornerDownLeft className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="rounded-sm border border-white/[0.08] px-1.5 font-mono text-[10px] text-zinc-400">⌘K</kbd>
          )}
        </form>
      </div>
    </div>
  )
}

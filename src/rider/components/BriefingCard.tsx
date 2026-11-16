import { Sparkle } from '@phosphor-icons/react'
import { useT } from '../../i18n'
import { minutesSince, type BriefingState } from '../../services/briefing'

interface Props {
  state: BriefingState
  /** compact: the headline only, as a button that opens the full card */
  compact?: boolean
  onOpen?: () => void
}

/** The AI city flood briefing in the live app. */
export default function BriefingCard({ state, compact = false, onOpen }: Props) {
  const { t } = useT()
  if (state.status === 'error') return compact ? null : <p className="text-xs text-zinc-500">{t('brief.error')}</p>
  if (state.status === 'loading') return <div className={`cc-shimmer ${compact ? 'h-10' : 'h-24'}`} />
  const b = state.briefing
  const mark = b.ai ? <Sparkle weight="fill" className="h-3.5 w-3.5 shrink-0 text-dusk" aria-label={t('brief.aiLabel')} /> : null

  if (compact) {
    return (
      <button onClick={onOpen} className="rd-press flex min-h-10 w-full items-center gap-2 border border-white/[0.12] bg-dusk-deep px-3 py-2 text-left">
        {mark}
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">{b.headline}</span>
        <span className="tl-label shrink-0 text-dusk">{t('brief.more')}</span>
      </button>
    )
  }

  const ago = minutesSince(b.generatedAt)
  return (
    <section aria-label={t('brief.title')} className="border border-white/[0.12] bg-dusk-deep p-3">
      <h3 className="tl-label flex items-center gap-1.5 text-dusk">
        {mark} {t('brief.title')}
      </h3>
      <p className="mt-2 text-base font-semibold leading-snug text-zinc-50">{b.headline}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-300">{b.summary}</p>
      {b.areas.length > 0 && (
        <ul className="mt-3 divide-y divide-white/10 border-y border-white/10">
          {b.areas.map((a) => (
            <li key={a.name} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
              <span className="shrink-0 font-medium text-zinc-100">{a.name}</span>
              <span className="truncate text-right text-xs text-zinc-400">{a.note}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-sm text-zinc-100">{b.advice}</p>
      <p className="mt-2 text-[11px] leading-snug text-zinc-500">
        {b.ai ? t('brief.byAi', { n: b.basedOn.reports }) : t('brief.noAi')} · {ago < 1 ? t('ago.now') : t('ago.min', { n: ago })}
      </p>
    </section>
  )
}

import { BadgeCheck, BatteryFull, MoreHorizontal, Signal, Wifi } from 'lucide-react'

/** Phone body with a Telegram Mini App header. Children fill the screen area. */
export default function PhoneFrame({ children }) {
  return (
    <div
      className="relative flex shrink-0 flex-col overflow-hidden rounded-[40px] border-[9px] border-ink bg-white shadow-device"
      style={{ width: 'min(392px, calc(100vw - 24px))', height: 'min(844px, calc(100vh - 96px))' }}
    >
      {/* Status bar */}
      <div className="relative flex h-7 shrink-0 items-center justify-between bg-white px-6 text-[12px] font-semibold text-ink">
        <span className="tabular-nums">9:41</span>
        <span className="absolute left-1/2 top-1 h-5 w-24 -translate-x-1/2 rounded-full bg-ink" />
        <span className="flex items-center gap-1">
          <Signal className="h-3.5 w-3.5" />
          <Wifi className="h-3.5 w-3.5" />
          <BatteryFull className="h-4 w-4" />
        </span>
      </div>

      {/* Telegram Mini App header */}
      <div className="grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-hairline bg-white px-4">
        <button className="justify-self-start text-[15px] text-tg">Close</button>
        <div className="text-center leading-none">
          <div className="flex items-center justify-center gap-1 text-[15px] font-semibold text-ink">
            PhnomFlood
            <BadgeCheck className="h-4 w-4 fill-tg text-white" />
          </div>
          <div className="mt-0.5 text-[11px] text-muted">mini app</div>
        </div>
        <button aria-label="Menu" className="justify-self-end text-tg">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>

      {/* Home indicator */}
      <div className="flex h-5 shrink-0 items-center justify-center bg-white">
        <span className="h-1 w-28 rounded-full bg-ink" />
      </div>
    </div>
  )
}

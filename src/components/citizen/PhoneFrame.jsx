import { BadgeCheck, BatteryFull, MoreHorizontal, Signal, Wifi } from 'lucide-react'

/** Phone body with a Telegram Mini App header. Children fill the screen area. */
export default function PhoneFrame({ children }) {
  return (
    // On phones the frame becomes the full screen; on larger screens it shows as a device.
    <div className="relative flex h-full w-full shrink-0 flex-col overflow-hidden bg-white sm:h-[min(844px,calc(100vh-88px))] sm:w-[min(392px,calc(100vw-24px))] sm:rounded-[40px] sm:border-8 sm:border-ink sm:shadow-device">
      {/* Fake status bar: only in the device frame; a real phone shows its own */}
      <div className="relative hidden h-7 shrink-0 items-center justify-between bg-white px-6 text-xs font-semibold text-ink sm:flex">
        <span>9:41</span>
        <span className="absolute left-1/2 top-1 h-5 w-24 -translate-x-1/2 rounded-full bg-ink" />
        <span className="flex items-center gap-1">
          <Signal className="h-4 w-4" />
          <Wifi className="h-4 w-4" />
          <BatteryFull className="h-4 w-4" />
        </span>
      </div>

      {/* Telegram Mini App header */}
      <div className="grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-hairline bg-white px-4">
        <button className="justify-self-start text-sm text-accent">Close</button>
        <div className="flex items-center gap-1 text-sm font-semibold text-ink">
          PhnomFlood
          <BadgeCheck className="h-4 w-4 fill-accent text-white" aria-label="Verified" />
        </div>
        <button aria-label="Menu" className="justify-self-end text-accent">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>

      {/* Home indicator */}
      <div className="hidden h-5 shrink-0 items-center justify-center bg-white sm:flex">
        <span className="h-1 w-28 rounded-full bg-ink" />
      </div>
    </div>
  )
}

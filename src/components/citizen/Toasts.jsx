import { CircleCheck, TriangleAlert } from 'lucide-react'

const ICON = {
  warning: <TriangleAlert className="mt-px h-4 w-4 shrink-0 text-caution" />,
  success: <CircleCheck className="mt-px h-4 w-4 shrink-0 text-clear" />,
}

/** Stack of toast alerts at the top of the phone screen. */
export default function Toasts({ toasts }) {
  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-40 flex flex-col gap-1.5" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex animate-slide-down items-start gap-2 rounded-xl border border-hairline bg-white px-3 py-2.5 text-[12px] font-medium leading-snug text-ink shadow-float"
        >
          {ICON[toast.kind] ?? ICON.success}
          <span>{toast.text}</span>
        </div>
      ))}
    </div>
  )
}

import { CircleCheck, TriangleAlert } from 'lucide-react'

const ICON = {
  warning: <TriangleAlert className="h-4 w-4 shrink-0 text-[#B45309]" />,
  success: <CircleCheck className="h-4 w-4 shrink-0 text-[#047857]" />,
}

/** Toast alerts that spring in from the top of the phone screen. */
export default function Toasts({ toasts }) {
  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-40 flex flex-col gap-2" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex animate-toast items-start gap-2 rounded-xl border border-hairline bg-white px-3 py-2 text-xs font-medium text-ink shadow-sm"
        >
          {ICON[toast.kind] ?? ICON.success}
          <span>{toast.text}</span>
        </div>
      ))}
    </div>
  )
}

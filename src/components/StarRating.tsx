import { useState } from 'react'

// ── Interactive star picker ────────────────────────────────────────────────
export function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  const active = hover || value
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="text-3xl leading-none transition-transform hover:scale-110 focus:outline-none"
        >
          <span className={active >= star ? 'text-yellow-400' : 'text-gray-300'}>★</span>
        </button>
      ))}
    </div>
  )
}

// ── Static star display ────────────────────────────────────────────────────
export function StarDisplay({
  avg,
  count,
  size = 'md',
}: {
  avg: number
  count: number
  size?: 'sm' | 'md'
}) {
  const full = Math.round(avg)
  const textSize = size === 'sm' ? 'text-sm' : 'text-base'
  return (
    <span className={`flex items-center gap-0.5 ${textSize}`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={s <= full ? 'text-yellow-400' : 'text-gray-300'}>★</span>
      ))}
      <span className="text-xs text-gray-500 ml-1">
        {avg.toFixed(1)} ({count} reseña{count !== 1 ? 's' : ''})
      </span>
    </span>
  )
}

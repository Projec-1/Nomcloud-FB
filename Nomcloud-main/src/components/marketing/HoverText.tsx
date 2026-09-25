// Renders text word-by-word so each word can pick up its own accent color on hover —
// a small, tasteful "premium" touch for hero headlines instead of the whole line
// changing color at once.
const PALETTE = ['#FF5A1F', '#0071E3', '#22C55E', '#A855F7', '#F59E0B', '#EC4899', '#14B8A6']

export default function HoverText({ text, className = '' }: { text: string; className?: string }) {
  const words = text.split(' ')
  return (
    <span className={className}>
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          className="inline-block transition-all duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.04]"
          style={{ color: 'inherit' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = PALETTE[i % PALETTE.length]
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'inherit'
          }}
        >
          {word}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  )
}

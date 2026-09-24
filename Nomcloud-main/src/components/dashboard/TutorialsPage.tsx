import { useState } from 'react'
import { PlayCircle, Clock, X } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'

export interface TutorialVideo {
  title: string
  description: string
  duration: string
  tint: string
  /** Optional embeddable video URL — leave unset to show a "coming soon" placeholder. */
  videoUrl?: string
}

export default function TutorialsPage({ title, description, videos }: { title: string; description: string; videos: TutorialVideo[] }) {
  const [playing, setPlaying] = useState<TutorialVideo | null>(null)

  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((v) => (
          <button
            key={v.title}
            onClick={() => setPlaying(v)}
            className="group card overflow-hidden p-0 text-left transition-transform duration-300 hover:-translate-y-1"
          >
            <div className="relative flex h-36 items-center justify-center overflow-hidden" style={{ background: `linear-gradient(135deg, ${v.tint}, #1D1D1F)` }}>
              <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '14px 14px' }} />
              <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition-transform duration-300 group-hover:scale-110">
                <PlayCircle className="h-7 w-7" />
              </span>
              <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-medium text-white">
                <Clock className="h-3 w-3" /> {v.duration}
              </span>
            </div>
            <div className="p-5">
              <h3 className="text-sm font-semibold text-ink dark:text-white">{v.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-graphite">{v.description}</p>
            </div>
          </button>
        ))}
      </div>

      <Modal open={!!playing} onClose={() => setPlaying(null)} title={playing?.title} size="lg">
        {playing?.videoUrl ? (
          <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
            <video src={playing.videoUrl} controls className="h-full w-full" />
          </div>
        ) : (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl bg-mist text-center dark:bg-white/5">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink/5 text-graphite dark:bg-white/10">
              <X className="h-5 w-5" />
            </span>
            <p className="max-w-xs text-sm text-graphite">This tutorial video hasn't been uploaded yet — check back soon.</p>
          </div>
        )}
        {playing && <p className="mt-4 text-sm text-graphite">{playing.description}</p>}
      </Modal>
    </div>
  )
}

import { Link } from 'react-router-dom'

export default function PlatformPlaceholder() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <h1 className="text-2xl font-semibold">Platform workspace</h1>
      <p className="mt-2 max-w-md text-sm text-slate-400">
        Platform administration tools will be available here.
      </p>
      <Link
        to="/platform/applications"
        className="mt-6 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand/90"
      >
        School applications
      </Link>
    </div>
  )
}

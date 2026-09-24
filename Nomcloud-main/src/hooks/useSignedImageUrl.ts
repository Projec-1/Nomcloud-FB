import { useEffect, useState } from 'react'
import { createSignedImageUrl, SIGNED_URL_SECONDS, type PrivateBucket } from '@/services/storageService'

/**
 * A signed URL for a private image, refreshed shortly before it expires.
 *
 * Null while loading, when there is no path, or when Storage refuses the read —
 * callers fall back to the initials badge in all three cases, so a refusal never
 * shows a broken image.
 */
export function useSignedImageUrl(bucket: PrivateBucket, path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    setUrl(null)
    if (!path) return

    let cancelled = false
    let timer: number | undefined

    const load = async () => {
      const signed = await createSignedImageUrl(bucket, path)
      if (cancelled) return
      setUrl(signed)
      // Renew a minute before expiry so a long-open page keeps its images.
      if (signed) timer = window.setTimeout(load, (SIGNED_URL_SECONDS - 60) * 1000)
    }
    void load()

    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [bucket, path])

  return url
}

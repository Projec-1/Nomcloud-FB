// ---------------------------------------------------------------------------
// Client-side image checks and re-encoding for the three Storage uploads.
// File storage build, docs/FILE_STORAGE_PLAN.md section 4.
//
// The buckets enforce the same size and type limits on the server, so nothing
// here is a security boundary. This module exists so a user learns about a bad
// file before an upload, and so that what reaches Storage is always an image the
// browser itself produced: decoding into a canvas and re-encoding strips
// anything a file carried besides pixels (metadata, trailing payloads).
//
// No dependency. createImageBitmap, <canvas> and canvas.toBlob are built into
// every browser the app supports.
//
// validateImageFile is deliberately free of DOM and '@/' imports so it can be
// exercised outside the browser.
// ---------------------------------------------------------------------------

export type ImageKind = 'logo' | 'studentPhoto' | 'avatar'

interface ImageRule {
  label: string
  maxBytes: number
  /** Longest edge after resizing, in pixels. */
  maxEdge: number
  /** Output type; transparency matters for a logo, not for a photo. */
  output: 'image/png' | 'image/jpeg'
}

export const IMAGE_RULES: Record<ImageKind, ImageRule> = {
  logo: { label: 'Logo', maxBytes: 1024 * 1024, maxEdge: 256, output: 'image/png' },
  studentPhoto: { label: 'Photo', maxBytes: 2 * 1024 * 1024, maxEdge: 512, output: 'image/jpeg' },
  avatar: { label: 'Profile picture', maxBytes: 1024 * 1024, maxEdge: 256, output: 'image/jpeg' },
}

/** The only types accepted, matching the buckets' allowed_mime_types. No SVG. */
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

export const IMAGE_ACCEPT = ALLOWED_IMAGE_TYPES.join(',')

const EXTENSION: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB` : `${Math.ceil(bytes / 1024)} KB`
}

/** Returns an error message, or null when the file may be uploaded. */
export function validateImageFile(file: { type: string; size: number }, kind: ImageKind): string | null {
  const rule = IMAGE_RULES[kind]
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return `${rule.label} must be a PNG, JPEG or WebP image.`
  }
  if (file.size === 0) return `${rule.label} file is empty.`
  if (file.size > rule.maxBytes) {
    return `${rule.label} must be ${formatBytes(rule.maxBytes)} or smaller (this file is ${formatBytes(file.size)}).`
  }
  return null
}

/** A fresh random object name: `<uuid>.<ext>`. Never derived from an id or the original file name. */
export function randomImageName(contentType: string): string {
  const extension = EXTENSION[contentType]
  if (!extension) throw new Error(`Unsupported image type: ${contentType}`)
  return `${crypto.randomUUID()}.${extension}`
}

export interface PreparedImage {
  blob: Blob
  contentType: string
}

/**
 * Validates, decodes, downsizes and re-encodes an image. Throws with a message
 * suitable for a toast when the file is rejected or cannot be read as an image.
 */
export async function prepareImage(file: File, kind: ImageKind): Promise<PreparedImage> {
  const problem = validateImageFile(file, kind)
  if (problem) throw new Error(problem)

  const rule = IMAGE_RULES[kind]
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error(`${rule.label} could not be read as an image.`)
  }

  const scale = Math.min(1, rule.maxEdge / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser cannot process images.')
  if (rule.output === 'image/jpeg') {
    // JPEG has no alpha; paint white rather than letting transparency turn black.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
  }
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, rule.output, 0.85))
  if (!blob) throw new Error(`${rule.label} could not be processed.`)

  // Re-check what will actually be sent against the bucket's own limits.
  const encoded = validateImageFile({ type: blob.type, size: blob.size }, kind)
  if (encoded) throw new Error(encoded)

  return { blob, contentType: blob.type }
}

let counter = Math.floor(Math.random() * 100000)

export function makeId(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}`
}

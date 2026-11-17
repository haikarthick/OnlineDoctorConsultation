/**
 * The farm outbox (farm plan Phase 6): entries a farmer saved while they had no signal wait on the phone and
 * are sent when the connection is back - nothing typed in the shed is ever lost.
 *
 * Rules that keep it safe:
 *   - Each entry carries a random id that is also its Idempotency-Key, so an entry whose first attempt DID
 *     reach the server (only the answer was lost) is not counted twice when it is sent again (server migration 049).
 *   - Only a failure to REACH the server keeps an entry waiting. If the server answered and refused it
 *     (an animal that was sold, a number that is not allowed) the entry stays visible with the server's
 *     reason and is NOT retried by itself - the farmer decides.
 *   - Entries are stored per signed-in person, so a shared phone never shows or sends someone else's.
 *   - Sent one at a time, oldest first, so a death recorded before a sale is applied before it.
 */
export interface OutboxItem {
  id: string
  kind: 'record' | 'event'
  payload: Record<string, unknown>
  /** What the farmer sees: "Lakshmi - Milk". */
  label: string
  createdAt: string
  /** Set when the server answered and refused: the reason, in words. */
  error?: string
}

export type SendResult = { ok: true } | { ok: false; reached: boolean; reason: string }
export type Sender = (item: OutboxItem) => Promise<SendResult>

const keyFor = (userId: string) => `farmOutbox:v1:${userId}`
const listeners = new Set<() => void>()
let cache: { userId: string; items: OutboxItem[] } | null = null

function read(userId: string): OutboxItem[] {
  try {
    const raw = localStorage.getItem(keyFor(userId))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(i => i && typeof i.id === 'string' && i.payload) : []
  } catch { return [] }
}

function write(userId: string, items: OutboxItem[]): void {
  cache = { userId, items }
  try { localStorage.setItem(keyFor(userId), JSON.stringify(items)) } catch { /* storage full or blocked: the in-memory copy still works this session */ }
  listeners.forEach(l => l())
}

export function getOutbox(userId: string): OutboxItem[] {
  if (!cache || cache.userId !== userId) cache = { userId, items: read(userId) }
  return cache.items
}

export function subscribeOutbox(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function newOutboxId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export function enqueue(userId: string, entry: Omit<OutboxItem, 'id' | 'createdAt'>): OutboxItem {
  const item: OutboxItem = { ...entry, id: newOutboxId(), createdAt: new Date().toISOString() }
  write(userId, [...getOutbox(userId), item])
  return item
}

export function discard(userId: string, id: string): void {
  write(userId, getOutbox(userId).filter(i => i.id !== id))
}

/** Lets a refused entry be tried again (the farmer chose to). */
export function clearError(userId: string, id: string): void {
  write(userId, getOutbox(userId).map(i => (i.id === id ? { ...i, error: undefined } : i)))
}

let flushing = false

/**
 * Sends what is waiting, oldest first. Stops at the first entry that cannot reach the server (the rest would
 * fail the same way). Returns how many were sent and whether it stopped because there is no connection.
 */
export async function flushOutbox(userId: string, send: Sender): Promise<{ sent: number; offline: boolean }> {
  if (flushing) return { sent: 0, offline: false }
  flushing = true
  let sent = 0
  try {
    for (const item of [...getOutbox(userId)]) {
      if (item.error) continue // refused earlier: waits for the farmer
      const r = await send(item)
      if (r.ok) { discard(userId, item.id); sent++; continue }
      if (!r.reached) return { sent, offline: true }
      write(userId, getOutbox(userId).map(i => (i.id === item.id ? { ...i, error: r.reason } : i)))
    }
    return { sent, offline: false }
  } finally {
    flushing = false
  }
}

/** Test helper: forget the in-memory copy (storage is cleared by the test setup). */
export function resetOutboxCache(): void { cache = null }

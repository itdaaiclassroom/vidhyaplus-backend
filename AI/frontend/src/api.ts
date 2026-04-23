const BASE = (import.meta as any).env?.DEV ? 'http://localhost:8001' : (import.meta as any).env?.VITE_API_URL || ''

export interface Chapter {
  id: string
  title: string
  periods: number
}

export interface SourceMetadata {
  chapter_id?: string
  chapter_title?: string
  page_start?: number
  page_end?: number
}

export interface ChatResponse {
  answer: string
  sources: SourceMetadata[]
  used_chapter_id?: string
  used_period_id?: string
}

export interface YoutubeItem {
  title: string
  url: string
  channel?: string
  duration?: string
}

export interface ResourceItem {
  title: string
  url: string
  source?: string
  snippet?: string
}

export interface ReferenceResponse {
  youtube: YoutubeItem[]
  resources: ResourceItem[]
}

export async function getChapters(): Promise<Chapter[]> {
  const r = await fetch(`${BASE}/api/chapters`)
  if (!r.ok) return []
  return r.json()
}

export async function chat(question: string, chapterId?: string, periodId?: string): Promise<ChatResponse> {
  const r = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, chapter_id: chapterId || null, period_id: periodId || null, mode: 'chat' }),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function getReferences(question: string, chapterId?: string, periodId?: string): Promise<ReferenceResponse> {
  const r = await fetch(`${BASE}/api/references`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, chapter_id: chapterId || null, period_id: periodId || null }),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

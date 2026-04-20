import { useState, useEffect } from 'react'
import { getReferences, type YoutubeItem, type ResourceItem, type Chapter } from './api'
import { SyllabusSelector } from './SyllabusSelector'

interface Props {
  chapters: Chapter[]
  initialQuestion?: string
  initialChapterId?: string
}

export function ReferenceHelper({
  chapters,
  initialQuestion = '',
  initialChapterId,
}: Props) {
  const [query, setQuery] = useState(initialQuestion)
  const [youtube, setYoutube] = useState<YoutubeItem[]>([])
  const [resources, setResources] = useState<ResourceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(initialChapterId ?? null)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)

  // Sync from chatbot when user asks a question there
  useEffect(() => {
    if (initialQuestion) setQuery(initialQuestion)
    if (initialChapterId != null) setSelectedChapterId(initialChapterId)
  }, [initialQuestion, initialChapterId])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q || loading) return
    setError(null)
    setLoading(true)
    try {
      const res = await getReferences(q, selectedChapterId ?? undefined, selectedPeriodId ?? undefined)
      setYoutube(res.youtube)
      setResources(res.resources)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
      setYoutube([])
      setResources([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-accent-50 dark:bg-accent-900/20">
        <h2 className="font-display font-semibold text-lg text-slate-800 dark:text-slate-100">
          Reference Helper
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
          Get 5 YouTube videos and 5 e-resources (articles, notes) for your topic. Links open directly.
        </p>
      </div>
      <div className="p-3 border-b border-slate-200 dark:border-slate-700">
        <SyllabusSelector
          chapters={chapters}
          selectedChapterId={selectedChapterId}
          selectedPeriodId={selectedPeriodId}
          onChapterChange={setSelectedChapterId}
          onPeriodChange={setSelectedPeriodId}
        />
      </div>
      <form onSubmit={handleSearch} className="p-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Topic or question (e.g. HDI, Monsoon, World Wars)"
            className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-accent-500 focus:border-transparent"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="rounded-xl bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white px-5 py-2.5 font-medium transition"
          >
            Search
          </button>
        </div>
      </form>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {youtube.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              YouTube (direct video links)
            </h3>
            <ul className="space-y-2">
              {youtube.map((v, i) => (
                <li key={i}>
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary-400 dark:hover:border-primary-500 transition"
                  >
                    <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400 font-medium text-sm">
                      ▶
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                        {v.title}
                      </p>
                      {v.channel && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">{v.channel}</p>
                      )}
                    </div>
                    <span className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                      Watch
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
        {resources.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              E-resources (articles, notes, publications)
            </h3>
            <ul className="space-y-2">
              {resources.map((r, i) => (
                <li key={i}>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-accent-400 dark:hover:border-accent-500 transition"
                  >
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {r.title}
                    </p>
                    {r.snippet && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {r.snippet}
                      </p>
                    )}
                    <span className="text-xs text-accent-600 dark:text-accent-400 font-medium mt-1 inline-block">
                      Open →
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
        {!loading && youtube.length === 0 && resources.length === 0 && query && !error && (
          <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-4">
            Click Search to get 5 YouTube videos and 5 e-resources for this topic.
          </p>
        )}
        {loading && (
          <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-4">
            Searching…
          </p>
        )}
      </div>
    </div>
  )
}

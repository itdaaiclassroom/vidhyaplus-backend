import type { Chapter } from './api'

interface Props {
  chapters: Chapter[]
  selectedChapterId: string | null
  selectedPeriodId: string | null
  onChapterChange: (id: string | null) => void
  onPeriodChange: (id: string | null) => void
}

export function SyllabusSelector({
  chapters,
  selectedChapterId,
  selectedPeriodId,
  onChapterChange,
  onPeriodChange,
}: Props) {
  const periods = selectedChapterId
    ? Array.from({ length: chapters.find((c) => c.id === selectedChapterId)?.periods ?? 8 }, (_, i) => `P${i + 1}`)
    : []

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Syllabus:</span>
      <select
        value={selectedChapterId ?? ''}
        onChange={(e) => {
          onChapterChange(e.target.value || null)
          onPeriodChange(null)
        }}
        className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500"
      >
        <option value="">All chapters (auto)</option>
        {chapters.map((c) => (
          <option key={c.id} value={c.id}>
            {c.id}. {c.title}
          </option>
        ))}
      </select>
      {periods.length > 0 && (
        <select
          value={selectedPeriodId ?? ''}
          onChange={(e) => onPeriodChange(e.target.value || null)}
          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Any period</option>
          {periods.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

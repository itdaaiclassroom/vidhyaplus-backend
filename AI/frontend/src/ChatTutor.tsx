import { useState, useRef, useEffect } from 'react'
import { chat, type ChatResponse, type SourceMetadata, type Chapter } from './api'
import { SyllabusSelector } from './SyllabusSelector'

interface Message {
  role: 'user' | 'assistant'
  text: string
  sources?: SourceMetadata[]
}

interface Props {
  chapters: Chapter[]
  onQuestionSent?: (question: string, chapterId?: string) => void
}

export function ChatTutor({ chapters, onQuestionSent }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setError(null)
    setMessages((prev) => [...prev, { role: 'user', text: q }])
    setLoading(true)
    onQuestionSent?.(q, selectedChapterId ?? undefined)
    try {
      const res: ChatResponse = await chat(q, selectedChapterId ?? undefined, selectedPeriodId ?? undefined)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: res.answer, sources: res.sources },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Sorry, something went wrong. Is the backend running?' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-primary-50 dark:bg-primary-900/20">
        <h2 className="font-display font-semibold text-lg text-slate-800 dark:text-slate-100">
          AI Chatbot — Textbook Q&A
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
          Ask anything from your Class 10 Social Studies textbook. Answers are based only on the book.
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px]">
        {messages.length === 0 && (
          <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-8">
            Type a question from your textbook (e.g. What is HDI? Where are the Himalayas?)
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                m.role === 'user'
                  ? 'bg-primary-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
              }`}
            >
              <p className="whitespace-pre-wrap text-sm">{m.text}</p>
              {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Sources</p>
                  <div className="flex flex-wrap gap-1">
                    {m.sources.map((s, j) => (
                      <span
                        key={j}
                        className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                        title={`${s.chapter_title ?? ''} Pg ${s.page_start ?? ''}-${s.page_end ?? ''}`}
                      >
                        Ch.{s.chapter_id} {s.chapter_title ?? ''} (Pg {s.page_start ?? ''}
                        {s.page_end != null && s.page_end !== s.page_start ? `–${s.page_end}` : ''})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500">
              Thinking…
            </div>
          </div>
        )}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-200 dark:border-slate-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask from textbook..."
            className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white px-5 py-2.5 font-medium transition"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}

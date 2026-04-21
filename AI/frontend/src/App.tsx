import { useState, useEffect } from 'react'
import { getChapters, type Chapter } from './api'
import { ChatTutor } from './ChatTutor'
import { ReferenceHelper } from './ReferenceHelper'

export default function App() {
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [refQuery, setRefQuery] = useState('')
  const [refChapterId, setRefChapterId] = useState<string | undefined>()

  useEffect(() => {
    getChapters().then(setChapters).catch(() => setChapters([]))
  }, [])

  const handleQuestionSent = (question: string, chapterId?: string) => {
    setRefQuery(question)
    setRefChapterId(chapterId)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="font-display font-bold text-2xl text-slate-800 dark:text-slate-100">
            AI Tutor
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Textbook Q&A + YouTube & e-resource references
          </p>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[70vh]">
          <div className="min-h-[400px] lg:min-h-[600px]">
            <ChatTutor chapters={chapters} onQuestionSent={handleQuestionSent} />
          </div>
          <div className="min-h-[400px] lg:min-h-[600px]">
            <ReferenceHelper
              chapters={chapters}
              initialQuestion={refQuery}
              initialChapterId={refChapterId}
            />
          </div>
        </div>
      </main>
    </div>
  )
}

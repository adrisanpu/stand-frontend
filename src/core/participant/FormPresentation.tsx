import { useId } from 'react'
import type { FormQuestion } from '../formConfig'

export type FormHeaderProps = {
  title?: string
  description: string
  logoUrl?: string | null
  bannerUrl?: string | null
}

export function FormHeader({ title, description, logoUrl, bannerUrl }: FormHeaderProps) {
  return <header className="space-y-3">
    {bannerUrl && <img src={bannerUrl} alt="" className="max-h-44 w-full rounded-xl object-cover" />}
    {logoUrl && <img src={logoUrl} alt="" className="mx-auto max-h-20 max-w-[70%] object-contain" />}
    {title && <h2 className="break-words text-2xl font-semibold">{title}</h2>}
    {description && <p className="whitespace-pre-wrap break-words text-sm">{description}</p>}
  </header>
}

export type QuizFieldsProps = {
  questions: FormQuestion[]
  answers: Record<string, string>
  onChange: (questionId: string, payload: string) => void
  disabled?: boolean
  namePrefix?: string
}

export function QuizFields({ questions, answers, onChange, disabled = false, namePrefix }: QuizFieldsProps) {
  const id = useId()
  return <div className="space-y-5">
    {questions.map(question => <fieldset key={question.id} disabled={disabled} className="space-y-2">
      <legend className="mb-2 font-medium">{question.text}</legend>
      {question.options.map(option => <label key={option.payload}
        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-current/25 p-3">
        <input type="radio" name={`${namePrefix ?? id}-${question.id}`} value={option.payload}
          checked={answers[question.id] === option.payload} required
          onChange={() => onChange(question.id, option.payload)} />
        <span className="break-words">{option.title}</span>
      </label>)}
    </fieldset>)}
  </div>
}

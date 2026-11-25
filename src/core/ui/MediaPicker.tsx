import IconButton, { iconPaths } from './IconButton'

export default function MediaPicker({ selectLabel, uploadLabel, libraryLabel, emptyLabel, value, options, accept, hint, onSelect, onUpload, onOpenLibrary }: {
  selectLabel: string
  uploadLabel: string
  libraryLabel?: string
  emptyLabel: string
  value: string
  options: { value: string; label: string }[]
  accept: string
  hint?: string
  onSelect: (value: string) => void
  onUpload: (file: File) => void
  onOpenLibrary?: () => void
}) {
  return <div className="space-y-1">
    <div className="flex items-center gap-2">
      <select aria-label={selectLabel} title={selectLabel} value={value} onChange={event => onSelect(event.target.value)}
        className="min-h-10 min-w-0 flex-1 rounded-lg border border-current/20 bg-transparent px-2 text-sm">
        <option value="">{emptyLabel}</option>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {libraryLabel && onOpenLibrary && <IconButton icon="library" label={libraryLabel} onClick={onOpenLibrary} />}
      <label title={uploadLabel} className="relative inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-primary/40 bg-primary/20 text-textSub transition-colors hover:bg-primary/30 hover:text-textMain focus-within:outline focus-within:outline-2 focus-within:outline-primary [&:has(input:disabled)]:cursor-not-allowed [&:has(input:disabled)]:opacity-50">
        <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d={iconPaths.upload} />
        </svg>
        <input type="file" accept={accept} aria-label={uploadLabel} className="sr-only"
          onChange={event => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) onUpload(file)
          }} />
      </label>
    </div>
    {hint && <p className="text-xs text-textSub">{hint}</p>}
  </div>
}

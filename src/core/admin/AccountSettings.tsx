import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { BackendUser, User } from '../../auth/useCurrentUser'
import { MAX_PROFILE_PHOTO_SIZE, PROFILE_PHOTO_TYPES, saveAccountProfile, uploadProfilePhoto } from '../../api/accountProfile'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import ProfileAvatar from '../widgets/ProfileAvatar'
import AccountInformation from '../settings/AccountInformation'
import SaveButton from '../ui/SaveButton'

type Props = {
  user: User
  onSaved: (profile: BackendUser) => void
}

export default function AccountSettings({ user, onSaved }: Props) {
  const { t } = useOperatorLanguage()
  const [name, setName] = useState(user.name ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<'photo' | 'save' | null>(null)
  const [saved, setSaved] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const key = file ? await uploadProfilePhoto(file) : removePhoto ? null : user.profilePhotoKey ?? null
      const profile = await saveAccountProfile(name.trim(), key)
      onSaved(profile)
      setName(profile.name ?? '')
      setFile(null)
      setRemovePhoto(false)
      if (fileInput.current) fileInput.current.value = ''
      setSaved(true)
    } catch (error) {
      console.error('Could not save account profile', error)
      setError('save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-6 max-w-3xl space-y-8">
    <form onSubmit={submit} className="space-y-6">
      <fieldset disabled={saving} className="min-w-0 space-y-6">
        <legend className="sr-only">{t('Perfil de cuenta', 'Account profile')}</legend>
        <div className="flex items-center gap-4">
          <ProfileAvatar size="lg" username={name || user.email} profilePicUrl={preview ?? (removePhoto ? null : user.profilePicUrl)} />
          <div className="min-w-0 space-y-2">
            <label htmlFor="account-photo" className="block text-sm font-medium">{t('Foto de perfil', 'Profile photo')}</label>
            <input ref={fileInput} id="account-photo" type="file" accept={PROFILE_PHOTO_TYPES.join(',')}
              aria-describedby="account-photo-help" className="block w-full text-sm"
              onChange={event => {
                const next = event.target.files?.[0]
                if (!next) return
                setSaved(false)
                if (!PROFILE_PHOTO_TYPES.includes(next.type) || !next.size || next.size > MAX_PROFILE_PHOTO_SIZE) {
                  setError('photo')
                  event.target.value = ''
                  return
                }
                setError(null)
                setFile(next)
                setRemovePhoto(false)
              }} />
            <p id="account-photo-help" className="text-xs text-textSub">{t('JPG, PNG o WebP. Máximo 5 MB.', 'JPG, PNG or WebP. Maximum 5 MB.')}</p>
            {(file || (user.profilePhotoKey && !removePhoto)) && (
              <button type="button" className="text-sm underline" onClick={() => {
                setFile(null)
                setRemovePhoto(true)
                setSaved(false)
                setError(null)
                if (fileInput.current) fileInput.current.value = ''
              }}>{t('Quitar foto', 'Remove photo')}</button>
            )}
          </div>
        </div>
        <label className="block space-y-2">
          <span className="text-sm font-medium">{t('Nombre', 'Name')}</span>
          <input required maxLength={100} value={name} onChange={event => { setName(event.target.value); setSaved(false) }}
            className="w-full rounded-xl border border-white/10 bg-white/5 p-3" autoComplete="name" />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium">Email</span>
          <input readOnly value={user.email ?? ''} autoComplete="email"
            className="w-full rounded-xl border border-white/10 bg-white/5 p-3" />
        </label>
      </fieldset>
      {error && <p role="alert" className="text-red-400">{error === 'photo'
        ? t('Elige una imagen JPG, PNG o WebP de hasta 5 MB.', 'Choose a JPG, PNG or WebP image up to 5 MB.')
        : t('No se pudo guardar el perfil. Tus cambios siguen aquí; vuelve a intentarlo.', 'Could not save your profile. Your changes are still here; try again.')}</p>}
      {saved && <p role="status">{t('Cuenta actualizada.', 'Account updated.')}</p>}
      <AccountInformation user={user} showEmail={false} />
      <div className="flex justify-end">
        <SaveButton iconOnly type="submit" disabled={saving || !name.trim()}>
          {saving ? t('Guardando…', 'Saving…') : t('Guardar cambios', 'Save changes')}
        </SaveButton>
      </div>
    </form>
    </div>
  )
}

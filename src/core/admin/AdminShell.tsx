import { useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import IntegrationsSettings from '../settings/IntegrationsSettings'
import { OperatorLanguageProvider, OperatorLanguageSelector, useOperatorLanguage } from '../shell/operatorLanguage'
import { ThemeProvider, useStandLogo } from '../theme'
import AdminGames from './AdminGames'
import ClientsAdmin from './ClientsAdmin'
import PrizeAdministration from './PrizeAdministration'
import { useCurrentUser } from '../../auth/useCurrentUser'
import ProfileAvatar from '../widgets/ProfileAvatar'
import AccountSettings from './AccountSettings'

export default function AdminShell() {
  return (
    <OperatorLanguageProvider>
      <ThemeProvider game={null}>
        <AdminContent />
      </ThemeProvider>
    </OperatorLanguageProvider>
  )
}

function AdminContent() {
  const { language, t } = useOperatorLanguage()
  const logo = useStandLogo()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, loading, error, updateProfile } = useCurrentUser()
  const integrations = location.pathname === '/admin/integrations'
  const prizes = location.pathname === '/admin/prizes'
  const clients = location.pathname === '/admin/clients'
  const account = location.pathname === '/admin/account'
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-xl px-4 py-3 font-medium ${isActive ? 'bg-primary/20 text-textMain' : 'text-textSub hover:bg-surface hover:text-textMain'}`

  return (
    <div lang={language} className="min-h-dvh bg-[var(--color-background)] text-textMain md:grid md:grid-cols-[220px_minmax(0,1fr)]">
      <a href="#admin-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-3">
        {t('Ir al contenido', 'Skip to content')}
      </a>
      <aside className="border-b border-current/10 p-4 md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:overflow-y-auto md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-3">
          <Link to="/admin/games" aria-label={t('STAND — Administración', 'STAND — Administration')}>
            <img src={logo} alt="STAND" className="h-10 w-32 object-contain" />
          </Link>
          <button type="button" className="rounded-lg border border-current/20 px-3 py-2 md:hidden"
            aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={() => setMenuOpen(!menuOpen)}>
            {t('Menú', 'Menu')}
          </button>
        </div>
        <nav id="admin-navigation" aria-label={t('Administración', 'Administration')}
          className={`${menuOpen ? 'block' : 'hidden'} mt-6 space-y-2 md:block`} onClick={() => setMenuOpen(false)}>
          <NavLink to="/admin/games" className={linkClass}>{t('Juegos', 'Games')}</NavLink>
          <NavLink to="/admin/prizes" className={linkClass}>{t('Premios', 'Prizes')}</NavLink>
          <NavLink to="/admin/clients" className={linkClass}>{t('Clientes', 'Clients')}</NavLink>
          <NavLink to="/admin/integrations" className={linkClass}>{t('Integraciones', 'Integrations')}</NavLink>
        </nav>
        <div className={`${menuOpen ? 'block' : 'hidden'} mt-6 border-t border-current/10 pt-4 md:mt-auto md:block`}>
          <div className="group relative flex min-w-0 items-center gap-3 rounded-xl p-2 hover:bg-surface focus-within:bg-surface">
            <ProfileAvatar size="md" profilePicUrl={user?.profilePicUrl} username={user?.name || user?.email} />
            <div className="min-w-0 transition-opacity group-hover:opacity-0 group-focus-within:opacity-0 [@media(hover:none)]:pr-16">
              <p className="truncate text-sm font-medium">{user?.name || user?.email || t('Mi cuenta', 'My account')}</p>
              {user?.name && user.email && <p className="truncate text-xs text-textSub">{user.email}</p>}
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100">
              <NavLink to="/admin/account" aria-label={t('Configurar cuenta', 'Account settings')}
                title={t('Configurar cuenta', 'Account settings')} onClick={() => setMenuOpen(false)}
                className={({ isActive }) => `rounded-lg p-2 hover:bg-primary/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${isActive ? 'text-primary' : 'text-textSub hover:text-textMain'}`}>
                <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9.7 4.3.5-2.3h3.6l.5 2.3 2 .9 2.1-.7 1.8 3.1-1.6 1.6.2 2.2 1.7 1.5-1.8 3.1-2.2-.6-1.8 1.3-.5 2.3h-3.6l-.5-2.3-2-.9-2.1.7-1.8-3.1 1.6-1.6-.2-2.2-1.7-1.5 1.8-3.1 2.2.6Z" />
                  <circle cx="12" cy="10.5" r="3" />
                </svg>
              </NavLink>
              <Link to="/logout" aria-label={t('Cerrar sesión', 'Sign out')} title={t('Cerrar sesión', 'Sign out')}
                className="rounded-lg p-2 text-textSub hover:bg-primary/20 hover:text-textMain focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H5v14h4m6-14 7 7-7 7m7-7H9" />
                </svg>
              </Link>
            </div>
          </div>
          {error && <p role="alert" className="mb-2 text-xs text-red-400">{t('No se pudo cargar la cuenta.', 'Could not load your account.')}</p>}
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-end gap-4 border-b border-current/10 px-4 py-4 sm:px-8">
          <OperatorLanguageSelector />
        </header>
        <main id="admin-content" tabIndex={-1} className="mx-auto max-w-7xl p-4 sm:p-8">
          <h1 className="text-3xl font-semibold">{account ? t('Configurar cuenta', 'Account settings') : integrations ? t('Integraciones', 'Integrations') : prizes ? t('Premios', 'Prizes') : clients ? t('Clientes', 'Clients') : t('Juegos', 'Games')}</h1>
          <p className="mt-2 text-textSub">
            {account ? t('Gestiona tu perfil y consulta los datos de tu cuenta y plan.', 'Manage your profile and view your account and plan details.') : integrations
              ? t('Gestiona las conexiones de tu cuenta.', 'Manage your account connections.')
              : prizes
                ? t('Gestiona las fichas de premios compartidas por tus partidas.', 'Manage prize details shared across your events.')
                : clients
                  ? t('Consulta participaciones y premios de tus clientes.', 'View your clients’ participation and prize history.')
              : t('Gestiona tus partidas o elige un juego para crear una nueva.', 'Manage your events or choose a game to create one.')}
          </p>
          <Routes>
            <Route path="account" element={loading
              ? <p role="status" className="mt-6">{t('Cargando cuenta…', 'Loading account…')}</p>
              : user ? <AccountSettings user={user} onSaved={updateProfile} />
                : <p role="alert" className="mt-6">{t('No se pudo cargar la cuenta. Recarga la página para reintentar.', 'Could not load your account. Reload the page to retry.')}</p>} />
            <Route path="games" element={<AdminGames />} />
            <Route path="games/catalog" element={<Navigate to="/admin/games?create=1" replace />} />
            <Route path="prizes" element={<PrizeAdministration />} />
            <Route path="clients" element={<ClientsAdmin />} />
            <Route path="integrations" element={
              <div className="mt-6"><IntegrationsSettings embedded onBack={() => navigate('/admin/games')} onClose={() => navigate('/admin/games')} /></div>
            } />
            <Route path="*" element={<Navigate to="/admin/games" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

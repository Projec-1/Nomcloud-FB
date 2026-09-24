import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Menu, X, Moon, Sun } from 'lucide-react'
import Logo from '@/components/layout/Logo'
import LanguageSwitcher from '@/components/layout/LanguageSwitcher'
import { useTheme } from '@/context/ThemeContext'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { cn } from '@/utils/cn'

const NAV_LINKS = [
  { to: '/solutions', key: 'nav.solutions' },
  { to: '/features', key: 'nav.features' },
  { to: '/pricing', key: 'nav.pricing' },
  { to: '/security', key: 'nav.security' },
  { to: '/about', key: 'nav.about' },
  { to: '/contact', key: 'nav.contact' },
]

export default function PublicHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const { profile, activeRole } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-all duration-300',
        scrolled ? 'glass border-b border-ink/5 dark:border-white/10' : 'bg-transparent',
      )}
    >
      <div className="container flex h-[68px] items-center justify-between">
        <Logo />

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }: { isActive: boolean }) =>
                cn(
                  'rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200',
                  isActive ? 'text-ink dark:text-white' : 'text-graphite hover:text-ink dark:hover:text-white',
                )
              }
            >
              {t(link.key)}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-1 lg:flex">
          <LanguageSwitcher />
          <button
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            className="mr-1 rounded-full p-2.5 text-graphite hover:bg-ink/5 hover:text-ink dark:hover:bg-white/10 dark:hover:text-white transition-colors"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {profile && activeRole ? (
            <button onClick={() => navigate(`/app/${activeRole}`)} className="btn-ghost px-4 py-2 text-sm">
              {t('nav.dashboard')}
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <Link to="/login" className="btn-ghost px-4 py-2 text-sm">
                Sign In
              </Link>
              <Link to="/signup" className="btn-accent px-4 py-2 text-sm">
                Get Started
              </Link>
            </div>
          )}
        </div>

        <button
          className="flex items-center justify-center rounded-full p-2 text-ink dark:text-white lg:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {menuOpen && (
        <div className="glass border-t border-ink/5 dark:border-white/10 px-6 pb-6 pt-2 lg:hidden animate-fade-in">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }: { isActive: boolean }) =>
                  cn('rounded-xl px-4 py-3 text-sm font-medium', isActive ? 'bg-ink/5 dark:bg-white/10 text-ink dark:text-white' : 'text-graphite')
                }
              >
                {t(link.key)}
              </NavLink>
            ))}
          </nav>
          <div className="mt-4 flex items-center gap-3 border-t border-ink/5 dark:border-white/10 pt-4">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-graphite hover:bg-ink/5 dark:hover:bg-white/10"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} Theme
            </button>
            {profile && activeRole ? (
              <button onClick={() => navigate(`/app/${activeRole}`)} className="btn-ghost flex-1 justify-center py-2.5 text-sm">
                {t('nav.dashboard')}
              </button>
            ) : (
              <>
                <Link to="/login" className="btn-ghost flex-1 justify-center py-2.5 text-sm">
                  Sign In
                </Link>
                <Link to="/signup" className="btn-accent flex-1 justify-center py-2.5 text-sm">
                  Get Started
                </Link>
              </>
            )}
          </div>
          <div className="mt-4 flex items-center justify-center border-t border-ink/5 pt-4 dark:border-white/10">
            <LanguageSwitcher />
          </div>
        </div>
      )}
    </header>
  )
}

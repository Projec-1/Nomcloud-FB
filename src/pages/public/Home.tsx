import { Link } from 'react-router-dom'
import { ArrowRight, ShieldCheck, Lightning as Zap, Users, CalendarCheck, BookOpen, Wallet, Bell, ChatText as MessageSquare, ChartBar as BarChart3, ClipboardText as ClipboardCheck, GraduationCap, CalendarBlank as CalendarRange } from '@phosphor-icons/react'
import SEO from '@/components/layout/SEO'
import Reveal from '@/components/marketing/Reveal'
import AdministratorWorkspacePreview from '@/components/marketing/previews/AdministratorWorkspacePreview'
import TeacherDashboardMock from '@/components/marketing/previews/TeacherDashboardMock'
import ParentAppMock from '@/components/marketing/previews/ParentAppMock'
import { useLanguage } from '@/context/LanguageContext'
import { img } from '@/data/images'

const pillars = [
  { icon: Users, titleKey: 'home.pillar1.title', bodyKey: 'home.pillar1.body', image: img('studentsRaisingHands', 900) },
  { icon: ShieldCheck, titleKey: 'home.pillar2.title', bodyKey: 'home.pillar2.body', image: '/ARDO%20GBDHIO.png' },
  { icon: Zap, titleKey: 'home.pillar3.title', bodyKey: 'home.pillar3.body', image: '/ardayaschoolphoto.png' },
]

const capabilities = [
  { icon: Users, key: 'home.cap.studentManagement' },
  { icon: CalendarCheck, key: 'home.cap.attendance' },
  { icon: BookOpen, key: 'home.cap.grades' },
  { icon: ClipboardCheck, key: 'home.cap.homework' },
  { icon: Wallet, key: 'home.cap.fees' },
  { icon: Bell, key: 'home.cap.announcements' },
  { icon: MessageSquare, key: 'home.cap.messaging' },
  { icon: BarChart3, key: 'home.cap.reports' },
  { icon: CalendarRange, key: 'home.cap.academicYears' },
  { icon: GraduationCap, key: 'home.cap.teacherTools' },
]

function HeroVisual() {
  return (
    <figure className="hero-visual mx-auto w-full max-w-3xl min-w-0">
      <figcaption className="mb-3">
        <p className="text-sm font-semibold text-ink dark:text-white">Administrator workspace</p>
        <p className="text-xs text-graphite">Illustrative product preview</p>
      </figcaption>
      <AdministratorWorkspacePreview />
    </figure>
  )
}

export default function Home() {
  const { t } = useLanguage()
  const heroPoints = Array.from({ length: 3 }, (_, i) => t(`hero.point${i + 1}`))

  return (
    <div className="public-home">
      <SEO
        title="Nom Cloud — Private School Management Software"
        description="Nom Cloud brings school administration, teaching, and family communication into one school-branded system."
        path="/"
      />
      {/* Hero */}
      <section className="home-hero pt-12 pb-10 sm:pt-16 sm:pb-14">
        <div className="container grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h1 className="max-w-[18ch] text-display-lg text-ink dark:text-white">{t('hero.title')}</h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-graphite">{t('hero.subtitle')}</p>
            <ul className="mt-7 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                {heroPoints.map((point) => (
                  <li key={point} className="flex items-center gap-2.5 text-sm text-ink dark:text-white">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                      <ArrowRight className="h-3 w-3" />
                    </span>
                    {point}
                  </li>
                ))}
            </ul>
            <div className="mt-8">
              <Link to="/book-demo" className="btn-accent px-6 py-3 text-base">
                {t('cta.bookDemo')} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <HeroVisual />
        </div>
      </section>

      {/* Pillars — Why Nom Cloud */}
      <section className="home-pillars section overflow-hidden">
        <div className="container">
          <div className="max-w-2xl">
            <h2 className="text-display-md text-ink dark:text-white">{t('home.why.title')}</h2>
          </div>
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            {pillars.map((p) => (
              <article key={p.titleKey} className="overflow-hidden rounded-xl border border-ink/10 bg-white dark:border-white/10 dark:bg-[#202320]">
                <img src={p.image} alt="" loading="lazy" className="h-44 w-full object-cover" />
                <div className="p-5">
                  <p.icon className="h-5 w-5 text-brand" />
                  <h3 className="mt-3 text-lg font-semibold text-ink dark:text-white">{t(p.titleKey)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-graphite">{t(p.bodyKey)}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Teacher preview */}
      <section className="home-teacher section bg-white dark:bg-white/[0.02]">
        <div className="container grid items-center gap-14 lg:grid-cols-2">
          <Reveal>
            <h2 className="mt-5 text-display-md text-ink dark:text-white">{t('home.teacher.title')}</h2>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-graphite">{t('home.teacher.body')}</p>
            <ul className="mt-7 space-y-3">
              {['home.teacher.point1', 'home.teacher.point2', 'home.teacher.point3'].map((k) => (
                <li key={k} className="flex items-center gap-3 text-sm text-ink dark:text-white">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <ArrowRight className="h-3 w-3" />
                  </span>
                  {t(k)}
                </li>
              ))}
            </ul>
            <div className="mt-8 overflow-hidden rounded-2xl shadow-soft">
              <img src={img('teacherTutoring', 700)} alt="A teacher helping a student one-on-one" className="h-40 w-full object-cover" loading="lazy" />
            </div>
          </Reveal>
          <Reveal delay={150}>
            <TeacherDashboardMock />
          </Reveal>
        </div>
      </section>

      {/* Parent preview */}
      <section className="home-parent section overflow-hidden">
        <div className="container grid items-center gap-14 lg:grid-cols-2">
          <Reveal className="order-2 flex justify-center lg:order-1" delay={150}>
            <ParentAppMock />
          </Reveal>
          <Reveal className="order-1 lg:order-2">
            <h2 className="mt-5 text-display-md text-ink dark:text-white">{t('home.parent.title')}</h2>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-graphite">{t('home.parent.body')}</p>
            <ul className="mt-7 space-y-3">
              {['home.parent.point1', 'home.parent.point2', 'home.parent.point3'].map((k) => (
                <li key={k} className="flex items-center gap-3 text-sm text-ink dark:text-white">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <ArrowRight className="h-3 w-3" />
                  </span>
                  {t(k)}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* Capabilities marquee — Full Platform */}
      <section className="home-capabilities section overflow-hidden bg-white dark:bg-white/[0.02]">
        <div className="container">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-display-md text-ink dark:text-white">{t('home.platform.title')}</h2>
          </div>
        </div>
        <div className="container mt-8">
          <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-5">
            {capabilities.map((capability) => (
              <div key={capability.key} className="flex min-w-0 items-center gap-3 border-b border-ink/10 py-4 dark:border-white/10">
                <capability.icon className="h-5 w-5 flex-shrink-0 text-brand" />
                <p className="text-sm font-medium text-ink dark:text-white">{t(capability.key)}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="container">
          <div className="mt-8">
            <Link to="/features" className="link-underline inline-flex items-center gap-1.5 text-sm font-medium text-accent">
              {t('home.platform.explore')} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="home-cta section">
        <div className="container">
          <div className="relative overflow-hidden rounded-xl border border-ink/10 bg-ink px-5 py-12 text-center dark:border-white/10 sm:px-10 sm:py-16">
            <img
              src={img('childrenWindow', 1600)}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-20"
            />
            <div className="absolute inset-0 bg-ink/70" />
            <div className="relative">
              <h2 className="text-display-md text-white">{t('home.cta.title')}</h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/80">{t('home.cta.body')}</p>
              <div className="mt-7 flex items-center justify-center">
                <Link to="/book-demo" className="btn-accent px-6 py-3 text-base">
                  {t('cta.bookDemo')} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

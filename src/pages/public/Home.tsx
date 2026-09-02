import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Users,
  CalendarCheck,
  BookOpen,
  Wallet,
  Bell,
  MessageSquare,
  BarChart3,
  Sparkles,
  ClipboardCheck,
  GraduationCap,
  CalendarRange,
  CheckCircle2,
} from 'lucide-react'
import SEO from '@/components/layout/SEO'
import Reveal from '@/components/marketing/Reveal'
import HoverText from '@/components/marketing/HoverText'
import TiltCard from '@/components/marketing/TiltCard'
import CountUp from '@/components/marketing/CountUp'
import AdminDashboardHeroMock from '@/components/marketing/previews/AdminDashboardHeroMock'
import TeacherDashboardMock from '@/components/marketing/previews/TeacherDashboardMock'
import ParentAppMock from '@/components/marketing/previews/ParentAppMock'
import { useLanguage } from '@/context/LanguageContext'
import { img } from '@/data/images'

const pillars = [
  { icon: Users, titleKey: 'home.pillar1.title', bodyKey: 'home.pillar1.body', size: 'lg' as const, image: img('studentsRaisingHands', 900) },
  { icon: ShieldCheck, titleKey: 'home.pillar2.title', bodyKey: 'home.pillar2.body', size: 'sm' as const, image: '/ARDO%20GBDHIO.png' },
  { icon: Zap, titleKey: 'home.pillar3.title', bodyKey: 'home.pillar3.body', size: 'sm' as const, image: '/ardayaschoolphoto.png' },
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

const capabilityThemes = {
  'home.cap.studentManagement': {
    card: 'linear-gradient(135deg, rgba(214, 236, 240, 0.92), rgba(245, 243, 255, 0.9))',
    border: 'rgba(117, 156, 170, 0.28)',
    iconBg: 'linear-gradient(135deg, rgba(222, 239, 244, 0.92), rgba(229, 238, 255, 0.9))',
    iconColor: '#365d6d',
    shadow: '0 10px 24px rgba(72, 109, 122, 0.12)',
  },
  'home.cap.attendance': {
    card: 'linear-gradient(135deg, rgba(255, 246, 228, 0.95), rgba(255, 245, 242, 0.9))',
    border: 'rgba(196, 165, 102, 0.24)',
    iconBg: 'linear-gradient(135deg, rgba(255, 234, 183, 0.9), rgba(255, 243, 224, 0.9))',
    iconColor: '#9b6b1d',
    shadow: '0 10px 24px rgba(168, 118, 39, 0.12)',
  },
  'home.cap.grades': {
    card: 'linear-gradient(135deg, rgba(234, 243, 255, 0.95), rgba(247, 249, 255, 0.9))',
    border: 'rgba(118, 149, 194, 0.24)',
    iconBg: 'linear-gradient(135deg, rgba(214, 231, 255, 0.9), rgba(232, 240, 255, 0.9))',
    iconColor: '#395e9c',
    shadow: '0 10px 24px rgba(82, 121, 184, 0.12)',
  },
  'home.cap.homework': {
    card: 'linear-gradient(135deg, rgba(231, 246, 239, 0.95), rgba(246, 251, 248, 0.9))',
    border: 'rgba(117, 168, 129, 0.24)',
    iconBg: 'linear-gradient(135deg, rgba(214, 239, 225, 0.9), rgba(234, 246, 239, 0.9))',
    iconColor: '#2a6a52',
    shadow: '0 10px 24px rgba(65, 114, 89, 0.12)',
  },
  'home.cap.fees': {
    card: 'linear-gradient(135deg, rgba(242, 238, 255, 0.95), rgba(249, 247, 255, 0.9))',
    border: 'rgba(151, 136, 201, 0.24)',
    iconBg: 'linear-gradient(135deg, rgba(228, 220, 255, 0.9), rgba(240, 236, 255, 0.9))',
    iconColor: '#6752af',
    shadow: '0 10px 24px rgba(103, 82, 175, 0.12)',
  },
  'home.cap.announcements': {
    card: 'linear-gradient(135deg, rgba(255, 239, 233, 0.95), rgba(255, 249, 246, 0.9))',
    border: 'rgba(196, 130, 105, 0.24)',
    iconBg: 'linear-gradient(135deg, rgba(255, 224, 212, 0.9), rgba(255, 240, 234, 0.9))',
    iconColor: '#ae5d44',
    shadow: '0 10px 24px rgba(170, 93, 68, 0.12)',
  },
  'home.cap.messaging': {
    card: 'linear-gradient(135deg, rgba(234, 247, 255, 0.95), rgba(246, 250, 255, 0.9))',
    border: 'rgba(117, 160, 187, 0.24)',
    iconBg: 'linear-gradient(135deg, rgba(214, 241, 255, 0.9), rgba(234, 244, 255, 0.9))',
    iconColor: '#2c6989',
    shadow: '0 10px 24px rgba(59, 118, 154, 0.12)',
  },
  'home.cap.reports': {
    card: 'linear-gradient(135deg, rgba(245, 236, 255, 0.95), rgba(252, 249, 255, 0.9))',
    border: 'rgba(163, 126, 179, 0.24)',
    iconBg: 'linear-gradient(135deg, rgba(234, 220, 255, 0.9), rgba(245, 238, 255, 0.9))',
    iconColor: '#785792',
    shadow: '0 10px 24px rgba(120, 87, 146, 0.12)',
  },
  'home.cap.academicYears': {
    card: 'linear-gradient(135deg, rgba(239, 245, 234, 0.95), rgba(247, 250, 243, 0.9))',
    border: 'rgba(127, 148, 108, 0.24)',
    iconBg: 'linear-gradient(135deg, rgba(220, 235, 208, 0.9), rgba(236, 244, 226, 0.9))',
    iconColor: '#586f41',
    shadow: '0 10px 24px rgba(88, 111, 65, 0.12)',
  },
  'home.cap.teacherTools': {
    card: 'linear-gradient(135deg, rgba(234, 240, 249, 0.95), rgba(246, 249, 253, 0.9))',
    border: 'rgba(117, 142, 175, 0.24)',
    iconBg: 'linear-gradient(135deg, rgba(214, 227, 246, 0.9), rgba(234, 241, 249, 0.9))',
    iconColor: '#3f5b7d',
    shadow: '0 10px 24px rgba(63, 91, 125, 0.12)',
  },
} as const

const stats = [
  { value: 40, suffix: '+', decimals: 0, key: 'home.stats.schools' },
  { value: 120, suffix: 'K+', decimals: 0, key: 'home.stats.students' },
  { value: 99.9, suffix: '%', decimals: 1, key: 'home.stats.uptime' },
  { value: 4.9, suffix: '/5', decimals: 1, key: 'home.stats.rating' },
]

const accentColors = ['#FF5A1F', '#007AFF', '#34C759', '#FF9F0A']

function HeroVisual() {
  const { t } = useLanguage()
  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-md">
      <div className="absolute inset-0 overflow-hidden rounded-[2.5rem] shadow-floaty">
        <img
          src={img('teacherWithLearners', 900)}
          alt="A teacher leading a classroom of young students"
          className="h-full w-full object-cover"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/10 via-transparent to-ink/60" />
        <div className="absolute inset-0 bg-gradient-to-br from-brand/30 via-transparent to-accent/20 mix-blend-overlay" />
      </div>

      <Reveal delay={250} className="absolute -left-6 top-10 w-48 rounded-2xl bg-white/95 p-4 shadow-floaty backdrop-blur dark:bg-[#161618]/95 sm:-left-10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-ink dark:text-white">{t('hero.attendanceMarked')}</p>
            <p className="text-[11px] text-graphite">{t('hero.attendanceDetail')}</p>
          </div>
        </div>
      </Reveal>

      <Reveal delay={400} className="absolute -right-6 top-1/2 w-44 -translate-y-1/2 rounded-2xl bg-white/95 p-4 shadow-floaty backdrop-blur dark:bg-[#161618]/95 sm:-right-10">
        <p className="text-[11px] text-graphite">{t('hero.feesCollected')}</p>
        <p className="mt-1 text-lg font-semibold text-ink dark:text-white">$42,180</p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/5 dark:bg-white/10">
          <div className="h-full w-[82%] rounded-full bg-brand" />
        </div>
      </Reveal>

      <Reveal delay={550} className="absolute -bottom-6 left-8 w-52 rounded-2xl bg-white/95 p-4 shadow-floaty backdrop-blur dark:bg-[#161618]/95">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">AA</span>
          <div>
            <p className="text-xs font-semibold text-ink dark:text-white">{t('hero.announcementSent')}</p>
            <p className="text-[11px] text-graphite">{t('hero.announcementReach')}</p>
          </div>
        </div>
      </Reveal>
    </div>
  )
}

export default function Home() {
  const { t } = useLanguage()
  const heroPoints = Array.from({ length: 10 }, (_, i) => t(`hero.point${i + 1}`))

  return (
    <div>
      <SEO
        title="Nom Cloud — Private School Management Software"
        description="Nom Cloud connects school administration, teachers, parents and students in one private, beautifully designed platform. Book a demo today."
        path="/"
      />
      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-16 sm:pt-28">
        <div className="absolute inset-0 bg-mesh-orange" />
        <div className="container relative grid items-center gap-14 lg:grid-cols-2">
          <div>
            <Reveal>
              <span className="eyebrow">
                <Sparkles className="h-3.5 w-3.5" /> {t('hero.eyebrow')}
              </span>
            </Reveal>
            <Reveal delay={100}>
              <h1 className="mt-6 text-display-lg text-ink dark:text-white">
                <HoverText text={t('hero.title')} />
              </h1>
            </Reveal>
            <Reveal delay={200}>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-graphite">{t('hero.subtitle')}</p>
            </Reveal>
            <Reveal delay={280}>
              <ul className="mt-8 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                {heroPoints.map((point) => (
                  <li key={point} className="flex items-center gap-2.5 text-sm text-ink dark:text-white">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                      <ArrowRight className="h-3 w-3" />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={360}>
              <div className="mt-10">
                <Link to="/book-demo" className="btn-accent px-7 py-4 text-base">
                  {t('cta.bookDemo')} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </Reveal>
          </div>

          <Reveal delay={200}>
            <HeroVisual />
          </Reveal>
        </div>

        <Reveal delay={450}>
          <div className="container relative mx-auto mt-20 max-w-5xl">
            <AdminDashboardHeroMock />
          </div>
        </Reveal>
      </section>

      {/* Stats */}
      <section className="border-y border-ink/5 bg-white py-14 dark:border-white/10 dark:bg-white/[0.02]">
        <div className="container grid grid-cols-2 gap-8 sm:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.key} delay={i * 80} className="text-center">
              <p className="text-3xl font-semibold tracking-tight text-ink dark:text-white sm:text-4xl">
                <CountUp
                  value={s.value}
                  decimals={s.decimals}
                  suffix={s.suffix}
                  accent={accentColors[i]}
                />
              </p>
              <p className="mt-1 text-sm text-graphite">{t(s.key)}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pillars — Why Nom Cloud */}
      <section className="section overflow-hidden">
        <div className="container">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">{t('home.why.eyebrow')}</span>
            <h2 className="mt-5 text-display-md text-ink dark:text-white">{t('home.why.title')}</h2>
          </Reveal>
          <div className="mt-16 grid gap-6 md:grid-cols-2">
            {pillars.map((p, i) => (
              <Reveal key={p.titleKey} delay={i * 100} className={p.size === 'lg' ? 'md:row-span-2' : ''}>
                <TiltCard max={5} className={p.size === 'lg' ? 'h-full' : 'h-full'}>
                  <div
                    className={`group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-ink/5 shadow-soft transition-transform duration-500 hover:-translate-y-1.5 dark:border-white/10 ${
                      p.size === 'lg' ? 'min-h-[22rem]' : 'min-h-[15rem]'
                    }`}
                  >
                    {p.image ? (
                      <>
                        <img
                          src={p.image}
                          alt="School activity or campus photo"
                          className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/40 to-ink/10" />
                      </>
                    ) : (
                      <div
                        className={`absolute inset-0 transition-transform duration-700 group-hover:scale-105 ${
                          i === 1
                            ? 'bg-gradient-to-br from-ink via-[#2c2c30] to-[#0071E3]'
                            : 'bg-gradient-to-br from-accent via-[#3fb0ff] to-emerald-400'
                        }`}
                      />
                    )}
                    <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
                    <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
                    <div className="relative mt-auto p-8">
                      <div className="inline-flex rounded-2xl bg-white/15 p-3 text-white backdrop-blur">
                        <p.icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-5 text-lg font-semibold text-white">{t(p.titleKey)}</h3>
                      <p className="mt-2.5 max-w-sm text-sm leading-relaxed text-white/80">{t(p.bodyKey)}</p>
                    </div>
                  </div>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Teacher preview */}
      <section className="section bg-white dark:bg-white/[0.02]">
        <div className="container grid items-center gap-14 lg:grid-cols-2">
          <Reveal>
            <span className="eyebrow">{t('home.teacher.eyebrow')}</span>
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
      <section className="section overflow-hidden">
        <div className="container grid items-center gap-14 lg:grid-cols-2">
          <Reveal className="order-2 flex justify-center lg:order-1" delay={150}>
            <ParentAppMock />
          </Reveal>
          <Reveal className="order-1 lg:order-2">
            <span className="eyebrow">{t('home.parent.eyebrow')}</span>
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
      <section className="section overflow-hidden bg-white dark:bg-white/[0.02]">
        <div className="container">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">{t('home.platform.eyebrow')}</span>
            <h2 className="mt-5 text-display-md text-ink dark:text-white">{t('home.platform.title')}</h2>
          </Reveal>
        </div>
        <div className="relative mt-14 space-y-4">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-mist to-transparent dark:from-surface-dark sm:w-32" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-mist to-transparent dark:from-surface-dark sm:w-32" />

          <div className="flex w-max animate-marquee gap-4 [animation-duration:34s]">
            {[...capabilities, ...capabilities].map((c, i) => {
              const theme = capabilityThemes[c.key as keyof typeof capabilityThemes]
              return (
                <div
                  key={`${c.key}-${i}`}
                  className="flex w-56 flex-shrink-0 items-center gap-3 rounded-2xl border bg-white p-5 shadow-soft dark:border-white/10 dark:bg-[#161618]"
                  style={{
                    background: theme.card,
                    borderColor: theme.border,
                    boxShadow: theme.shadow,
                  }}
                >
                  <div
                    className="rounded-xl p-2.5"
                    style={{
                      background: theme.iconBg,
                      color: theme.iconColor,
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)',
                    }}
                  >
                    <c.icon className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-medium text-ink dark:text-white">{t(c.key)}</p>
                </div>
              )
            })}
          </div>

          <div className="flex w-max animate-marquee gap-4 [animation-direction:reverse] [animation-duration:40s]">
            {[...capabilities.slice().reverse(), ...capabilities.slice().reverse()].map((c, i) => {
              const theme = capabilityThemes[c.key as keyof typeof capabilityThemes]
              return (
                <div
                  key={`${c.key}-rev-${i}`}
                  className="flex w-56 flex-shrink-0 items-center gap-3 rounded-2xl border bg-mist p-5 dark:border-white/10 dark:bg-white/[0.04]"
                  style={{
                    background: theme.card,
                    borderColor: theme.border,
                    boxShadow: theme.shadow,
                  }}
                >
                  <div
                    className="rounded-xl p-2.5"
                    style={{
                      background: theme.iconBg,
                      color: theme.iconColor,
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)',
                    }}
                  >
                    <c.icon className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-medium text-ink dark:text-white">{t(c.key)}</p>
                </div>
              )
            })}
          </div>
        </div>
        <div className="container">
          <Reveal className="mt-10 text-center">
            <Link to="/features" className="link-underline inline-flex items-center gap-1.5 text-sm font-medium text-accent">
              {t('home.platform.explore')} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="section">
        <div className="container">
          <Reveal>
            <div className="relative overflow-hidden rounded-[2.5rem] px-8 py-16 text-center sm:py-24">
              <img
                src={img('childrenWindow', 1600)}
                alt="Students in a classroom, engaged in learning"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-ink/95 via-ink/85 to-[#0071E3]/80" />
              <div className="absolute inset-0 opacity-30 mix-blend-overlay">
                <div className="absolute left-[10%] top-[15%] h-40 w-40 rounded-full bg-brand blur-3xl animate-float" />
                <div className="absolute right-[15%] top-[45%] h-52 w-52 rounded-full bg-accent-light blur-3xl animate-float" style={{ animationDelay: '2s' }} />
                <div className="absolute bottom-[10%] left-[35%] h-36 w-36 rounded-full bg-emerald-400 blur-3xl animate-float" style={{ animationDelay: '4s' }} />
              </div>
              <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
              <div className="relative">
                <span className="eyebrow border border-white/20 bg-white/10 text-white">
                  <Sparkles className="h-3.5 w-3.5" /> {t('home.cta.eyebrow')}
                </span>
                <h2 className="mt-6 text-display-md text-white">{t('home.cta.title')}</h2>
                <p className="mx-auto mt-5 max-w-xl text-base text-white/70">{t('home.cta.body')}</p>
                <div className="mt-9 flex items-center justify-center">
                  <Link to="/book-demo" className="btn-accent px-7 py-4 text-base">
                    {t('cta.bookDemo')} <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  )
}

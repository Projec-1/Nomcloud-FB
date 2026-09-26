import { Link } from 'react-router-dom'
import { ArrowRight, Target, Globe as Globe2, Handshake as HeartHandshake, ShieldCheck, GraduationCap, UsersThree as Users2, MapPin, Rocket } from '@phosphor-icons/react'
import SEO from '@/components/layout/SEO'
import Reveal from '@/components/marketing/Reveal'
import { useLanguage } from '@/context/LanguageContext'
import { img } from '@/data/images'

const values = [
  { icon: Target, n: 1 },
  { icon: ShieldCheck, n: 2 },
  { icon: Globe2, n: 3 },
  { icon: HeartHandshake, n: 4 },
]

const timeline = [
  { year: '2023', n: 1, icon: Rocket },
  { year: '2024', n: 2, icon: Users2 },
  { year: '2025', n: 3, icon: GraduationCap },
  { year: '2026', n: 4, icon: MapPin },
]

export default function About() {
  const { t } = useLanguage()
  return (
    <div>
      <SEO
        title="About Nom Cloud"
        description="Nom Cloud is a Somali-founded technology company building private, modern digital systems for schools."
        path="/about"
      />
      <section className="pt-20 pb-16 sm:pt-28">
        <div className="container text-center">
          <Reveal>
            <h1 className="mx-auto max-w-3xl text-display-lg text-ink dark:text-white">{t('about.title')}</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-graphite">{t('about.subtitle')}</p>
          </Reveal>
        </div>
      </section>

      {/* 1. Mission */}
      <section className="pb-24">
        <div className="container">
          <Reveal>
            <div className="grid overflow-hidden rounded-xl border border-ink/10 bg-white dark:border-white/10 dark:bg-[#202320] lg:grid-cols-2">
              <div className="relative flex min-h-[16rem] flex-col justify-end overflow-hidden p-10 sm:p-14">
                <img src={img('classroomChildren', 1000)} alt="Children in a classroom" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-ink/60" />
                <span className="relative w-fit rounded-xl bg-white/15 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-white">
                  {t('about.mission.badge')}
                </span>
                <h2 className="relative mt-5 text-display-md text-white">{t('about.mission.title')}</h2>
              </div>
              <div className="flex items-center bg-white p-6 dark:bg-[#202320] sm:p-10">
                <p className="text-base leading-relaxed text-graphite">{t('about.mission.body')}</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 2. What We Believe */}
      <section className="section bg-white dark:bg-white/[0.02]">
        <div className="container">
          <h2 className="max-w-2xl text-display-md text-ink dark:text-white">{t('about.believe.title')}</h2>
          <div className="mt-8 grid gap-x-10 sm:grid-cols-2">
            {values.map((v) => (
              <article key={v.n} className="border-t border-ink/10 py-5 dark:border-white/10">
                <v.icon className="h-5 w-5 text-brand" />
                <h3 className="mt-3 text-lg font-semibold text-ink dark:text-white">{t(`about.value${v.n}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-graphite">{t(`about.value${v.n}.body`)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Journey */}
      <section className="section overflow-hidden">
        <div className="container">
          <h2 className="mx-auto max-w-2xl text-display-md text-ink dark:text-white">{t('about.journey.title')}</h2>
          <div className="relative mx-auto mt-16 max-w-3xl">
            <div className="absolute left-6 top-2 bottom-2 w-px bg-brand/25 sm:left-8" />
            <div className="space-y-10">
              {timeline.map((t2, i) => (
                <Reveal key={t2.year} delay={i * 100} className="relative flex gap-5 pl-0 sm:gap-6">
                  <span className="relative z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand sm:h-16 sm:w-16">
                    <t2.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                  </span>
                  <div className="card flex-1 p-6">
                    <p className="text-sm font-semibold text-brand">{t2.year}</p>
                    <h3 className="mt-1 text-lg font-semibold text-ink dark:text-white">{t(`about.t${t2.n}.title`)}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-graphite">{t(`about.t${t2.n}.body`)}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Closing CTA */}
      <section className="pb-24">
        <div className="container">
          <Reveal>
            <div className="relative flex flex-col items-center justify-between gap-8 overflow-hidden rounded-xl bg-ink p-6 text-center sm:flex-row sm:p-10 sm:text-left">
              <img src={img('boyWithPaper', 1400)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-20" />
              <div className="absolute inset-0 bg-ink/70" />
              <div className="relative flex items-center gap-5">
                <span className="hidden h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-white sm:flex">
                  <HeartHandshake className="h-7 w-7" />
                </span>
                <div>
                  <h3 className="text-xl font-semibold text-white">{t('about.cta.title')}</h3>
                  <p className="mt-1.5 text-sm text-white/60">{t('about.cta.body')}</p>
                </div>
              </div>
              <Link to="/book-demo" className="btn-accent relative flex-shrink-0 px-6 py-3.5 text-sm">
                {t('cta.bookDemo')} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  )
}

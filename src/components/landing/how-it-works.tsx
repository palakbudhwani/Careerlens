import { Reveal } from '@/components/landing/reveal'
import { SectionHeading } from '@/components/landing/section-heading'
import { howItWorks } from '@/data/landing'

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-background">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <Reveal>
          <SectionHeading
            eyebrow="How it works"
            title="From CV to career plan in four steps"
            description="A guided flow that turns a single file into a complete career strategy."
          />
        </Reveal>

        <div className="relative mt-10 lg:mt-12">
          <div
            aria-hidden
            className="absolute left-6 top-2 bottom-2 hidden w-px bg-gradient-to-b from-brand-500/60 via-border to-transparent sm:block lg:left-0 lg:top-6 lg:h-px lg:w-full lg:bg-gradient-to-r"
          />
          <ol className="grid gap-7 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
            {howItWorks.map((step, index) => (
              <li
                key={step.title}
                className="relative flex gap-4 sm:pl-14 lg:flex-col lg:gap-4 lg:pl-0 lg:text-center"
              >
                <span className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-background text-brand-600 shadow-card dark:text-brand-400">
                  <step.icon className="size-5" aria-hidden />
                </span>
                <div>
                  <span className="font-display text-sm font-bold text-brand-600 dark:text-brand-400">
                    0{index + 1}
                  </span>
                  <h3 className="mt-1 font-display text-base font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
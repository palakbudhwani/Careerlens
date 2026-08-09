import { Reveal } from '@/components/landing/reveal'
import { SectionHeading } from '@/components/landing/section-heading'
import { valueFlow } from '@/data/landing'

export function ValueFlow() {
  return (
    <section id="product" className="border-y border-border bg-muted/40">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <Reveal>
          <SectionHeading
            eyebrow="The CareerLens engine"
            title="From resume to career direction."
            description="CareerLens connects five dots that other tools keep separate — turning a static CV into a complete, actionable view of where your career can go."
          />
        </Reveal>

        <div className="relative mt-10 lg:mt-12">
          <div
            aria-hidden
            className="absolute left-[10%] right-[10%] top-6 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent lg:block"
          />
          <div
            aria-hidden
            className="absolute left-6 top-4 bottom-4 hidden w-px bg-gradient-to-b from-transparent via-border to-transparent sm:block lg:hidden"
          />
          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5 lg:gap-3">
            {valueFlow.map((step, index) => (
              <li
                key={step.title}
                className="relative flex items-start gap-4 sm:pl-14 lg:flex-col lg:items-center lg:gap-4 lg:pl-0 lg:text-center"
              >
                <span className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-brand-600 shadow-card dark:text-brand-400">
                  <step.icon className="size-5" aria-hidden />
                </span>
                <div className="pt-1 lg:pt-0">
                  <h3 className="text-sm font-semibold">{step.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                  {index < valueFlow.length - 1 && (
                    <span
                      className="mt-2 inline-flex text-muted-foreground/40 lg:hidden"
                      aria-hidden
                    >
                      ↓
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
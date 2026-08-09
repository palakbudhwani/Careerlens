import { Reveal } from '@/components/landing/reveal'
import { SectionHeading } from '@/components/landing/section-heading'
import { features } from '@/data/landing'

export function CoreFeatures() {
  return (
    <section id="features" className="bg-background">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <Reveal>
          <SectionHeading
            eyebrow="Core capabilities"
            title="Everything you need, explained."
            description="Four focused tools that work together — from a stronger resume to a role that genuinely fits."
          />
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <Reveal key={feature.title} delay={index * 0.06}>
              <div className="group relative h-full rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-card-lg dark:hover:border-brand-500/30">
                <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-muted/50 text-brand-600 transition-colors duration-300 group-hover:bg-brand-500/10 dark:text-brand-400">
                  <feature.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-3 font-display text-base font-semibold">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
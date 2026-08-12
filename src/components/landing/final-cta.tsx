import { Briefcase, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Reveal } from '@/components/landing/reveal'
import { useResumeUpload } from '@/components/resume/resume-upload-provider'
import { Button } from '@/components/ui/button'
import { finalCta } from '@/data/landing'

export function FinalCta() {
  const { openResumeUpload } = useResumeUpload()
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-navy-950 px-6 py-12 text-center sm:px-12 lg:py-16">
            <div
              aria-hidden
              className="absolute -top-24 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-brand-600/25 blur-3xl"
            />
            <div
              aria-hidden
              className="absolute -bottom-24 right-0 h-64 w-96 rounded-full bg-blue-600/20 blur-3xl"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.04)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]"
            />

            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                <span className="size-1.5 rounded-full bg-brand-400" aria-hidden />
                {finalCta.kicker}
              </span>
              <h2 className="mx-auto mt-4 max-w-2xl font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-[2.75rem]">
                {finalCta.title}
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-white/70">
                {finalCta.description}
              </p>

              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="w-full bg-brand-500 text-white hover:bg-brand-400 sm:w-auto"
                  leftIcon={<Upload className="size-4" aria-hidden />}
                  onClick={openResumeUpload}
                >
                  Analyze My Resume
                </Button>
                <Link to="/jobs" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white sm:w-auto"
                    leftIcon={<Briefcase className="size-4" aria-hidden />}
                  >
                    Explore Jobs
                  </Button>
                </Link>
              </div>

              <p className="mt-5 text-xs text-white/50">
                Free to try · No account needed · Your data never leaves your browser
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
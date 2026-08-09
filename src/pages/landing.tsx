import { CoreFeatures } from '@/components/landing/core-features'
import { FinalCta } from '@/components/landing/final-cta'
import { LandingFooter } from '@/components/landing/footer'
import { Hero } from '@/components/landing/hero'
import { HowItWorks } from '@/components/landing/how-it-works'
import { LandingNavbar } from '@/components/landing/navbar'
import { ProductShowcase } from '@/components/landing/product-showcase'
import { ValueFlow } from '@/components/landing/value-flow'

export default function LandingPage() {
  return (
    <div className="bg-background">
      <LandingNavbar />
      <main>
        <Hero />
        <ValueFlow />
        <HowItWorks />
        <CoreFeatures />
        <ProductShowcase />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  )
}
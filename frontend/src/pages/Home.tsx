import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGroomingEnabled } from '../hooks/useGroomingEnabled'
import { HomeNavChrome } from '../components/home/HomeNavChrome'
import { HeroSection } from '../components/home/HeroSection'
import { EnterpriseTypesSection } from '../components/home/EnterpriseTypesSection'
import { HospitalsSection } from '../components/home/HospitalsSection'
import { MarketplaceCtaSection } from '../components/home/MarketplaceCtaSection'
import { FeaturesTabsSection } from '../components/home/FeaturesTabsSection'
import { GroomingHomeSection } from '../components/home/GroomingHomeSection'
import { AdvancedCapabilitiesSection } from '../components/home/AdvancedCapabilitiesSection'
import { HowItWorksSection } from '../components/home/HowItWorksSection'
import { ClosingSections } from '../components/home/ClosingSections'
import { NAV_KEY_MAP, HomeTab } from '../components/home/homeContent'
import './Home.css'

interface HomeProps {
  onGetStarted: () => void
  onViewForDoctors: () => void
  onLogin?: () => void
}

/**
 * Base section order. 'grooming' is spliced in at runtime only when the module is
 * live - Grooming & Spa is dark-launched behind `grooming.enabled`, and a nav
 * entry that scrolls to a section that was never rendered is a dead link.
 */
const BASE_SECTION_IDS = ['hero', 'enterprises', 'hospitals', 'features', 'workflow', 'compliance', 'how-it-works', 'testimonials'] as const

export default function Home({ onGetStarted, onViewForDoctors, onLogin }: HomeProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<HomeTab>('owner')
  const [activeSection, setActiveSection] = useState('hero')
  const [scrollProgress, setScrollProgress] = useState(0)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [navScrolled, setNavScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [langDropdownOpen, setLangDropdownOpen] = useState(false)
  const [sectionsDropdownOpen, setSectionsDropdownOpen] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const langDropRef = useRef<HTMLDivElement>(null)
  const sectionsDropRef = useRef<HTMLDivElement>(null)

  const { enabled: groomingEnabled } = useGroomingEnabled()

  // Grooming sits after 'features' - it is a service line, so it belongs with what
  // the platform offers rather than after the compliance/workflow material.
  const SECTION_IDS = useMemo(() => {
    if (!groomingEnabled) return [...BASE_SECTION_IDS]
    const ids = [...BASE_SECTION_IDS]
    ids.splice(ids.indexOf('features') + 1, 0, 'grooming' as typeof BASE_SECTION_IDS[number])
    return ids
  }, [groomingEnabled])

  const sectionLabel = (id: string) => t(`home.nav.${NAV_KEY_MAP[id] || id}`)

  // Close lang + sections dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langDropRef.current && !langDropRef.current.contains(e.target as Node)) {
        setLangDropdownOpen(false)
      }
      if (sectionsDropRef.current && !sectionsDropRef.current.contains(e.target as Node)) {
        setSectionsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Scroll progress + back-to-top + nav shadow
  const handleScroll = useCallback(() => {
    const scrollTop = window.scrollY
    const docHeight = document.documentElement.scrollHeight - window.innerHeight
    setScrollProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0)
    setShowBackToTop(scrollTop > 500)
    setNavScrolled(scrollTop > 20)
  }, [])

  // IntersectionObserver for active section
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length > 0) {
          // Pick the one with the highest intersection ratio
          const best = visible.reduce((a, b) => a.intersectionRatio > b.intersectionRatio ? a : b)
          setActiveSection(best.target.id)
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5] }
    )

    // Observe all sections with IDs
    setTimeout(() => {
      SECTION_IDS.forEach(id => {
        const el = document.getElementById(id)
        if (el) observerRef.current?.observe(el)
      })
    }, 100)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      observerRef.current?.disconnect()
    }
    // SECTION_IDS is a dependency because the grooming section appears only once
    // the feature probe resolves - without it the observer would never watch it
    // and the nav would not highlight while scrolling through.
  }, [handleScroll, SECTION_IDS])

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })
  const browseMarketplace = () => navigate('/browse-marketplace')
  const navigateToGroomerRegister = () => navigate('/register?role=groomer')

  return (
    <div className="home-page">
      {/* Scroll Progress Bar */}
      {/* eslint-disable-next-line react/forbid-dom-props -- runtime-computed scroll percentage */}
      <div className="scroll-progress" style={{ ['--fill' as string]: `${scrollProgress}%` }} />

      <HomeNavChrome
        navScrolled={navScrolled}
        activeSection={activeSection}
        sectionIds={SECTION_IDS}
        sectionLabel={sectionLabel}
        scrollToSection={scrollToSection}
        scrollToTop={scrollToTop}
        showBackToTop={showBackToTop}
        sectionsDropdownOpen={sectionsDropdownOpen}
        setSectionsDropdownOpen={setSectionsDropdownOpen}
        sectionsDropRef={sectionsDropRef}
        langDropdownOpen={langDropdownOpen}
        setLangDropdownOpen={setLangDropdownOpen}
        langDropRef={langDropRef}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onGetStarted={onGetStarted}
        onLogin={onLogin}
        onBrowseMarketplace={browseMarketplace}
      />

      <HeroSection
        onGetStarted={onGetStarted}
        onViewForDoctors={onViewForDoctors}
        onLogin={onLogin}
        onBrowseMarketplace={browseMarketplace}
        groomingEnabled={groomingEnabled}
      />

      <EnterpriseTypesSection />

      <HospitalsSection onGetStarted={onGetStarted} />

      <MarketplaceCtaSection onBrowseMarketplace={browseMarketplace} onGetStarted={onGetStarted} />

      <FeaturesTabsSection activeTab={activeTab} setActiveTab={setActiveTab} />

      {groomingEnabled && (
        <GroomingHomeSection onGetStarted={onGetStarted} onNavigateToGroomerRegister={navigateToGroomerRegister} />
      )}

      <AdvancedCapabilitiesSection />

      <HowItWorksSection activeTab={activeTab} setActiveTab={setActiveTab} />

      <ClosingSections
        onGetStarted={onGetStarted}
        onViewForDoctors={onViewForDoctors}
        onLogin={onLogin}
        groomingEnabled={groomingEnabled}
      />
    </div>
  )
}

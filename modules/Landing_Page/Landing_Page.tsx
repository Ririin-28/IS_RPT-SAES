"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Bot,
  BrainCircuit,
  ChartLine,
  Clock3,
  ClipboardCheck,
  ClipboardList,
  Database,
  DatabaseZap,
  Facebook,
  FileChartLine,
  Mail,
  MapPinned,
  Navigation,
  Phone,
} from "lucide-react";
import RPTLogoTitle from "@/components/Common/RPTLogoTitle";
import Footer from "@/components/Common/Footer";

// Default fallback values in case API fails
const DEFAULT_HERO_IMAGES = [
  "/SAES/Carousel-1.jpg",
  "/SAES/Carousel-2.jpg",
  "/SAES/Carousel-3.jpg",
  "/SAES/Carousel-4.jpg",
  "/SAES/Carousel-5.jpg",
  "/SAES/Carousel-6.jpg",
  "/SAES/Carousel-7.jpg",
];

const DEFAULT_SCHOOL_DETAILS = {
  location: "San Agustin Elementary School",
  contact_no: "(02) 7001 7058",
  email: "sanagustinelem@gmail.com",
  facebook: "https://bit.ly/136538_saesfb",
};

const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "Download", href: "#mobile" },
  { label: "Location", href: "#location" },
  { label: "Contacts", href: "#contacts" },
  { label: "Login", href: "/auth/login", isRoute: true },
];

const NAV_SECTION_IDS = NAV_LINKS
  .filter((item) => !item.isRoute)
  .map((item) => item.href.replace("#", ""));

type LandingContent = {
  carouselImages: Array<{
    id: string;
    dataUrl: string | null;
    name: string | null;
  }>;
  logo: {
    id: string;
    dataUrl: string | null;
    name: string | null;
  } | null;
  saesDetails: {
    location: string;
    contact_no: string;
    email: string;
    facebook: string | null;
  } | null;
  privacyPolicy: {
    dataUrl: string | null;
    name: string | null;
  } | null;
};

type ApiLandingPayload = {
  carouselImages?: Array<{
    id?: number | string;
    image?: string | null;
    dataUrl?: string | null;
    name?: string | null;
    createdAt?: string;
  }>;
  logo?: {
    id?: number | string;
    logo?: string | null;
    dataUrl?: string | null;
    name?: string | null;
  } | null;
  saesDetails?: {
    location?: string | null;
    contact_no?: string | null;
    email?: string | null;
    facebook?: string | null;
  } | null;
  privacyPolicy?: {
    id?: number | string;
    file?: string | null;
    dataUrl?: string | null;
    name?: string | null;
  } | null;
};

const createFallbackLandingContent = (): LandingContent => ({
  carouselImages: DEFAULT_HERO_IMAGES.map((url, index) => ({
    id: `fallback-${index}`,
    dataUrl: url,
    name: `Carousel-${index + 1}.jpg`,
  })),
  logo: {
    id: "fallback-logo",
    dataUrl: "/SAES/SAESLogo.png",
    name: "SAESLogo.png",
  },
  saesDetails: {
    location: DEFAULT_SCHOOL_DETAILS.location,
    contact_no: DEFAULT_SCHOOL_DETAILS.contact_no,
    email: DEFAULT_SCHOOL_DETAILS.email,
    facebook: DEFAULT_SCHOOL_DETAILS.facebook,
  },
  privacyPolicy: {
    dataUrl: "/RPT-SAES_Privacy-Policy.docx",
    name: "RPT-SAES_Privacy-Policy.docx",
  },
});

const normalizeLandingContent = (data: ApiLandingPayload | undefined | null): LandingContent => {
  const fallback = createFallbackLandingContent();

  if (!data) {
    return fallback;
  }

  const safeCarousel = Array.isArray(data.carouselImages)
    ? data.carouselImages
      .map((item, index) => {
        if (!item) return null;
        const dataUrl = typeof item.dataUrl === "string" ? item.dataUrl : typeof item.image === "string" ? item.image : null;
        const name = typeof item.name === "string" ? item.name : null;
        const id = String(item.id ?? index);
        return { id, dataUrl, name };
      })
      .filter((item): item is { id: string; dataUrl: string | null; name: string | null } => Boolean(item))
    : [];

  const safeLogo = data.logo
    ? {
      id: String(data.logo.id ?? "logo"),
      dataUrl:
        typeof data.logo.dataUrl === "string"
          ? data.logo.dataUrl
          : typeof data.logo.logo === "string"
            ? data.logo.logo
            : fallback.logo?.dataUrl ?? null,
      name: typeof data.logo.name === "string" ? data.logo.name : fallback.logo?.name ?? null,
    }
    : fallback.logo;

  const safeDetails = data.saesDetails
    ? {
      location: data.saesDetails.location ?? fallback.saesDetails?.location ?? DEFAULT_SCHOOL_DETAILS.location,
      contact_no: data.saesDetails.contact_no ?? fallback.saesDetails?.contact_no ?? DEFAULT_SCHOOL_DETAILS.contact_no,
      email: data.saesDetails.email ?? fallback.saesDetails?.email ?? DEFAULT_SCHOOL_DETAILS.email,
      facebook: data.saesDetails.facebook ?? fallback.saesDetails?.facebook ?? DEFAULT_SCHOOL_DETAILS.facebook,
    }
    : fallback.saesDetails;

  const safePolicy = data.privacyPolicy
    ? {
      dataUrl:
        typeof data.privacyPolicy.dataUrl === "string"
          ? data.privacyPolicy.dataUrl
          : typeof data.privacyPolicy.file === "string"
            ? data.privacyPolicy.file
            : fallback.privacyPolicy?.dataUrl ?? null,
      name: typeof data.privacyPolicy.name === "string" ? data.privacyPolicy.name : fallback.privacyPolicy?.name ?? null,
    }
    : fallback.privacyPolicy;

  return {
    carouselImages: safeCarousel.length > 0 ? safeCarousel : fallback.carouselImages,
    logo: safeLogo,
    saesDetails: safeDetails,
    privacyPolicy: safePolicy,
  };
};

const getSectionNavAnchor = (section: HTMLElement) =>
  section.querySelector<HTMLElement>("[data-nav-anchor='true']") ?? section;

const getSectionScrollTarget = (section: HTMLElement) => {
  const navAnchor = getSectionNavAnchor(section);
  const anchorRect = navAnchor.getBoundingClientRect();
  const anchorCenter = anchorRect.top + window.scrollY + anchorRect.height / 2;
  const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);

  return Math.min(Math.max(anchorCenter - window.innerHeight / 2, 0), maxScroll);
};

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [landingContent, setLandingContent] = useState<LandingContent>(
    createFallbackLandingContent()
  );
  const [visibleSections, setVisibleSections] = useState({
    hero: false,
    about: false,
    mission: false,
    features: false,
    mobile: false,
    location: false,
    contacts: false,
  });

  const heroRef = useRef(null);
  const aboutRef = useRef(null);
  const missionRef = useRef(null);
  const featuresRef = useRef(null);
  const mobileRef = useRef(null);
  const locationRef = useRef(null);
  const contactsRef = useRef(null);
  const activeSectionLockRef = useRef<string | null>(null);

  // Mark mounted immediately so LCP is not gated by API latency
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch landing page content from your existing API
  useEffect(() => {
    const fetchLandingContent = async () => {
      try {
        const response = await fetch("/api/it_admin/landing");
        if (!response.ok) {
          throw new Error(`Failed to load landing configuration (${response.status})`);
        }

        const result = await response.json();
        const normalized = normalizeLandingContent(result?.data);
        setLandingContent(normalized);
      } catch (error) {
        console.error('Failed to fetch landing content:', error);
        setLandingContent(createFallbackLandingContent());
      }
    };

    fetchLandingContent();
  }, []);

  // Get hero images from API or use defaults
  const HERO_IMAGES = landingContent?.carouselImages
    .filter((img) => typeof img.dataUrl === "string" && img.dataUrl.length > 0)
    .map((img) => img.dataUrl as string) || DEFAULT_HERO_IMAGES;

  const slideCount = HERO_IMAGES.length;
  const activeSlide = HERO_IMAGES[currentSlide % slideCount] ?? HERO_IMAGES[0];
  const schoolContactNo = landingContent?.saesDetails?.contact_no || DEFAULT_SCHOOL_DETAILS.contact_no;
  const schoolEmail = landingContent?.saesDetails?.email || DEFAULT_SCHOOL_DETAILS.email;
  const schoolFacebook = landingContent?.saesDetails?.facebook || DEFAULT_SCHOOL_DETAILS.facebook;
  const schoolFacebookUrl = /^https?:\/\//i.test(schoolFacebook)
    ? schoolFacebook
    : `https://${schoolFacebook}`;
  const contactMethods = [
    {
      label: "Phone",
      value: schoolContactNo,
      description: "Call the school office directly.",
      href: `tel:${schoolContactNo.replace(/[^\d+]/g, "")}`,
      icon: Phone,
    },
    {
      label: "Email",
      value: schoolEmail,
      description: "Send school concerns and general inquiries anytime.",
      href: `mailto:${schoolEmail}`,
      icon: Mail,
    },
    {
      label: "Facebook",
      value: schoolFacebook.replace(/^https?:\/\//i, ""),
      description: "View official announcements and school updates online.",
      href: schoolFacebookUrl,
      external: true,
      icon: Facebook,
    },
  ];

  useEffect(() => {
    if (!mounted) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slideCount);
    }, 5000);

    // Set up Intersection Observer for scroll animations
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections(prev => ({
              ...prev,
              [entry.target.id]: true
            }));
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      }
    );

    // Observe all sections after a short delay to ensure they're rendered
    setTimeout(() => {
      if (heroRef.current) observer.observe(heroRef.current);
      if (aboutRef.current) observer.observe(aboutRef.current);
      if (missionRef.current) observer.observe(missionRef.current);
      if (featuresRef.current) observer.observe(featuresRef.current);
      if (mobileRef.current) observer.observe(mobileRef.current);
      if (locationRef.current) observer.observe(locationRef.current);
      if (contactsRef.current) observer.observe(contactsRef.current);
    }, 100);

    return () => {
      clearInterval(timer);
      observer.disconnect();
    };
  }, [mounted, slideCount]);

  useEffect(() => {
    if (!mounted) return;

    let ticking = false;

    const updateActiveSection = () => {
      const nearBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 120;
      const lockedSectionId = activeSectionLockRef.current;

      if (lockedSectionId) {
        const lockedSection = document.getElementById(lockedSectionId);

        if (!lockedSection) {
          activeSectionLockRef.current = null;
        } else {
          const lockedSectionTop = getSectionScrollTarget(lockedSection);
          const reachedLockedSection =
            Math.abs(window.scrollY - lockedSectionTop) <= 24 ||
            (lockedSectionId === "contacts" && nearBottom);

          if (!reachedLockedSection) {
            setActiveSection(lockedSectionId);
            ticking = false;
            return;
          }

          activeSectionLockRef.current = null;
        }
      }

      if (nearBottom) {
        setActiveSection("contacts");
        ticking = false;
        return;
      }

      const viewportCenter = window.scrollY + window.innerHeight / 2;
      let currentSection = NAV_SECTION_IDS[0] ?? "home";
      let closestDistance = Number.POSITIVE_INFINITY;

      NAV_SECTION_IDS.forEach((sectionId) => {
        const section = document.getElementById(sectionId);
        if (!section) {
          return;
        }

        const navAnchor = getSectionNavAnchor(section);
        const anchorRect = navAnchor.getBoundingClientRect();
        const anchorCenter = anchorRect.top + window.scrollY + anchorRect.height / 2;
        const distanceFromCenter = Math.abs(anchorCenter - viewportCenter);

        if (distanceFromCenter < closestDistance) {
          closestDistance = distanceFromCenter;
          currentSection = sectionId;
        }
      });

      setActiveSection(currentSection);
      ticking = false;
    };

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [mounted]);

  const goToSlide = (index: number) => {
    setCurrentSlide((index + slideCount) % slideCount);
  };

  const handlePrev = () => {
    goToSlide(currentSlide - 1);
  };

  const handleNext = () => {
    goToSlide(currentSlide + 1);
  };

  const scrollToSection = (sectionId: string) => {
    activeSectionLockRef.current = sectionId;
    setActiveSection(sectionId);

    const section = document.getElementById(sectionId);
    if (!section) {
      activeSectionLockRef.current = null;
      return;
    }

    const top = getSectionScrollTarget(section);
    window.history.replaceState(null, "", `#${sectionId}`);
    window.scrollTo({
      top: Math.max(top, 0),
      behavior: "smooth",
    });
  };

  // Helper function to determine if section should be visible
  const isSectionVisible = (section: string) => {
    return mounted && visibleSections[section as keyof typeof visibleSections];
  };
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f6faf8] text-[#013300]">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(198,238,216,0.34),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(212,242,225,0.3),transparent_24%),linear-gradient(180deg,rgba(251,254,252,0.98),rgba(244,250,246,0.96))]" />
      <div className="pointer-events-none absolute left-[12%] right-[50%] top-36 -z-10 h-48 rounded-3xl bg-linear-to-br from-green-100/40 via-white/40 to-transparent blur-4xl" />
      <div className="pointer-events-none absolute left-[56%] right-[12%] bottom-12 -z-10 h-48 rounded-[36px] bg-linear-to-t from-green-100/35 via-white/35 to-transparent blur-4xl" />

      {/* Navbar - Responsive Organization */}
      <header className={`fixed inset-x-0 top-0 z-30 border-b border-white/70 bg-white/88 shadow-[0_10px_28px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all duration-500 ${mounted ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
        }`}>
        <div className="flex w-full items-center px-6 py-3 md:px-10 md:py-2 lg:px-14">
          <div className="flex items-center gap-3">
            <RPTLogoTitle small />
          </div>
          <nav className="hidden md:flex md:flex-1 md:items-center md:justify-end md:gap-8 lg:gap-12">
            {NAV_LINKS.map((item) => {
              if (item.isRoute) {
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`
                    rounded-full border border-transparent px-4 py-2 text-base font-semibold transition-[background-color,color,border-color,box-shadow,transform,opacity] duration-200
                    md:text-[15px] lg:text-base
                    text-slate-700 hover:bg-green-50/80 hover:text-[#013300]
                    ${mounted ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}
                  `}
                  >
                    {item.label}
                  </Link>
                );
              }

              const sectionId = item.href.replace("#", "");
              const isActive = activeSection === sectionId;

              return (
                <button
                  key={item.label}
                  type="button"
                  aria-current={isActive ? "location" : undefined}
                  onClick={() => scrollToSection(sectionId)}
                  className={`
                  rounded-full border border-transparent px-4 py-2 text-base font-semibold transition-[background-color,color,border-color,box-shadow,transform,opacity] duration-200
                  md:text-[15px] lg:text-base
                  ${isActive
                      ? "bg-[#013300] text-white shadow-[0_10px_22px_rgba(1,51,0,0.18)]"
                      : "text-slate-700 hover:bg-green-50/80 hover:text-[#013300]"
                    }
                  ${mounted ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}
                `}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main
        ref={heroRef}
        id="home"
        className="relative overflow-hidden px-5 py-5 pt-20 md:px-8 md:py-12 md:pt-28 lg:px-12 lg:py-16 lg:pt-20"
      >
        {/* Soft gradients behind the hero */}
        <div className="pointer-events-none absolute inset-x-0 top-12 h-96 bg-linear-to-br from-green-50 via-white to-green-50/60 opacity-80 blur-3xl" />
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-linear-to-br from-green-100/35 to-green-50/25 blur-2xl" />
        <div className="pointer-events-none absolute bottom-0 -left-16 h-56 w-56 rounded-full bg-green-100/35 blur-2xl" />

        <div
          data-nav-anchor="true"
          className="relative mx-auto grid max-w-7xl gap-6 py-4 md:gap-10 md:py-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:py-16 lg:gap-15"
        >
          {/* Text Content */}
          <div
            className={`
            relative z-10 w-full flex flex-col items-center justify-center text-center lg:-ml-12
            transition-all duration-700 transform
            ${mounted ? 'translate-x-0 opacity-100 scale-100' : '-translate-x-8 opacity-0 scale-95'}
            sm:items-start sm:text-left
            `}
          >
            <div className="flex items-center gap-3 mb-4 md:gap-4 md:mb-6">
              <Image
                src={landingContent?.logo?.dataUrl || "/SAES/SAESLogo.png"}
                alt="San Agustin Elementary School logo"
                width={64}
                height={64}
                priority
                className="h-12 w-12 md:h-16 md:w-16 object-contain"
              />
              <span className="text-base font-semibold text-[#013300] md:text-xl lg:text-2xl">
                San Agustin Elementary School
              </span>
            </div>
            <p className="pb-3 text-base font-medium opacity-90 md:pb-5 md:text-xl">
              Welcome to <span className="font-semibold">RPT-SAES</span>
            </p>
            <h1
              className="mb-4 text-3xl font-extrabold leading-tight text-[#013300] md:mb-6 md:text-4xl lg:text-5xl"
            >
              Transforming Remedial
              <br />
              Learning with Technology
            </h1>
            <p
              className={`
              mb-1 text-sm text-green-900 md:mb-2 md:text-lg lg:mb-10 lg:text-xl
              transition-all duration-800 delay-300 transform
              ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}
              text-center sm:text-left
            `}
            >
              An innovative platform designed to support teachers in managing and tracking student progress in remedial programs.
            </p>
            <div className={`flex w-full flex-wrap items-center justify-center gap-4 mt-4 transition-all duration-800 delay-500 transform ${mounted ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-6 opacity-0 scale-95'
              } sm:items-start sm:justify-start`}>
              <Link href="/auth/login" className="
                inline-flex min-h-12 touch-manipulation items-center justify-center rounded-xl bg-[#013300] px-4 py-3 text-base font-semibold text-white transition-colors duration-200 hover:bg-[#014a1f]
                md:px-5 md:py-3 md:text-lg lg:text-xl
              ">
                Get Started
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 ml-2 md:w-6 md:h-6">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Image Carousel with Caption */}
          <div
            className={`
            relative z-10 w-full mt-2 lg:w-[120%] lg:mt-0 lg:-ml-20
            transition-all duration-800 delay-400 transform
            ${mounted ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-8 opacity-0 scale-95'}
          `}
          >
            <div className="relative isolate">
              <div className="relative overflow-hidden rounded-3xl border border-gray-200/80 bg-white/85 shadow-[0_16px_36px_rgba(15,23,42,0.10)]">
                <div className="relative h-64 sm:h-72 md:h-120 lg:h-125">
                  <div className="absolute inset-0 transition-all duration-700 ease-out opacity-100 scale-100">
                    <Image
                      src={activeSlide}
                      alt={`San Agustin Elementary School campus view ${currentSlide + 1}`}
                      fill
                      priority
                      className="object-cover transition-transform duration-700 ease-out hover:scale-[1.02]"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1600px"
                    />
                  </div>
                </div>

                <div className="absolute inset-y-0 left-0 right-0 hidden items-center justify-between px-4 sm:flex">
                  <button
                    type="button"
                    onClick={handlePrev}
                    aria-label="Previous slide"
                    className="rounded-full border border-white/80 bg-white/85 p-2 text-[#013300] shadow-sm transition-colors duration-200 hover:bg-white"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    aria-label="Next slide"
                    className="rounded-full border border-white/80 bg-white/85 p-2 text-[#013300] shadow-sm transition-colors duration-200 hover:bg-white"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                </div>

                <div className="absolute bottom-0 left-0 right-0 rounded-b-3xl bg-linear-to-t from-[#013300]/78 via-[#013300]/35 to-transparent px-6 py-5">
                  <h3 className="text-lg font-bold text-white sm:text-xl md:text-2xl lg:text-2xl">
                    {"San Agustin Elementary School"}
                  </h3>
                  <h3 className="pb-2 text-xs font-normal text-white sm:text-sm md:text-base">
                    {landingContent?.saesDetails?.location || "San Agustin Elementary School"}
                  </h3>
                </div>

                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                  {HERO_IMAGES.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => goToSlide(index)}
                      aria-label={`Go to slide ${index + 1}`}
                      className={`h-2.5 w-2.5 rounded-full transition-all duration-300 transform hover:scale-125 ${index === currentSlide ? "bg-white scale-125" : "bg-white/50 hover:bg-white/80"
                        }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* About & Features Section (Scaled & Balanced) */}
      <section
        ref={aboutRef}
        id="about"
        className="relative px-4 py-12 md:px-8 md:py-20 lg:px-12 lg:py-24 bg-linear-to-b from-transparent via-green-50/30 to-transparent"
      >
        <div className="mx-auto max-w-7xl">
          <div data-nav-anchor="true" className="flex flex-col lg:flex-row lg:items-center gap-12 lg:gap-16">

            {/* Mission / About Left Column */}
            <div
              ref={missionRef}
              id="mission"
              className={`lg:order-2 lg:w-5/12 transition-all duration-1000 transform ${isSectionVisible('mission') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
                }`}
            >
              <h2 className="mb-6 text-center text-3xl font-extrabold leading-tight text-[#013300] sm:text-left md:text-4xl lg:text-5xl">
                Transforming Remedial Education
              </h2>
              <p className="
                mb-1 text-sm text-green-900 leading-relaxed
                transition-all duration-700 delay-800 transform
                translate-y-0 opacity-100
                text-center sm:text-left
                md:mb-2 md:text-lg
                lg:mb-10 lg:text-xl
              ">
                Our mission is to enhance the San Agustin Elementary School remedial program by providing teachers with a centralized system that tracks student performance, manages materials, and uses AI-driven remedial to support student learning.
              </p>
            </div>

            {/* Key Features Right Column (2x2 Grid) */}
            <div
              ref={featuresRef}
              id="features"
              className="mt-8 grid grid-cols-2 gap-2 sm:gap-6 md:gap-8 lg:order-1 lg:mt-0 lg:w-7/12"
            >
              {[
                {
                  icon: Database,
                  hoverIcon: DatabaseZap,
                  title: "Centralized Repository",
                  desc: "Manage all your remedial materials securely in one unified platform."
                },
                {
                  icon: ChartLine,
                  hoverIcon: FileChartLine,
                  title: "Tracking Performance",
                  desc: "Seamlessly record and track student progress in literacy and numeracy."
                },
                {
                  icon: BrainCircuit,
                  hoverIcon: Bot,
                  title: <>AI-Driven <br /> Remedial</>,
                  desc: "Get smart recommendations to easily identify student learning gaps."
                },
                {
                  icon: ClipboardCheck,
                  hoverIcon: ClipboardList,
                  title: <>Interactive <br /> Quizzes</>,
                  desc: "Create digital quizzes to make student learning more engaging."
                }
              ].map((feature, index) => (
                <div
                  key={index}
                  className={`
                    group relative flex h-full flex-col rounded-xl bg-white p-3
                    border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)]
                    transition-all duration-500 ease-out 
                    hover:-translate-y-2 hover:shadow-[0_12px_40px_rgba(1,51,0,0.08)] hover:border-green-100/60
                    sm:rounded-3xl sm:p-6
                    ${isSectionVisible('features') ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}
                  `}
                  style={{ transitionDelay: `${isSectionVisible('features') ? index * 120 : 0}ms` }}
                >
                  {(() => {
                    const Icon = feature.icon;
                    const HoverIcon = feature.hoverIcon;
                    return (
                      <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:items-start sm:gap-4 sm:text-left">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-green-100 bg-green-50/70 transition-colors duration-500 group-hover:bg-green-100/70 sm:h-16 sm:w-16 sm:rounded-2xl">
                          <div className="relative h-5 w-5 sm:h-8 sm:w-8">
                            <Icon
                              className="absolute inset-0 h-5 w-5 text-[#013300] transition-all duration-300 group-hover:scale-90 group-hover:opacity-0 sm:h-8 sm:w-8"
                              strokeWidth={2}
                            />
                            <HoverIcon
                              className="absolute inset-0 h-5 w-5 scale-90 text-green-800 opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100 sm:h-8 sm:w-8"
                              strokeWidth={2}
                            />
                          </div>
                        </div>

                        <h3 className="text-sm font-bold leading-tight text-[#013300] transition-colors duration-300 group-hover:text-green-800 sm:pt-1 sm:text-xl">
                          {feature.title}
                        </h3>
                      </div>
                    );
                  })()}

                  <p className="mt-2 text-center text-[11px] leading-snug text-green-800 opacity-90 transition-colors duration-300 group-hover:text-[#013300] sm:mt-5 sm:text-left sm:text-base sm:leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* Quiz Section */}
      <section
        ref={mobileRef}
        id="mobile"
        className="px-6 py-12 md:px-8 md:py-16 lg:px-12 lg:py-20"
      >
        <div data-nav-anchor="true" className="mb-12 md:mb-16">
          <div
            className="mx-auto flex max-w-sm flex-col items-center gap-8 md:hidden"
          >
            <div className="relative shrink-0">
              <div className={`
                absolute -top-8 -left-10 h-56 w-56 rounded-full bg-green-100/45 z-0
                transition-all duration-1000 delay-300
                ${isSectionVisible('mobile') ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}
              `}></div>

              <div className={`
                absolute -bottom-8 -right-10 h-48 w-48 rounded-full bg-green-100/35 z-0
                transition-all duration-1000 delay-500
                ${isSectionVisible('mobile') ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}
              `}></div>

              <div className={`
                absolute top-1/2 -right-12 h-40 w-40 rounded-full bg-green-50/65 transform -translate-y-1/2 z-0
                transition-all duration-1000 delay-700
                ${isSectionVisible('mobile') ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}
              `}></div>

              <Image
                width={200}
                height={400}
                src="/RPT-SAES/RPT-SAES Mobile.png"
                alt="Quiz Mobile"
                className={`
                  relative z-10 w-48 min-[380px]:w-52
                  transition-all duration-800 delay-900 transform
                  ${isSectionVisible('mobile') ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95'}
                `}
              />
            </div>

            <div
              className={`
              relative z-20 flex w-full max-w-sm flex-col items-center text-center
              transition-all duration-800 delay-200
              ${isSectionVisible('mobile') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}
            `}
            >
              <div
                className={`
                  mb-5 flex items-center gap-3
                  transition-all duration-700 delay-400 transform
                  ${isSectionVisible('mobile') ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-4 opacity-0 scale-95'}
                `}
              >
                <Image
                  src="/RPT-SAES/RPTLogo.png"
                  alt="RPT Portal Logo"
                  width={44}
                  height={44}
                  className="h-11 w-11 object-contain drop-shadow-md"
                />
                <span className="bg-gradient-to-r from-green-700 to-green-900 bg-clip-text text-2xl font-bold text-transparent">
                  RPT Portal
                </span>
              </div>
              <h3
                className="mb-5 text-4xl font-extrabold leading-[0.92] text-[#013300] min-[380px]:text-[2.6rem]"
              >
                Innovation
                <br /> in Your Hands
              </h3>
              <p
                className={`
                max-w-sm text-base text-green-900 leading-relaxed
                transition-all duration-700 delay-800 transform
                ${isSectionVisible('mobile') ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}
                text-center
              `}
              >
                Manage remedial programs and
                track student progress directly from your phone.
              </p>
              <div
                className={`
                  mt-5 w-full max-w-[18rem]
                  ${isSectionVisible('mobile') ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-6 opacity-0 scale-95'}
                `}
              >
                <Link
                  href="/PWA"
                  className="flex w-full items-center justify-center rounded-xl bg-[#013300] px-6 py-3.5 text-base font-semibold text-white transition-colors duration-200 hover:bg-[#014a1f]"
                >
                  <svg
                    className="mr-2 h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
                    />
                  </svg>
                  Install RPT-SAES
                </Link>
              </div>
            </div>
          </div>

          <div
            className="hidden md:flex md:flex-row md:items-center md:justify-center md:gap-12 lg:gap-16"
          >
            <div className="shrink-0 relative">
              <div className={`
                absolute -top-12 -left-12 w-64 h-64 rounded-full bg-green-100/45 z-0
                md:-top-16 md:-left-16 md:w-96 md:h-96
                lg:-top-5 lg:-left-20 lg:w-92 lg:h-92
                transition-all duration-1000 delay-300
                ${isSectionVisible('mobile') ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}
              `}></div>

              <div className={`
                absolute -bottom-12 -right-12 w-60 h-60 rounded-full bg-green-100/35 z-0
                md:-bottom-16 md:-right-16 md:w-80 md:h-80
                lg:-bottom-2 lg:-right-12 lg:w-96 lg:h-96
                transition-all duration-1000 delay-500
                ${isSectionVisible('mobile') ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}
              `}></div>

              <div className={`
                absolute top-1/2 -right-14 w-52 h-52 rounded-full bg-green-50/65 transform -translate-y-1/2 z-0
                md:-right-20 md:w-72 md:h-72
                lg:-right-8 lg:w-80 lg:h-80
                transition-all duration-1000 delay-700
                ${isSectionVisible('mobile') ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}
              `}></div>

              <Image
                width={200}
                height={400}
                src="/RPT-SAES/RPT-SAES Mobile.png"
                alt="Quiz Mobile"
                className={`
                  w-56 relative z-10 md:w-72 lg:w-80
                  transition-all duration-800 delay-900 transform
                  ${isSectionVisible('mobile') ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95'}
                `}
              />
            </div>

            <div
              className={`
              flex flex-col items-center text-center relative z-20
              md:items-start md:text-left 
              transition-all duration-800 delay-200
              ${isSectionVisible('mobile') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}
            `}
            >
              <div
                className={`
                  mb-6 flex items-center gap-4
                  transition-all duration-700 delay-400 transform
                  ${isSectionVisible('mobile') ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-4 opacity-0 scale-95'}
                `}
              >
                <Image
                  src="/RPT-SAES/RPTLogo.png"
                  alt="RPT Portal Logo"
                  width={64}
                  height={64}
                  className="h-16 w-16 object-contain drop-shadow-md"
                />
                <span className="bg-gradient-to-r from-green-700 to-green-900 bg-clip-text text-5xl font-bold text-transparent">
                  RPT Portal
                </span>
              </div>
              <h3
                className="text-3xl font-extrabold text-[#013300] mb-6 leading-tight md:text-4xl lg:text-5xl"
              >
                Innovation
                <br className="hidden md:block" /> in Your Hands
              </h3>
              <p
                className={`
                mb-1 text-sm text-green-900 leading-relaxed
                transition-all duration-700 delay-800 transform
                ${isSectionVisible('mobile') ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}
                text-left
                md:mb-6 md:text-lg
                lg:mb-10 lg:text-xl
              `}
              >
                Manage remedial programs and
                <br className="hidden md:block" /> track student progress directly from your phone.
              </p>
              <div
                className={`
                  mt-2 md:mt-4
                  ${isSectionVisible('mobile') ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-6 opacity-0 scale-95'}
                `}
              >
                <Link
                  href="/PWA"
                  className="flex items-center justify-center rounded-xl bg-[#013300] px-6 py-3 text-base font-semibold text-white transition-colors duration-200 hover:bg-[#014a1f] md:px-8 md:py-3 md:text-lg"
                >
                  <svg
                    className="w-5 h-5 mr-2 md:w-6 md:h-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
                    />
                  </svg>
                  Install RPT-SAES
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Location Section - Modern Flat UI */}
      <section
        ref={locationRef}
        id="location"
        className="relative px-6 py-16 md:px-8 md:py-20 lg:px-12 lg:py-24 bg-linear-to-b from-transparent via-green-50/30 to-transparent"
      >
        <div className="mx-auto max-w-7xl">
          <div
            data-nav-anchor="true"
            className="grid grid-cols-1 gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-14"
          >
            <div
              className={`lg:order-1 transition-all duration-1000 delay-150 transform ${
                isSectionVisible('location') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
            >
              <div className="overflow-hidden rounded-[2rem] border border-green-100 bg-white">
                <iframe
                  title="San Agustin Elementary School Location"
                  src="https://www.google.com/maps?q=San%20Agustin%20Elementary%20School%2C%20G%2C%20P2HP%2B8QG%2C%200%20Susano%20Rd%2C%20Novaliches%2C%20Quezon%20City%2C%20Metro%20Manila%2C%20Philippines&output=embed"
                  className="h-[360px] w-full border-0 grayscale-[12%] transition-all duration-500 hover:grayscale-0 md:h-[450px]"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
            </div>

            <div
              className={`lg:order-2 flex flex-col justify-center transition-all duration-1000 transform ${
                isSectionVisible('location') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
            >
              <h2 className="mt-5 text-center text-3xl font-extrabold leading-[0.98] text-[#013300] sm:text-left md:text-4xl lg:text-[3.5rem]">
                Visit Our Campus
              </h2>
              <p className="mt-5 mx-auto max-w-xl text-sm leading-relaxed text-green-900 text-center sm:mx-0 sm:text-left md:text-lg lg:text-xl">
                We are conveniently located in the heart of Novaliches. Come visit San Agustin
                Elementary School and see where the learning happens.
              </p>

              <div className="mt-4 overflow-hidden rounded-[2rem] border border-gray-100 bg-white">
                <div className="px-5 py-4 md:px-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f4f8f5] text-[#013300]">
                      <MapPinned className="h-6 w-6" strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700/80">
                        Campus Address
                      </p>
                      <h3 className="mt-2 text-[1.75rem] font-bold leading-tight text-[#013300]">
                        San Agustin Elementary School
                      </h3>
                      <p className="mt-2 text-base leading-relaxed text-green-800/90">
                        Heavenly Drive St., San Agustin,
                        <br />
                        Novaliches, Quezon City
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid border-t border-gray-100 sm:grid-cols-2">
                  <div className="px-5 py-4 md:px-5 sm:border-r sm:border-gray-100">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f4f8f5] text-[#013300]">
                        <Clock3 className="h-[18px] w-[18px]" strokeWidth={2} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700/80">
                          Office Hours
                        </p>
                        <p className="mt-2 text-base font-bold text-[#013300] md:text-lg">Monday to Friday</p>
                        <p className="mt-1 text-sm text-green-900/80">8:00 AM to 5:00 PM</p>
                      </div>
                    </div>
                  </div>

                  <a
                    href="https://www.google.com/maps/search/?api=1&query=San+Agustin+Elementary+School+Novaliches+Quezon+City"
                    target="_blank"
                    rel="noreferrer"
                    className="group border-t border-gray-100 px-5 py-4 transition-colors duration-300 hover:bg-[#fbfdfb] sm:border-t-0 md:px-5"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f4f8f5] text-[#013300] transition-colors duration-300 group-hover:bg-green-100/80">
                        <Navigation className="h-[18px] w-[18px]" strokeWidth={2} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700/80">
                          Directions
                        </p>
                        <p className="mt-2 text-base font-bold text-[#013300] md:text-lg">Get Directions</p>
                        <p className="mt-1 text-sm text-green-900/80">
                          Open in Google Maps.
                        </p>
                      </div>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        ref={contactsRef}
        id="contacts"
        className="relative px-6 py-16 md:px-8 md:py-20 lg:px-12 lg:py-24 bg-linear-to-b from-transparent via-green-50/30 to-transparent"
      >
        <div className="mx-auto max-w-7xl">
          <div
            data-nav-anchor="true"
            className="grid grid-cols-1 gap-10 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:gap-16"
          >
            <div
              className={`transition-all duration-1000 transform ${
                isSectionVisible("contacts") ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
              }`}
            >
              <h2 className="mt-6 text-center text-3xl font-extrabold leading-tight text-[#013300] sm:text-left md:text-4xl lg:text-5xl">
                Let&apos;s Connect
              </h2>
              <p className="mt-5 mx-auto max-w-2xl text-sm leading-relaxed text-green-900 text-center sm:mx-0 sm:text-left md:text-lg lg:text-xl">
                Reach out for school concerns, remedial updates, or general inquiries about
                RPT-SAES.
              </p>
            </div>

            <div
              className={`flex flex-col gap-4 transition-all duration-1000 delay-150 transform ${
                isSectionVisible("contacts") ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
              }`}
            >
              {contactMethods.map((contact) => (
                (() => {
                  const Icon = contact.icon;
                  return (
                    <a
                      key={contact.label}
                      href={contact.href}
                      target={contact.external ? "_blank" : undefined}
                      rel={contact.external ? "noreferrer" : undefined}
                      className="group flex items-start gap-3 rounded-[1.25rem] border border-gray-100 bg-white px-4 py-4 transition-all duration-300 hover:-translate-y-1 hover:border-green-100 sm:gap-5 sm:rounded-[1.75rem] sm:px-6 sm:py-6"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f0f7f3] text-[#013300] transition-colors duration-300 group-hover:bg-green-100/80 sm:h-14 sm:w-14 sm:rounded-2xl">
                        <Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2} />
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700/80">
                          {contact.label}
                        </p>
                        <p className="mt-2 break-all text-base font-bold leading-tight text-[#013300] sm:mt-3 sm:text-lg md:text-2xl">
                          {contact.value}
                        </p>
                        <p className="mt-2 text-xs leading-relaxed text-green-900/75 sm:mt-3 sm:text-sm">
                          {contact.description}
                        </p>
                      </div>
                    </a>
                  );
                })()
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Gradient Transition Section */}
      <div className={`pointer-events-none h-24 w-full bg-linear-to-b from-transparent to-white/70 transition-opacity duration-1000 ${mounted ? 'opacity-100' : 'opacity-0'
        }`} />

      <Footer schoolDetails={landingContent?.saesDetails} />
    </div>
  );
}

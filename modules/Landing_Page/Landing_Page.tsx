"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
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

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [landingContent, setLandingContent] = useState<LandingContent | null>(null);
  const [visibleSections, setVisibleSections] = useState({
    hero: false,
    about: false,
    mission: false,
    features: false,
    mobile: false,
    location: false,
  });
  
  const heroRef = useRef(null);
  const aboutRef = useRef(null);
  const missionRef = useRef(null);
  const featuresRef = useRef(null);
  const mobileRef = useRef(null);
  const locationRef = useRef(null);

  // Fetch landing page content from your existing API
  useEffect(() => {
    const fetchLandingContent = async () => {
      try {
        const response = await fetch("/api/super_admin/landing");
        if (!response.ok) {
          throw new Error(`Failed to load landing configuration (${response.status})`);
        }

        const result = await response.json();
        const normalized = normalizeLandingContent(result?.data);
        setLandingContent(normalized);
      } catch (error) {
        console.error('Failed to fetch landing content:', error);
        setLandingContent(createFallbackLandingContent());
      } finally {
        setMounted(true);
      }
    };

    fetchLandingContent();
  }, []);

  // Get hero images from API or use defaults
  const HERO_IMAGES = landingContent?.carouselImages
    .filter((img) => typeof img.dataUrl === "string" && img.dataUrl.length > 0)
    .map((img) => img.dataUrl as string) || DEFAULT_HERO_IMAGES;
  
  const slideCount = HERO_IMAGES.length;

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
    }, 100);

    return () => {
      clearInterval(timer);
      observer.disconnect();
    };
  }, [mounted, slideCount]);

  const goToSlide = (index: number) => {
    setCurrentSlide((index + slideCount) % slideCount);
  };

  const handlePrev = () => {
    goToSlide(currentSlide - 1);
  };

  const handleNext = () => {
    goToSlide(currentSlide + 1);
  };

  // Helper function to determine if section should be visible
  const isSectionVisible = (section: string) => {
    return mounted && visibleSections[section as keyof typeof visibleSections];
  };
  return (
    <div className="relative min-h-screen overflow-hidden scroll-smooth bg-[#f6faf8] text-[#013300]">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(198,238,216,0.34),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(212,242,225,0.3),transparent_24%),linear-gradient(180deg,rgba(251,254,252,0.98),rgba(244,250,246,0.96))]" />
      <div className="pointer-events-none absolute left-[12%] right-[50%] top-36 -z-10 h-48 rounded-3xl bg-linear-to-br from-green-100/40 via-white/40 to-transparent blur-4xl" />
      <div className="pointer-events-none absolute left-[56%] right-[12%] bottom-12 -z-10 h-48 rounded-[36px] bg-linear-to-t from-green-100/35 via-white/35 to-transparent blur-4xl" />
      
      {/* Navbar - Responsive Organization */}
      <header className={`fixed inset-x-0 top-4 z-30 flex justify-center px-2 transition-all duration-500 ${
        mounted ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
      }`}>
        <div className="w-[90%] max-w-8xl rounded-full border border-white/80 bg-white/78 px-5 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.12)] backdrop-blur-xl md:px-8 md:py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
            <RPTLogoTitle small />
          </div>
          <nav className="hidden md:ml-auto md:flex md:items-center md:gap-8 lg:gap-12">
            {NAV_LINKS.map((item, index) => (
              <Link
                key={item.label}
                href={item.href}
                scroll={!item.isRoute}
                className={`
                  rounded-full px-2 py-1 text-base font-semibold text-slate-700 transition-colors duration-200 hover:text-[#013300]
                  md:text-[15px] lg:text-base
                  ${mounted ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}
                `}
                style={{ transitionDelay: `${index * 100 + 200}ms` }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main
        ref={heroRef}
        id="home"
        className="relative overflow-hidden px-6 py-8 pt-28 md:px-8 md:py-12 md:pt-32 lg:px-12 lg:py-16"
      >
        {/* Soft gradients behind the hero */}
        <div className="absolute inset-x-0 top-12 h-96 bg-linear-to-br from-green-50 via-white to-green-50/60 opacity-80 blur-3xl" />
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-linear-to-br from-green-100/35 to-green-50/25 blur-2xl" />
        <div className="absolute bottom-0 -left-16 h-56 w-56 rounded-full bg-green-100/35 blur-2xl" />

        <div className="relative max-w-7xl mx-auto py-8 grid md:gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:py-16 lg:gap-15">
          {/* Text Content */}
          <div
            className={`
            w-full flex flex-col justify-center items-center text-center lg:-ml-12
            transition-all duration-700 transform
            ${mounted ? 'translate-x-0 opacity-100 scale-100' : '-translate-x-8 opacity-0 scale-95'}
            sm:items-start sm:text-left
            `}
            style={{ minHeight: "350px" }}
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
              <span className="text-lg font-semibold text-[#013300] md:text-xl lg:text-2xl">
                San Agustin Elementary School
              </span>
            </div>
            <p className="text-lg pb-5 md:text-xl font-medium opacity-90">
              Welcome to <span className="font-semibold">RPT-SAES</span>
            </p>
            <h1
              className="text-3xl font-extrabold text-[#013300] mb-6 leading-tight md:text-4xl lg:text-5xl"
            >
              Transforming Remedial
              <br />
              Learning with Technology
            </h1>
            <p
              className={`
              text-base text-green-900 mb-2 md:text-lg md:mb-2 lg:text-xl lg:mb-2
              transition-all duration-800 delay-300 transform
              ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}
              text-center sm:text-left
            `}
            >
              An innovative platform designed to support teachers in managing and tracking student progress in remedial programs.
            </p>
            <div className={`flex flex-wrap gap-4 mt-4 transition-all duration-800 delay-500 transform ${
              mounted ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-6 opacity-0 scale-95'
            } items-center sm:items-start w-full`}>
              <Link href="/auth/login" className="
                flex items-center justify-center rounded-xl bg-[#013300] pl-4 pr-2 py-2 text-base font-semibold text-white transition-colors duration-200 hover:bg-[#014a1f]
                md:pl-4 md:py-3 md:text-lg lg:text-xl
                w-full sm:w-auto sm:justify-start
              ">
                Get Started
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 ml-2 md:w-6 md:h-6">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </Link>
            </div>
          </div>

          {/* Image Carousel with Caption */}
          <div
            className={`
            w-full mt-4 lg:w-[120%] lg:mt-0 lg:-ml-20
            transition-all duration-800 delay-400 transform
            ${mounted ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-8 opacity-0 scale-95'}
          `}
          >
            <div className="relative isolate">
              <div className="relative overflow-hidden rounded-3xl border border-gray-200/80 bg-white/85 shadow-[0_16px_36px_rgba(15,23,42,0.10)]">
                <div className="relative h-100 md:h-120 lg:h-125">
                  {HERO_IMAGES.map((src, index) => (
                    <div
                      key={src}
                      className={`absolute inset-0 transition-all duration-700 ease-out ${
                        index === currentSlide ? "opacity-100 scale-100" : "opacity-0 scale-105 pointer-events-none"
                      }`}
                    >
                      <Image
                        src={src}
                        alt={`San Agustin Elementary School campus view ${index + 1}`}
                        fill
                        priority={index === 0}
                        className="object-cover transition-transform duration-700 ease-out hover:scale-[1.02]"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1600px"
                      />
                    </div>
                  ))}
                </div>

                <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-4">
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
                <h3 className="text-2xl font-bold text-white md:text-2xl lg:text-2xl">
                  {"San Agustin Elementary School"}
                </h3>
                  <h3 className="text-md font-base text-white pb-2">
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
                      className={`h-2.5 w-2.5 rounded-full transition-all duration-300 transform hover:scale-125 ${
                        index === currentSlide ? "bg-white scale-125" : "bg-white/50 hover:bg-white/80"
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
        className="relative px-6 py-16 md:px-8 md:py-20 lg:px-12 lg:py-24 bg-linear-to-b from-transparent via-green-50/30 to-transparent"
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col lg:flex-row lg:items-center gap-12 lg:gap-16">
            
            {/* Mission / About Left Column */}
            <div 
              ref={missionRef} 
              id="mission"
              className={`lg:w-5/12 transition-all duration-1000 transform ${
                isSectionVisible('mission') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
            >
              <h2 className="text-3xl font-extrabold text-left text-[#013300] mb-6 leading-tight md:text-4xl lg:text-5xl">
                Transforming Remedial Education
              </h2>
              <p className="text-base text-green-900 mb-6 md:text-lg md:mb-6
                transition-all duration-700 delay-800 transform
                translate-y-0 opacity-100
              ">
                Our mission is to enhance the San Agustin Elementary School remedial program by providing teachers with a centralized system that tracks student performance, manages materials, and uses AI-driven analysis to support student learning.
              </p>
            </div>

            {/* Key Features Right Column (2x2 Grid) */}
            <div 
              ref={featuresRef}
              id="features"
              className="lg:w-7/12 grid grid-cols-1 gap-6 sm:grid-cols-2 md:gap-8 mt-8 lg:mt-0"
            >
              {[
                {
                  defaultIcon: "/Landing_Cards/1A.png",
                  hoverIcon: "/Landing_Cards/1B.png",
                  title: "Centralized Repository",
                  desc: "Manage all your remedial materials securely in one unified platform."
                },
                {
                  defaultIcon: "/Landing_Cards/2A.png",
                  hoverIcon: "/Landing_Cards/2B.png",
                  title: "Tracking Performance",
                  desc: "Seamlessly record and track student progress in literacy and numeracy."
                },
                {
                  defaultIcon: "/Landing_Cards/3A.png",
                  hoverIcon: "/Landing_Cards/3B.png",
                  title: "AI-Driven Analysis",
                  desc: "Get smart recommendations to easily identify student learning gaps."
                },
                {
                  defaultIcon: "/Landing_Cards/4A.png",
                  hoverIcon: "/Landing_Cards/4B.png",
                  title: "Interactive Quizzes",
                  desc: "Create dynamic digital quizzes to make student learning more engaging."
                }
              ].map((feature, index) => (
                <div
                  key={index}
                  className={`
                    group relative flex flex-col items-start rounded-3xl bg-white p-6
                    border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)]
                    transition-all duration-500 ease-out 
                    hover:-translate-y-2 hover:shadow-[0_12px_40px_rgba(1,51,0,0.08)] hover:border-green-100/60
                    ${isSectionVisible('features') ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}
                  `}
                  style={{ transitionDelay: `${isSectionVisible('features') ? index * 120 : 0}ms` }}
                >
                  {/* Scaled Up Icon Block */}
                  <div className="mb-6 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-green-50 transition-colors duration-500 group-hover:bg-green-100/60">
                    <div className="relative h-8 w-8">
                      <Image
                        src={feature.defaultIcon}
                        alt={`${feature.title} icon`}
                        fill
                        className="object-contain transition-all duration-500 group-hover:opacity-0 group-hover:scale-90"
                      />
                      <Image
                        src={feature.hoverIcon}
                        alt={`${feature.title} icon highlighted`}
                        fill
                        className="absolute inset-0 object-contain opacity-0 scale-90 transition-all duration-500 group-hover:opacity-100 group-hover:scale-100"
                      />
                    </div>
                  </div>
                  
                  {/* Restored Typography Size */}
                  <h3 className="mb-3 text-xl font-bold text-[#013300] leading-tight transition-colors duration-300 group-hover:text-green-800">
                    {feature.title}
                  </h3>
                  
                  <p className="text-base leading-relaxed text-green-800 opacity-90 transition-colors duration-300 group-hover:text-[#013300]">
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
        <div className="mb-12 md:mb-16">
          <div className="flex flex-col items-center justify-center gap-8 md:flex-row md:gap-12 lg:gap-16">
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
              <Image
                width={200}
                height={200}
                src="/RPT-SAES/RPT-SAES Full Logo.png"
                alt="Quiz Logo"
                className={`
                  w-48 mb-6 md:w-56 md:mb-8 lg:w-90 lg:mb-0
                  transition-all duration-700 delay-400 transform
                  ${isSectionVisible('mobile') ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}
                `}
              />
              <h3
                className="text-3xl font-extrabold text-[#013300] mb-6 leading-tight md:text-4xl lg:text-5xl"
              >
                Innovation  
               <br className="hidden md:block" /> in Your Hands
              </h3>
              <p
                className={`
                text-base text-green-900 mb-6 md:text-lg md:mb-6
                transition-all duration-700 delay-800 transform
                ${isSectionVisible('mobile') ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}
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
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16 lg:items-center">
            
            {/* Left Column: Text & Details */}
            <div 
              className={`transition-all duration-1000 transform ${
                isSectionVisible('location') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
            >
              <h2 className="text-3xl font-extrabold text-[#013300] mb-6 leading-tight md:text-4xl lg:text-5xl">
                Visit Our Campus
              </h2>
              <p className="text-base text-green-900 mb-6 md:text-lg md:mb-6
                transition-all duration-700 delay-800 transform
                translate-y-0 opacity-100">
                We are conveniently located in the heart of Novaliches. Come visit San Agustin Elementary School and see where the learning happens.
              </p>

              {/* Address Card (Flat UI Style) */}
              <div className="inline-flex flex-col sm:flex-row items-start sm:items-center gap-6 rounded-[2rem] bg-white px-8 py-6 border border-green-50 transition-transform duration-300 hover:-translate-y-1 w-full sm:w-auto">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#f0f7f3] text-[#013300]">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                    <path fillRule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#013300] mb-1.5">San Agustin Elementary School</h3>
                  <p className="text-base text-green-800 leading-relaxed opacity-90">
                    Heavenly Drive St., San Agustin,<br />
                    Novaliches, Quezon City
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Map (Flat UI Cutout) */}
            <div 
              className={`relative h-[350px] w-full overflow-hidden rounded-[2.5rem] bg-green-50 md:h-[450px] transition-all duration-1000 delay-200 transform ${
                isSectionVisible('location') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
            >
              <iframe
                title="San Agustin Elementary School Location"
                src="https://www.google.com/maps?q=San%20Agustin%20Elementary%20School%2C%20G%2C%20P2HP%2B8QG%2C%200%20Susano%20Rd%2C%20Novaliches%2C%20Quezon%20City%2C%20Metro%20Manila%2C%20Philippines&output=embed"
                className="absolute inset-0 h-full w-full border-0 grayscale-[20%] transition-all duration-500 hover:grayscale-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>

          </div>
        </div>
      </section>

      {/* Gradient Transition Section */}
      <div className={`pointer-events-none h-24 w-full bg-linear-to-b from-transparent to-white/70 transition-opacity duration-1000 ${
        mounted ? 'opacity-100' : 'opacity-0'
      }`} />
      
      <Footer schoolDetails={landingContent?.saesDetails} />
    </div>
  );
}

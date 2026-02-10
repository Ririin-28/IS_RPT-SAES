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
    mobile: false
  });
  
  const heroRef = useRef(null);
  const aboutRef = useRef(null);
  const missionRef = useRef(null);
  const featuresRef = useRef(null);
  const mobileRef = useRef(null);

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
    <div className="min-h-screen text-[#013300] relative overflow-hidden scroll-smooth">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(209,255,222,0.45),transparent_16%),radial-gradient(circle_at_bottom_right,rgba(188,240,214,0.35),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,249,245,0.95))]" />
      <div className="pointer-events-none absolute left-[12%] right-[46%] top-40 -z-10 h-56 rounded-3xl bg-linear-to-br from-green-200/30 via-white/40 to-transparent blur-4xl" />
      <div className="pointer-events-none absolute left-[52%] right-[12%] bottom-16 -z-10 h-56 rounded-[40px] bg-linear-to-t from-green-100/45 via-white/35 to-transparent blur-4xl" />
      
      {/* Navbar - Responsive Organization */}
      <header className={`fixed top-0 left-0 w-full z-30 bg-white shadow-md scroll-smooth transition-all duration-500 ${
        mounted ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
      }`}>
        <div className="flex items-center justify-between px-6 py-4 md:px-8 md:py-4 md:justify-center md:relative lg:px-10">
          <div className="flex items-center gap-3 md:absolute md:left-8 lg:left-10">
            <RPTLogoTitle small />
          </div>
          <nav className="hidden md:flex md:gap-10 lg:gap-16">
            {NAV_LINKS.map((item, index) => (
              <Link
                key={item.label}
                href={item.href}
                scroll={!item.isRoute}
                className={`
                  font-bold text-[#013300] hover:text-green-800 transition-all duration-300 transform hover:scale-105
                  md:text-lg lg:text-lg
                  ${mounted ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}
                `}
                style={{ transitionDelay: `${index * 100 + 200}ms` }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main
        ref={heroRef}
        id="home"
        className="relative pt-24 px-6 py-8 overflow-hidden md:pt-28 md:px-8 md:py-12 lg:pt-20 lg:px-12"
      >
        {/* Soft gradients behind the hero */}
        <div className="absolute inset-x-0 top-12 h-105 bg-linear-to-br from-green-100 via-white to-green-50 blur-3xl opacity-70" />
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-linear-to-br from-green-500/20 to-green-300/10 blur-2xl" />
        <div className="absolute bottom-0 -left-20 h-64 w-64 rounded-full bg-green-200/30 blur-2xl" />

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
              className={`
              text-3xl font-extrabold text-[#013300] mb-4 leading-tight
              md:text-4xl md:mb-5 lg:text-5xl
              transition-all duration-800 delay-200 transform
              ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}
              text-center sm:text-left
            `}
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
                flex items-center justify-center pl-4 pr-2 py-2 bg-[#013300] text-white text-base font-bold rounded-lg hover:bg-green-900 transition-all duration-300 transform hover:scale-105
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
              <div className="relative overflow-hidden rounded-4xl border border-green-100/60 bg-white/70 shadow-[0_25px_50px_rgba(1,51,0,0.12)] backdrop-blur">
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
                    className="rounded-full bg-white/80 p-2 text-[#013300] shadow hover:bg-white transition-all duration-300 transform hover:scale-110"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    aria-label="Next slide"
                    className="rounded-full bg-white/80 p-2 text-[#013300] shadow hover:bg-white transition-all duration-300 transform hover:scale-110"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                </div>

                <div className="absolute bottom-0 left-0 right-0 px-6 py-5 bg-linear-to-t from-[#013300]/90 via-[#013300]/50 to-transparent rounded-b-4xl">
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

      {/* About Section - With Feature Cards */}
      <section
        ref={aboutRef}
        id="about"
        className="px-6 py-16 md:px-8 md:py-20 lg:px-12 lg:py-24"
      >
        <div className="mb-12 w-full max-w-6xl mx-auto px-4 md:mb-16">
          <h2
            className={`
            text-3xl font-extrabold text-[#013300] mb-4 text-center leading-tight
            md:text-4xl md:mb-5 lg:text-5xl
            transition-all duration-800 delay-200 transform
            ${isSectionVisible('about') ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}
          `}
          >
            About RPT-SAES
          </h2>

          {/* Mission Section with Animated Circles */}
          <div ref={missionRef} id="mission" className="relative mt-16 mb-20 max-w-4xl mx-auto">
            <h3
              className={`text-2xl font-semibold text-[#013300] mb-6 text-center md:text-3xl transition-all duration-700 delay-200 transform ${
                isSectionVisible("mission") ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
              }`}
            >
            </h3>
            
            <div className={`
              absolute -left-20 top-1/2 -translate-y-1/2 w-40 h-40 rounded-full
              bg-linear-to-br from-green-500/20 to-green-300/10 blur-2xl
              transition-all duration-1000 delay-300
              ${isSectionVisible('mission') ? 'translate-x-0 opacity-100 scale-100' : '-translate-x-20 opacity-0 scale-50'}
            `}></div>
            
            <div className={`
              absolute -right-20 top-1/2 -translate-y-1/2 w-40 h-40 rounded-full
              bg-linear-to-br from-green-300/15 to-green-100/25 blur-2xl
              transition-all duration-1000 delay-500
              ${isSectionVisible('mission') ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-20 opacity-0 scale-50'}
            `}></div>

            <div className="relative z-10">
              <div className={`
                bg-linear-to-r from-green-50/60 to-green-100/40 
                border border-green-100/40 rounded-3xl
                backdrop-blur-sm
                transition-all duration-800 delay-700
                ${isSectionVisible('mission') ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
              `}>
                <p className={`
                  text-green-900 leading-relaxed text-lg px-6 py-8 text-center
                  md:text-xl md:px-10 md:py-10
                  transition-all duration-700 delay-900
                  ${isSectionVisible('mission') ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
                `}>
                  Our mission is to enhance the San Agustin Elementary School remedial program by providing teachers with a centralized system that tracks student performance, manages materials, and uses AI-driven analysis to support student learning.
                </p>
              </div>
            </div>
          </div>
          
          {/* Key Features Title */}
          <div ref={featuresRef} id="features" className="mt-16">
            <h3 className={`
              text-2xl font-semibold text-[#013300] mb-8 text-center
              md:text-3xl md:mb-12
              transition-all duration-700 delay-200 transform
              ${isSectionVisible('features') ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}
            `}>
              Key Features
            </h3>
          </div>
          
          {/* Feature Cards Section */}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4 md:gap-8">
            {[
              {
                defaultIcon: "/Landing_Cards/1A.png",
                hoverIcon: "/Landing_Cards/1B.png",
                title: "Centralized Repository",
                desc: "A unified platform where teachers can manage all remedial materials in one place."
              },
              {
                defaultIcon: "/Landing_Cards/2A.png",
                hoverIcon: "/Landing_Cards/2B.png",
                title: "Tracking Student Performance",
                desc: "Tracks student progress in literacy and numeracy to record students performance."
              },
              {
                defaultIcon: "/Landing_Cards/3A.png",
                hoverIcon: "/Landing_Cards/3B.png",
                title: "AI-Driven Analysis",
                desc: "Smart recommendations that help teachers identify learning gaps of students."
              },
              {
                defaultIcon: "/Landing_Cards/4A.png",
                hoverIcon: "/Landing_Cards/4B.png",
                title: "Interactive Quiz",
                desc: "Engaging digital quizzes that make learning of students interactive and dynamic."
              }
            ].map((feature, index) => (
              <div
                key={index}
                className={`
                  group relative bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-green-100/60 
                  shadow-[0_8px_32px_rgba(1,51,0,0.08)] hover:shadow-[0_20px_50px_rgba(1,51,0,0.15)]
                  transition-all duration-300 ease-out cursor-pointer
                  flex flex-col items-center text-center
                  hover:bg-linear-to-br hover:from-green-50 hover:to-white
                  hover:border-green-200/80
                  min-h-70 md:min-h-75 lg:min-h-80
                  transform
                  ${isSectionVisible('features') ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}
                `}
                style={{ transitionDelay: `${isSectionVisible('features') ? 300 + index * 150 : 0}ms` }}
              >
                <div className="
                  flex flex-col items-center justify-center h-full
                  group-hover:opacity-0 group-hover:scale-90
                  transition-all duration-300 ease-out
                ">
                  <Image
                    src={feature.defaultIcon}
                    alt={`${feature.title} icon`}
                    width={80}
                    height={80}
                    className="w-20 h-20 object-contain mb-6"
                  />
                  
                  <h4 className="
                    font-bold text-[#013300] text-xl leading-tight px-2
                  ">
                    {feature.title}
                  </h4>
                </div>

                <div className="
                  absolute inset-0 p-8 flex flex-col items-center justify-center
                  opacity-0 scale-95
                  group-hover:opacity-100 group-hover:scale-100
                  transition-all duration-300 ease-out
                  pointer-events-none
                ">
                  <Image
                    src={feature.hoverIcon}
                    alt={`${feature.title} icon highlighted`}
                    width={72}
                    height={72}
                    className="w-16 h-16 object-contain mb-6"
                  />
                  
                  <h4 className="
                    font-bold text-[#013300] text-lg leading-tight mb-4 px-2
                    group-hover:text-green-800
                  ">
                    {feature.title}
                  </h4>
                  
                  <p className="
                    text-green-800 text-base leading-relaxed text-center
                    opacity-0 translate-y-2
                    group-hover:opacity-100 group-hover:translate-y-0
                    transition-all duration-300 delay-100
                    px-2
                  ">
                    {feature.desc}
                  </p>
                </div>

                <div className="
                  absolute inset-0 rounded-2xl
                  scale-100 group-hover:scale-105
                  transition-transform duration-300 ease-out
                  -z-10
                " />
              </div>
            ))}
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
                absolute -top-12 -left-12 w-64 h-64 rounded-full bg-green-700/10 z-0
                md:-top-16 md:-left-16 md:w-96 md:h-96
                lg:-top-5 lg:-left-20 lg:w-92 lg:h-92
                transition-all duration-1000 delay-300
                ${isSectionVisible('mobile') ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}
              `}></div>
              
              <div className={`
                absolute -bottom-12 -right-12 w-60 h-60 rounded-full bg-green-500/15 z-0
                md:-bottom-16 md:-right-16 md:w-80 md:h-80
                lg:-bottom-2 lg:-right-12 lg:w-96 lg:h-96
                transition-all duration-1000 delay-500
                ${isSectionVisible('mobile') ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}
              `}></div>
              
              <div className={`
                absolute top-1/2 -right-14 w-52 h-52 rounded-full bg-green-300/20 transform -translate-y-1/2 z-0
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
                className={`
                text-2xl font-extrabold text-[#013300] mb-5
                md:text-3xl lg:text-4xl
                transition-all duration-700 delay-600 transform
                ${isSectionVisible('mobile') ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}
              `}
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
                  className="
                    flex items-center justify-center px-6 py-3 bg-green-900 text-white text-base font-bold rounded-lg
                    hover:bg-green-800 transition md:px-8 md:py-3 md:text-lg
                  "
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

      {/* Gradient Transition Section */}
      <div className={`w-full h-32 bg-linear-to-b from-transparent to-white pointer-events-none transition-opacity duration-1000 ${
        mounted ? 'opacity-100' : 'opacity-0'
      }`} />
      
      <Footer schoolDetails={landingContent?.saesDetails} />
    </div>
  );
}
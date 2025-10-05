"use client";
import Image from "next/image";
import RPTLogoTitle from "@/components/Common/RPTLogoTitle";
import Link from "next/link";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import Footer from "@/components/Common/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-[#013300] relative overflow-hidden scroll-smooth">
       {/* Navbar - Responsive Organization */}
      <header className="fixed top-0 left-0 w-full z-30 bg-white shadow-md scroll-smooth">
        <div
          className="
          /* Mobile */
          flex items-center justify-between px-6 py-4
          
          /* Tablet */
          md:px-8 md:py-5 md:justify-center md:relative
          
          /* Desktop */
          lg:px-10
        "
        >
          <div className="flex items-center gap-3 md:absolute md:left-8 lg:left-10">
            <RPTLogoTitle small />
          </div>
          <nav
            className="
            /* Mobile  */
            hidden
            
            /* Tablet - show and adjust spacing */
            md:flex md:gap-10
            
            /* Desktop - wider spacing */
            lg:gap-16
          "
          >
            <Link
              href="#home"
              className="
              font-bold text-[#013300] hover:text-green-700
              /* Tablet */
              md:text-sm
              /* Desktop */
              lg:text-base
            "
            >
              Home
            </Link>
            <Link
              href="#about"
              className="
              font-bold text-[#013300] hover:text-green-700
              md:text-sm
              lg:text-base
            "
            >
              About
            </Link>
            <Link
              href="#mobile"
              className="
              font-bold text-[#013300] hover:text-green-700
              md:text-sm
              lg:text-base
            "
            >
              Mobile
            </Link>
            <Link
              href="#contacts"
              className="
              font-bold text-[#013300] hover:text-green-700
              md:text-sm
              lg:text-base
            "
            >
              Contacts
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main
        id="home"
        className="
        /* Mobile */
        pt-24= px-6 py-8
        
        /* Tablet */
        md:pt-28 md:px-8 md:py-12
        
        /* Desktop */
        lg:pt-20 lg:px-12
      "
      >
        <div
          className="
          /* Mobile */
          max-w-7xl mx-auto flex flex-col gap-6 py-8
          
          /* Desktop */
          lg:flex-row lg:gap-12 lg:py-16
        "
        >
          {/* Text Content */}
          <div
            className="
            /* Mobile */
            w-full flex flex-col justify-center items-start
            
            /* Desktop */
            lg:w-1/2 lg:-ml-12
          "
            style={{ minHeight: "350px" }}
          >
            <h2
              className="
              /* Mobile */
              text-xl text-[#013300] mb-3
              
              /* Tablet */
              md:text-2xl
              
              /* Desktop */
              lg:text-3xl
            "
            >
              Welcome to RPT-SAES
            </h2>
            <h1
              className="
              /* Mobile */
              text-3xl font-bold text-[#013300] mb-4 leading-tight
              
              /* Tablet */
              md:text-4xl md:mb-5
              
              /* Desktop */
              lg:text-5xl
            "
            >
              Transforming Remedial
              <br />
              Learning with Technology.
            </h1>
            <p
              className="
              /* Mobile */
              text-base text-green-900 mb-2
              
              /* Tablet */
              md:text-lg md:mb-2
              
              /* Desktop */
              lg:text-xl lg:mb-2
            "
            >
              An innovative platform designed to support teachers in managing and tracking student progress in remedial programs.
            </p>
            <div className="flex flex-wrap gap-4 mt-4">
              <Link href="/auth/login" className="inline-block">
                <UtilityButton>Get Started</UtilityButton>
              </Link>
            </div>
          </div>

          {/* Image with Caption */}
          <div
            className="
            /* Mobile */
            w-full mt-6
            
            /* Desktop */
            lg:w-[80%] lg:mt-0
          "
          >
            <div
              className="
              /* Mobile */
              relative rounded-xl overflow-hidden shadow-lg h-64 w-full
              
              /* Tablet */
              md:h-80
              
              /* Desktop */
              lg:h-[500px] lg:max-w-3xl lg:ml-auto
            "
            >
              <Image
                src="/SAES/SAESImg.png"
                alt="San Agustin Elementary School"
                width={1200}
                height={500}
                priority
                className="object-cover rounded-xl shadow-lg"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
              />
              <div
                className="
                /* Mobile */
                absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#013300]/90 to-transparent p-3
                
                /* Tablet */
                md:p-4
              "
              >
                <h3
                  className="
                  /* Mobile */
                  text-lg font-bold text-white
                  
                  /* Tablet */
                  md:text-xl
                "
                >
                  San Agustin Elementary School
                </h3>
                <p
                  className="
                  /* Mobile */
                  text-sm text-white/90
                  
                  /* Tablet */
                  md:text-base
                "
                >
                  Pioneering educational innovation
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* About Section - With "Our Mission" from redesign */}
      <section
        id="about"
        className="
        /* Mobile */
        px-6 py-16
        
        /* Tablet */
        md:px-8 md:py-20
        
        /* Desktop */
        lg:px-12 lg:py-24
      "
      >
        <div
          className="
          /* Mobile */
          mb-12 w-full max-w-4xl mx-auto px-4
          
          /* Tablet */
          md:mb-16
        "
        >
          <h2
            className="
            /* Mobile */
            text-3xl font-bold text-green-900 mb-4 text-center
            
            /* Tablet */
            md:text-4xl
          "
          >
            About RPT-SAES
          </h2>
          
          {/* Our Mission Section */}
          <div className="mt-12">
            <h3 className="
              /* Mobile */
              text-2xl font-semibold text-[#013300] mb-4
              
              /* Tablet */
              md:text-3xl
            ">
              Our Mission
            </h3>
            <p className="
              /* Mobile */
              text-green-900 leading-relaxed mb-6
              
              /* Tablet */
              md:text-lg
            ">
              RPT-SAES was created to revolutionize how educators track and manage student progress in remedial programs. Our platform simplifies literacy and numeracy program management, empowering teachers to provide personalized support for every student.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h4 className="font-semibold text-green-900">Centralized Repository of Remedial</h4>
                  <p className="mt-1 text-green-800">A unified platform where teachers can upload, organize, and access all remedial materials in one place.</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h4 className="font-semibold text-green-900">Interactive Quiz</h4>
                  <p className="mt-1 text-green-800">Engaging digital quizzes that make learning of students interactive and dynamic.</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h4 className="font-semibold text-green-900">AI-generated insights</h4>
                  <p className="mt-1 text-green-800">Smart recommendations that help teachers identify learning gaps of students.</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h4 className="font-semibold text-green-900">Tracking Student Performance</h4>
                  <p className="mt-1 text-green-800">Tracks student progress in literacy and numeracy to record students performance.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quiz Section - With two decorative cards */}
      <section
        id="mobile"
        className="
        /* Mobile */
        px-6 py-12
        
        /* Tablet */
        md:px-8 md:py-16
        
        /* Desktop */
        lg:px-12 lg:py-20
      "
      >
        <div
          className="
          /* Mobile */
          mb-12
          
          /* Tablet */
          md:mb-16
        "
        >
          <div
            className="
            /* Mobile */
            flex flex-col items-center justify-center gap-8
            
            /* Tablet */
            md:flex-row md:gap-12
            
            /* Desktop */
            lg:gap-16
          "
          >
            {/* Phone Image with two decorative cards */}
            <div className="flex-shrink-0 relative">
              {/* First decorative card */}
              <div className="
                /* Mobile */
                absolute -inset-4 bg-green-700/10 rounded-2xl transform rotate-3
                
                /* Tablet */
                md:-inset-5
              "></div>
              
              {/* Second decorative card */}
              <div className="
                /* Mobile */
                absolute -inset-3 bg-green-500/10 rounded-2xl transform -rotate-2
                
                /* Tablet */
                md:-inset-4
              "></div>
              
              <Image
                width={200}
                height={400}
                src="/RPT-SAES/RPT-SAES Mobile.png"
                alt="Quiz Mobile"
                className="
                  /* Mobile */
                  w-56 relative
                  
                  /* Tablet */
                  md:w-72
                  
                  /* Desktop */
                  lg:w-80
                "
              />
            </div>
            
            {/* Right Content */}
            <div
              className="
              /* Mobile */
              flex flex-col items-center text-center
              
              /* Tablet */
              md:items-start md:text-left 
            "
            >
              <Image
                width={200}
                height={200}
                src="/RPT-SAES/RPT-SAES Full Logo.png"
                alt="Quiz Logo"
                className="
                  /* Mobile */
                  w-48 mb-6
                  
                  /* Tablet */
                  md:w-56 md:mb-8
                  
                  /* Desktop */
                  lg:w-90 lg:mb-0
                "
              />
              <h3
                className="
                /* Mobile */
                text-2xl font-bold text-[#013300] mb-2
                
                /* Tablet */
                md:text-3xl
                
                /* Desktop */
                lg:text-4xl
              "
              >
                For Interactive
                <br className="hidden md:block" /> Learning of Students
              </h3>
              <p
                className="
                /* Mobile */
                text-base text-green-900 mb-4
                
                /* Tablet */
                md:text-lg md:mb-6
              "
              >
                Improve student engagement, enjoy while learning
              </p>
              <a
                href="#"
                className="
                  /* Mobile */
                  flex items-center px-4 py-2 bg-green-900 text-white text-base font-bold rounded-lg hover:bg-green-800 transition
                  
                  /* Tablet */
                  md:px-6 md:py-3 md:text-lg
                  
                  /* Desktop */
                  lg:text-xl
                "
              >
                <svg className="w-5 h-5 mr-2 md:w-6 md:h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                </svg>
                RPT-SAES Mobile
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}


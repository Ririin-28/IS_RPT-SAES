import React from "react";

export default function Footer() {
  return (
    <footer id="contacts" className="bg-white pt-5 px-6 md:px-16 text-black">
      <hr className="border-t border-gray-300 my-4"></hr>
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10 items-start">
        {/* Left: Logos + Description */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <div className="flex items-center gap-4 mb-4">
            <img src="/SAES/SAESLogo.png" alt="SAES Logo" className="w-27 h-27" />
            <img src="/RPT-SAES/RPTLogo.png" alt="RPT-SAES Logo" className="w-25 h-25" />
          </div>
          <p className="text-xs">
            RPT-SAES was developed in association with <br />
            San Agustin Elementary School
          </p>
        </div>

        {/* Center: Contact Details */}
        <div>
          <h4 className="font-semibold text-base mb-4 text-center md:text-left">Contact Details</h4>
          <ul className="space-y-3 text-xs">
            <li className="flex items-start gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mt-[2px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                />
              </svg>
              <span>Heavenly Drive St., San Agustin, Novaliches, Quezon City</span>
            </li>
            <li className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
                />
              </svg>
              <span>(02) 7001 7058</span>
            </li>
            <li className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Zm0 0c0 1.657 1.007 3 2.25 3S21 13.657 21 12a9 9 0 1 0-2.636 6.364M16.5 12V8.25"
                />
              </svg>
              <span>sanagustinelem@gmail.com</span>
            </li>
            <li className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.8"
                className="w-6 h-6"
              >
                <path
                  d="M16 2H8a6 6 0 0 0-6 6v8a6 6 0 0 0 6 6h8a6 6 0 0 0 6-6V8a6 6 0 0 0-6-6Z"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M14 9h-1.5a1 1 0 0 0-1 1v2H14l-.5 3H11.5v6H9.5v-6H8v-3h1.5v-2a3 3 0 0 1 3-3H14v2Z"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <a href="https://bit.ly/136538_saesfb" className="underline" target="_blank" rel="noreferrer">
                bit.ly/136538_saesfb
              </a>
            </li>
          </ul>
        </div>

        {/* Right: About Us */}
        <div>
          <h4 className="font-semibold text-base mb-4 text-center md:text-left">About Us</h4>
          <ul className="space-y-3 text-xs">
            <li className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 12.75v.008m0 3.742a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM12 6.75a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V7.5a.75.75 0 0 1 .75-.75Z"
                />
              </svg>
              <a 
                href="/RPT-SAES_Privacy-Policy.docx" 
                className="underline"
                download="RPT-SAES_Privacy-Policy.docx"
              >
                Privacy Policy
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Note */}
      <div className="text-center text-xs text-gray-600 pt-5 pb-2">&copy; {new Date().getFullYear()} RPT-SAES. All rights reserved.</div>
    </footer>
  );
}
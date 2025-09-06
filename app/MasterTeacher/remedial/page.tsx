"use client";
import Sidebar from "@/components/MasterTeacher/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import { useState } from "react";
// Button Components
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
// Text Components
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import BodyText from "@/components/Common/Texts/BodyText";
// Tabs
import NonReaderTab from "./Tabs/NonReaderTab";
import SyllableTab from "./Tabs/SyllableTab";
import WordTab from "./Tabs/WordTab";
import SentenceTab from "./Tabs/SentenceTab";
import ParagraphTab from "./Tabs/ParagraphTab";

export default function Students() {
  const [activeTab, setActiveTab] = useState("Non Reader");

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/*---------------------------------Sidebar---------------------------------*/}
      <Sidebar />

      {/*---------------------------------Main Content---------------------------------*/}
      <div
        className="
        /* Mobile */
        flex-1 pt-16 flex flex-col overflow-hidden
        
      "
      >
        <Header title="Remedial" />
        <main className="flex-1 overflow-y-auto">
          <div
            className="
            /* Mobile */
            p-4 h-full
            
            /* Tablet */
            sm:p-5
            
            /* Desktop */
            md:p-6
          "
          >
            {/*---------------------------------Main Container---------------------------------*/}
            <div
              className="
              /* Mobile */
              bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] 
              overflow-y-auto p-4
              
              /* Tablet */
              sm:p-5
              
              /* Desktop */
              md:p-6
            "
            >
              {/*---------------------------------Tabs Navigation---------------------------------*/}
              <div
                className="
                /* Mobile */
                flex flex-wrap gap-2 mb-2

                /* Tablet */
                sm:flex-nowrap sm:gap-3 sm:mb-3
                
                /* Desktop */
                md:mb-4 md:mt-1
              "
              >
                {["Non Reader", "Syllable", "Word", "Sentence", "Paragraph"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`
                      /* Mobile */
                      px-3 py-1.5 text-sm rounded-lg font-semibold focus:outline-none 
                      transition-all duration-150 shadow-sm border border-transparent
                      flex-grow text-center
                      
                      /* Tablet */
                      sm:px-4 sm:py-2 sm:text-base sm:flex-grow-0
                      
                      /* Desktop */
                      md:px-5
                      ${
                        activeTab === tab
                          ? "bg-[#013300] text-white shadow-md"
                          : "bg-gray-100 text-[#013300] hover:ring-2 hover:ring-[#013300] hover:scale-[1.03] hover:shadow-md"
                      }
                    `}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/*---------------------------------Tab Content---------------------------------*/}
              <div
                className="
                /* Mobile */
                mt-1
                /* Tablet */
                sm:mt-2
              "
              >
                {activeTab === "Non Reader" && <NonReaderTab />}
                {activeTab === "Syllable" && <SyllableTab />}
                {activeTab === "Word" && <WordTab />}
                {activeTab === "Sentence" && <SentenceTab />}
                {activeTab === "Paragraph" && <ParagraphTab />}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}



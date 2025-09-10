"use client";
import TeacherSidebar from "@/components/Teacher/Sidebar";
import TeacherHeader from "@/components/Teacher/Header";
import { useState } from "react";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
// Tabs
import NonReaderTab from "./Tabs/NonReaderTab";
import SyllableTab from "./Tabs/SyllableTab";
import WordTab from "./Tabs/WordTab";
import SentenceTab from "./Tabs/SentenceTab";
import ParagraphTab from "./Tabs/ParagraphTab";

export default function Materials() {
  const [activeTab, setActiveTab] = useState("Non Reader");

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/*---------------------------------Sidebar---------------------------------*/}
      <TeacherSidebar />

      {/*---------------------------------Main Content---------------------------------*/}
      <div
        className="
        /* Mobile */
        flex-1 pt-16 flex flex-col overflow-hidden
        
      "
      >
        <TeacherHeader title="Materials" />
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
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div className="flex items-center gap-0">
                  <SecondaryHeader title="Materials for" />
                  <HeaderDropdown
                    options={["Non Reader", "Syllable", "Word", "Sentence", "Paragraph"]}
                    value={activeTab}
                    onChange={setActiveTab}
                  />
                </div>
              </div>

              {/*---------------------------------Tab Content---------------------------------*/}
              <div
                className="
                /* Mobile */
                mt-2

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



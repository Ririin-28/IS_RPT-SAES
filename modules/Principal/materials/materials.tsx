"use client";
import PrincipalSidebar from "@/components/Principal/Sidebar";
import PrincipalHeader from "@/components/Principal/Header";
import { useMemo, useState } from "react";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import { FaTimes } from "react-icons/fa";
import NonReaderTab from "./Tabs/NonReaderTab";
import SyllableTab from "./Tabs/SyllableTab";
import WordTab from "./Tabs/WordTab";
import SentenceTab from "./Tabs/SentenceTab";
import ParagraphTab from "./Tabs/ParagraphTab";

const SUBJECT_OPTIONS = ["All Subjects", "English", "Filipino", "Mathematics"];
const GRADE_OPTIONS = ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"];

export default function PrincipalMaterials() {
  const [activeTab, setActiveTab] = useState("Non Reader");
  const [selectedGrade, setSelectedGrade] = useState(GRADE_OPTIONS[0]);
  const [searchTerm, setSearchTerm] = useState("");
  const subjectFilter = useMemo(() => ({
    label: "Subject",
    options: SUBJECT_OPTIONS,
  }), []);

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <PrincipalSidebar />
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <PrincipalHeader title="Materials" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-0 w-full sm:w-auto">
                  <HeaderDropdown
                    options={GRADE_OPTIONS}
                    value={selectedGrade}
                    onChange={setSelectedGrade}
                    openOnHover
                  />
                  <SecondaryHeader title="Materials for" />
                  <HeaderDropdown
                    options={["Non Reader", "Syllable", "Word", "Sentence", "Paragraph"]}
                    value={activeTab}
                    onChange={setActiveTab}
                    className="min-w-[140px]"
                  />
                </div>
                <div className="flex gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                  <div className="relative flex-1 sm:flex-initial">
                    <input
                      type="text"
                      placeholder="Search materials..."
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 pr-10 text-black"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <button
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setSearchTerm("")}
                      >
                        <FaTimes />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-2 sm:mt-2">
                {activeTab === "Non Reader" && (
                  <NonReaderTab filterLabel={subjectFilter.label} filterOptions={subjectFilter.options} />
                )}
                {activeTab === "Syllable" && (
                  <SyllableTab filterLabel={subjectFilter.label} filterOptions={subjectFilter.options} />
                )}
                {activeTab === "Word" && (
                  <WordTab filterLabel={subjectFilter.label} filterOptions={subjectFilter.options} />
                )}
                {activeTab === "Sentence" && (
                  <SentenceTab filterLabel={subjectFilter.label} filterOptions={subjectFilter.options} />
                )}
                {activeTab === "Paragraph" && (
                  <ParagraphTab filterLabel={subjectFilter.label} filterOptions={subjectFilter.options} />
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

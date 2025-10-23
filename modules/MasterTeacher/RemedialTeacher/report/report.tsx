"use client";
import Sidebar from "@/components/MasterTeacher/RemedialTeacher/Sidebar";
import Header from "@/components/MasterTeacher/Header";
// Button Components
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
// Text Components
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import BodyText from "@/components/Common/Texts/BodyText";
import { useRef } from "react";

export default function MasterTeacherReport() {
  const reportRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (reportRef.current) {
      const printContent = reportRef.current.innerHTML;
      
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Grade Three - English Progress Report</title>
              <script src="https://cdn.tailwindcss.com"></script>
              <style>
                @media print {
                  body { margin: 0; }
                  .no-print { display: none !important; }
                }
              </style>
            </head>
            <body class="p-6">
              <div class="text-center mb-6 border-b-2 border-black pb-4">
                <h1 class="text-2xl font-bold">Grade Three - English Progress Report</h1>
              </div>
              ${printContent}
              <script>
                window.onload = function() {
                  window.print();
                  setTimeout(function() {
                    window.close();
                  }, 100);
                };
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    }
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/*---------------------------------Sidebar---------------------------------*/}
      <Sidebar />
      {/*---------------------------------Main Content---------------------------------*/}
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <Header title="Report" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            {/*---------------------------------Main Container---------------------------------*/}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
              <div className="flex justify-between items-center mb-4 no-print">
                <h1 className="text-xl font-bold text-gray-800">Grade Three - English Progress Report</h1>
                <div className="flex gap-2">
<UtilityButton small onClick={handlePrint}>
  <div className="flex items-center gap-2">
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className="lucide lucide-printer"
    >
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
      <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/>
      <rect x="6" y="14" width="12" height="8" rx="1"/>
    </svg>
    <span>Print</span>
  </div>
</UtilityButton>
                </div>
              </div>

              {/* Report content that will be printed */}
              <div ref={reportRef}>
                <div className="overflow-x-auto border border-gray-300">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th rowSpan={2} className="border border-gray-300 p-3 text-left font-semibold text-black">Name of Learners</th>
                        <th rowSpan={2} className="border border-gray-300 p-3 text-left font-semibold text-black">Section</th>
                        <th rowSpan={2} className="border border-gray-300 p-3 text-center font-semibold text-black">Pre-Assessment<br/>September</th>
                        <th colSpan={3} className="border border-gray-300 p-3 text-center font-semibold text-black">School-Based Reading Assessment</th>
                        <th rowSpan={2} className="border border-gray-300 p-3 text-center font-semibold text-black">Post-Assessment<br/>March</th>
                        <th rowSpan={2} className="border border-gray-300 p-3 text-center font-semibold text-black">Ending<br/>Numeracy Profile</th>
                      </tr>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 p-3 text-center font-semibold text-black">October</th>
                        <th className="border border-gray-300 p-3 text-center font-semibold text-black">December</th>
                        <th className="border border-gray-300 p-3 text-center font-semibold text-black">Mid-Year<br/>Assessment<br/>February</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-3 text-black">Agustia, Aiden Richard Paloma</td>
                        <td className="border border-gray-300 p-3 text-center text-black">III-Crimson</td>
                        <td className="border border-gray-300 p-3 text-center text-black">0</td>
                        <td className="border border-gray-300 p-3 text-center text-black">WR</td>
                        <td className="border border-gray-300 p-3 text-center text-black">WR</td>
                        <td className="border border-gray-300 p-3 text-center text-black"></td>
                        <td className="border border-gray-300 p-3 text-center text-black"></td>
                        <td className="border border-gray-300 p-3 text-center text-black"></td>
                      </tr>
                      <tr className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-3 text-black">Romano, Gabriel Luis</td>
                        <td className="border border-gray-300 p-3 text-center text-black">III-Crimson</td>
                        <td className="border border-gray-300 p-3 text-center text-black">0</td>
                        <td className="border border-gray-300 p-3 text-center text-black">WR</td>
                        <td className="border border-gray-300 p-3 text-center text-black">WR</td>
                        <td className="border border-gray-300 p-3 text-center text-black"></td>
                        <td className="border border-gray-300 p-3 text-center text-black"></td>
                        <td className="border border-gray-300 p-3 text-center text-black"></td>
                      </tr>
                      <tr className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-3 text-black">Sanchez, Eithan Jhara, Encinares</td>
                        <td className="border border-gray-300 p-3 text-center text-black">III-Violet</td>
                        <td className="border border-gray-300 p-3 text-center text-black">0</td>
                        <td className="border border-gray-300 p-3 text-center text-black">WR</td>
                        <td className="border border-gray-300 p-3 text-center text-black">WR</td>
                        <td className="border border-gray-300 p-3 text-center text-black"></td>
                        <td className="border border-gray-300 p-3 text-center text-black"></td>
                        <td className="border border-gray-300 p-3 text-center text-black"></td>
                      </tr>
                      <tr className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-3 text-black">Ano, Sebastian Renz, Tabianan</td>
                        <td className="border border-gray-300 p-3 text-center text-black">III-White</td>
                        <td className="border border-gray-300 p-3 text-center text-black">5</td>
                        <td className="border border-gray-300 p-3 text-center text-black">WR</td>
                        <td className="border border-gray-300 p-3 text-center text-black">WR</td>
                        <td className="border border-gray-300 p-3 text-center text-black"></td>
                        <td className="border border-gray-300 p-3 text-center text-black"></td>
                        <td className="border border-gray-300 p-3 text-center text-black"></td>
                      </tr>
                      <tr className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-3 text-black">Mauricio, Christian Habonero</td>
                        <td className="border border-gray-300 p-3 text-center text-black">III-Yellow</td>
                        <td className="border border-gray-300 p-3 text-center text-black">11</td>
                        <td className="border border-gray-300 p-3 text-center text-black">WR</td>
                        <td className="border border-gray-300 p-3 text-center text-black">WR</td>
                        <td className="border border-gray-300 p-3 text-center text-black"></td>
                        <td className="border border-gray-300 p-3 text-center text-black"></td>
                        <td className="border border-gray-300 p-3 text-center text-black"></td>
                      </tr>
                      <tr className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-3 text-black">Morales, Nyhl Zion</td>
                        <td className="border border-gray-300 p-3 text-center text-black">III-Blue</td>
                        <td className="border border-gray-300 p-3 text-center text-black">16</td>
                        <td className="border border-gray-300 p-3 text-center text-black">SylR</td>
                        <td className="border border-gray-300 p-3 text-center text-black">WR</td>
                        <td className="border border-gray-300 p-3 text-center text-black"></td>
                        <td className="border border-gray-300 p-3 text-center text-black"></td>
                        <td className="border border-gray-300 p-3 text-center text-black"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 text-sm text-black">
                  <p className="font-semibold mb-2">Legend:</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p>NR - Non-Reader</p>
                      <p>SylR - Syllable Reader</p>
                    </div>
                    <div>
                      <p>WR - Word Reader</p>
                      <p>PhR - Phrase Reader</p>
                      <p>SR - Sentence Reader</p>
                      <p>StoryR - Story Reader</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
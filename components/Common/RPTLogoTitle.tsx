import React from "react";

interface RPTLogoTitleProps {
  small?: boolean;
}

export default function RPTLogoTitle({ small = false }: RPTLogoTitleProps) {
  return (
    <div className={`flex flex-row items-center ${small ? "" : "mb-6"}`}>
      <img
        src="/RPT-SAES/RPTLogo.png"
        alt="RPT-SAES Logo"
        className={`${small ? "h-8 w-8 mr-2" : "h-16 w-16 mr-4"} object-contain drop-shadow-md`}
      />
      <div
        className={`font-bold bg-gradient-to-r from-green-700 to-green-900 bg-clip-text text-transparent ${small ? "text-xl" : "text-5xl"}`}
      >
        RPT-SAES
      </div>
    </div>
  );
}

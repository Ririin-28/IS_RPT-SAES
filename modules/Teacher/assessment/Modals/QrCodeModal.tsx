import React, { useEffect, useState } from "react";
import Image from "next/image";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import { generateQrCodeDataUrl, buildAccessUrl } from "@/lib/assessments/utils";

interface QrCodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    quizTitle: string;
    quizCode: string;
}

export default function QrCodeModal({
    isOpen,
    onClose,
    quizTitle,
    quizCode,
}: QrCodeModalProps) {
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && quizCode) {
            // We use a dummy token because the new flow just needs the code, 
            // but buildAccessUrl might expect two args. 
            // actually buildAccessUrl(quizCode, qrToken) was updated to ignore token in the last step.
            const url = buildAccessUrl(quizCode, "dummy-token");
            generateQrCodeDataUrl(url).then(setQrDataUrl);
        }
    }, [isOpen, quizCode]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-[#013300] px-6 py-4 flex justify-between items-center bg-gradient-to-r from-green-900 to-[#013300]">
                    <h3 className="text-white font-bold text-lg truncate pr-4">
                        {quizTitle}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white transition-colors"
                    >
                        <svg
                            className="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 flex flex-col items-center text-center space-y-6">
                    <div className="space-y-2">
                        <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">
                            Student Access Code
                        </p>
                        <div className="text-5xl font-mono font-black text-[#013300] tracking-widest">
                            {quizCode}
                        </div>
                    </div>

                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-green-500 to-[#013300] rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                        <div className="relative bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
                            {qrDataUrl ? (
                                <Image
                                    src={qrDataUrl}
                                    alt={`QR Code for ${quizCode}`}
                                    width={200}
                                    height={200}
                                    className="rounded-md"
                                />
                            ) : (
                                <div className="w-[200px] h-[200px] bg-gray-100 animate-pulse rounded-md flex items-center justify-center text-gray-400">
                                    Loading QR...
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="text-sm text-gray-500 max-w-xs">
                        Students can scan this code or go to <span className="text-[#013300] font-semibold">/join</span> and enter the code above.
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-center">
                    <UtilityButton onClick={onClose} className="!bg-[#013300] hover:!bg-green-900">Close</UtilityButton>
                </div>
            </div>
        </div>
    );
}

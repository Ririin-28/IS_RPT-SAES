"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

function JoinContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [quizCode, setQuizCode] = useState("");
    const [lrn, setLrn] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const codeFromUrl = searchParams.get("code");
        if (codeFromUrl) {
            setQuizCode(codeFromUrl);
        }
    }, [searchParams]);

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const response = await fetch("/api/assessments/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ quizCode, lrn }),
            });

            const data = await response.json();

            if (data.success) {
                // Redirect to the quiz page
                router.push(data.redirectUrl);
            } else {
                setError(data.error || "Failed to join quiz.");
            }
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // Shared Background for consistency
    const Background = () => (
        <>
            <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(209,255,222,0.45),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(188,240,214,0.35),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,249,245,0.95))]" />
            <div className="pointer-events-none absolute left-[12%] right-[46%] top-40 -z-10 h-56 rounded-3xl bg-linear-to-br from-green-200/50 via-white/40 to-transparent blur-4xl" />
            <div className="pointer-events-none absolute left-[52%] right-[12%] bottom-16 -z-10 h-56 rounded-[40px] bg-linear-to-t from-green-200/60 via-white/35 to-transparent blur-4xl" />
        </>
    );

    return (
        <div className="min-h-screen flex flex-col items-center justify-center text-[#013300] relative overflow-hidden p-4">
            <Background />

            <div className="flex flex-col items-center mb-8">
                <Image
                    src="/RPT-SAES/RPTLogo.png"
                    alt="RPT-SAES Logo"
                    width={80}
                    height={80}
                    className="h-20 w-20 object-contain drop-shadow-md mb-4"
                />
                <h1 className="text-4xl font-bold bg-linear-to-r from-green-800 to-[#013300] bg-clip-text text-transparent">RPT Quiz</h1>
                <p className="text-[#013300]/70 font-medium mt-1">Assessment Portal</p>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-green-100/60 p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#013300]/50 text-center">Quiz Title</p>
                <h2 className="text-3xl font-bold text-[#013300] mb-2 text-center">Quiz Time!</h2>
                <p className="text-[#013300]/60 mb-8 text-center text-sm">Enter your credentials to start.</p>

                {error && (
                    <div className="mb-6 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100 text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleJoin} className="space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-[#013300]/80 mb-2">
                            Quiz Code
                        </label>
                        <button
                            type="button"
                            className="w-full mb-3 rounded-xl border-2 border-[#013300]/20 bg-white/70 py-3 text-sm font-semibold text-[#013300] shadow-sm transition hover:border-[#013300]/40"
                        >
                            Scan QR Code
                        </button>
                        <div className="flex items-center justify-center gap-3 text-xs uppercase tracking-[0.25em] text-[#013300]/40 mb-3">
                            <span className="h-px flex-1 bg-[#013300]/10" />
                            or
                            <span className="h-px flex-1 bg-[#013300]/10" />
                        </div>
                        {quizCode ? (
                            <div className="bg-green-50/50 p-4 rounded-xl border border-green-200/50 text-center">
                                <span className="font-mono text-2xl font-bold text-[#013300] tracking-[0.2em]">{quizCode}</span>
                            </div>
                        ) : (
                            <input
                                id="quizCode"
                                type="text"
                                value={quizCode}
                                onChange={(e) => setQuizCode(e.target.value.toUpperCase())}
                                placeholder="Enter Quiz Code"
                                className="w-full px-4 py-3.5 rounded-xl border-2 border-green-200/50 focus:border-[#013300] focus:ring-0 outline-none transition-all bg-white text-[#013300] placeholder-green-800/20 text-center font-mono tracking-widest uppercase font-bold text-lg"
                                required
                            />
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-[#013300]/80 mb-2">
                            Student LRN
                        </label>
                        <input
                            type="text"
                            value={lrn}
                            onChange={(e) => setLrn(e.target.value)}
                            required
                            placeholder="Enter LRN"
                            className="w-full px-4 py-3.5 rounded-xl border-2 border-green-200/50 focus:border-[#013300] focus:ring-0 outline-none transition-all bg-white text-[#013300] placeholder-green-800/20 text-center text-lg"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-linear-to-r from-green-600 to-[#133000] text-white font-bold py-4 px-4 rounded-xl shadow-lg shadow-green-900/10 transform transition hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed mt-4"
                    >
                        {isLoading ? "Verifying..." : "Start Quiz"}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default function JoinPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <JoinContent />
        </Suspense>
    )
}

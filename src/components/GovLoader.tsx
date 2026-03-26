import React, { useState, useEffect } from 'react';
import { Search, FileText, ShieldCheck, CheckCircle } from 'lucide-react';
import Logo from '../assets/logo';
import { useLanguage } from '../i18n/LanguageContext';

interface GovLoaderProps {
    message?: string;
}

export default function GovLoader({ message }: GovLoaderProps) {
    const { t } = useLanguage();
    const [step, setStep] = useState(0);

    const steps = [
        { icon: Search, textKey: 'loader.step1', defaultText: "Scanning Government Databases...", color: "text-red-500" },
        { icon: FileText, textKey: 'loader.step2', defaultText: "Verifying Eligibility Criteria...", color: "text-red-400" },
        { icon: ShieldCheck, textKey: 'loader.step3', defaultText: "Authenticating Official Sources...", color: "text-red-500" },
        { icon: CheckCircle, textKey: 'loader.step4', defaultText: "Finalizing Personalized Feed...", color: "text-red-400" }
    ];

    useEffect(() => {
        const timer = setInterval(() => {
            setStep((prev) => (prev + 1) % steps.length);
        }, 1500);
        return () => clearInterval(timer);
    }, [steps.length]);

    const defaultMessage = t('loader.defaultMessage');
    const displayMessage = message || defaultMessage;

    return (
        <div className="flex flex-col items-center justify-center py-20 px-4 min-h-[50vh]">
            <div className="relative w-32 h-32 mb-8">
                {/* Outer rotating ring - Brand Colors */}
                <div className="absolute inset-0 rounded-full border-[3px] border-[#1a1010] border-t-amber-500 border-r-red-600 animate-spin transition-all duration-1000"></div>

                {/* Inner icon container */}
                <div className="absolute inset-0 rounded-full flex items-center justify-center p-4">
                    <div className="animate-pulse w-full flex items-center justify-center filter drop-shadow-[0_0_12px_rgba(220,38,38,0.2)]">
                        <Logo className="max-w-full" />
                    </div>
                </div>
            </div>

            <div className="text-center">
                <div className="flex items-center justify-center gap-3 mb-4">
                    <div className={`transition-all duration-500 ${steps[step].color}`}>
                        {React.createElement(steps[step].icon, { size: 20 })}
                    </div>
                    {/* Fallback to defaultText if translation key is missing or returns the key itself */}
                    <h2 className="text-lg font-semibold text-gray-200 tracking-tight">
                        {t(steps[step].textKey) !== steps[step].textKey ? t(steps[step].textKey) : steps[step].defaultText}
                    </h2>
                </div>
                <p className="text-gray-500 text-sm italic">{displayMessage}</p>

                <div className="mt-8 flex justify-center gap-2">
                    {steps.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${i === step ? 'bg-red-600 scale-150 shadow-[0_0_8px_rgba(220,38,38,0.5)]' : 'bg-red-950/40'
                                }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

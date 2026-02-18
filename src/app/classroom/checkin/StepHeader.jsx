import { Check } from 'lucide-react';

const steps = [
  { id: 1, label: "ค้นหาชื่อ" },
  { id: 2, label: "เลือกเมนูอาหาร" },
  { id: 3, label: "เซ็นลายเซ็น" },
  { id: 4, label: "เสร็จสิ้น" },
];

export default function StepHeader({ currentStep }) {
  return (
    <div className="flex gap-4 border-b border-brand-border px-6 py-4">
      {steps.map((step) => {
        const isActive = step.id === currentStep;
        const isDone = step.id < currentStep;

        if (isActive)
          return (
            <div
              key={step.id}
              className="relative z-10 flex flex-1 sm:flex-col lg:flex-row items-center gap-2 rounded-2xl bg-gradient-to-r from-[#005CFF] to-[#FFB020] px-4 py-3 text-white shadow-md transform scale-[1.1] transition-transform duration-200 ease-out"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 sm:text-xl lg:text-base font-semibold">
                {step.id}
              </span>
              <span className="sm:text-xl lg:text-base font-bold">{step.label}</span>
            </div>
          );

        if (isDone)
          return (
            <div
              key={step.id}
              className="flex flex-1 sm:flex-col lg:flex-row items-center gap-2 rounded-2xl  bg-slate-100 px-4 py-3"
            >
              
              <span className="flex h-8 w-8 items-center justify-center rounded-full sm:text-lg lg:text-sm font-semibold text-[#F8FAFD] bg-[#005CFF]">
                {/* {step.id} */}
                <Check size={20}/>
              </span>
              <span className="sm:text-lg lg:text-sm font-medium text-[#0D1B2A]">
                {step.label}
              </span>
            </div>
          );

        return (
          <div
            key={step.id}
            className="flex flex-1 sm:flex-col lg:flex-row items-center gap-2 rounded-2xl border bg-front-stepFuture px-4 py-3"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full sm:text-lg lg:text-sm font-medium text-slate-300">
              {step.id}
            </span>
            <span className="sm:text-lg lg:text-sm text-slate-300">{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

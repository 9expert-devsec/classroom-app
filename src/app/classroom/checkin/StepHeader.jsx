const steps = [
  { id: 1, label: "ค้นหาชื่อ" },
  { id: 2, label: "เลือกเมนูอาหาร" },
  { id: 3, label: "เซ็นลายเซ็น" },
  { id: 4, label: "เสร็จสิ้น" },
];

export default function StepHeader({ currentStep }) {
  return (
    <div className="flex gap-3 border-b border-brand-border px-6 py-4">
      {steps.map((step) => {
        const isActive = step.id === currentStep;
        const isDone = step.id < currentStep;

        if (isActive)
          return (
            <div
              key={step.id}
              className="flex flex-1 items-center gap-2 rounded-full bg-gradient-to-r from-front-stepGradientFrom to-front-stepGradientTo px-4 py-2 text-white shadow-md"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-sm font-semibold">
                {step.id}
              </span>
              <span className="text-sm font-medium">{step.label}</span>
            </div>
          );

        if (isDone)
          return (
            <div
              key={step.id}
              className="flex flex-1 items-center gap-2 rounded-full border border-front-stepDoneBorder bg-front-stepBg px-4 py-2"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-brand-primary">
                {step.id}
              </span>
              <span className="text-xs font-medium text-front-text">
                {step.label}
              </span>
            </div>
          );

        return (
          <div
            key={step.id}
            className="flex flex-1 items-center gap-2 rounded-full bg-front-stepFuture px-4 py-2"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium text-front-textMuted">
              {step.id}
            </span>
            <span className="text-xs text-front-textMuted">{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

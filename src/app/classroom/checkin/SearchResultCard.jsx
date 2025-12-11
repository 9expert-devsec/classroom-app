"use client";

export default function SearchResultCard({ student, onClick }) {
  const { thaiName, engName, company, classInfo } = student || {};

  const classTitle = classInfo?.title || "";
  const room = classInfo?.room || "";
  const startDate = classInfo?.date ? new Date(classInfo.date) : null;

  // ---------------------------
  //   ⚡ คำนวณว่า "วันนี้เป็น Day อะไร"
  // ---------------------------
  let dayLabel = "";
  let dayNumber = null;

  if (startDate) {
    const today = new Date();
    
    // Normalize (ตัดเวลาออกทั้งคู่)
    const d0 = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate()
    );
    const d1 = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    const diffDays = Math.floor((d1 - d0) / (1000 * 60 * 60 * 24));

    if (diffDays >= 0) {
      dayNumber = diffDays + 1; // Day 1,2,3...
      dayLabel = `วันนี้คือ Day ${dayNumber}`;
    }
  }

  const dateLabel = startDate
    ? startDate.toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl px-4 py-3 shadow-sm transition
                 bg-white ring-1 ring-front-border/40 hover:bg-front-bgSoft/80"
    >
      <div className="text-sm font-semibold text-front-text">{thaiName}</div>

      {engName && (
        <div className="text-xs text-front-textMuted">{engName}</div>
      )}

      {company && (
        <div className="mt-1 text-xs text-front-textMuted">{company}</div>
      )}

      {classTitle && (
        <div className="mt-2 rounded-xl bg-front-bgSoft px-3 py-2 text-xs text-front-text">
          <div className="font-medium">
            Class: <span className="font-semibold">{classTitle}</span>
          </div>

          <div className="mt-0.5 text-[11px] text-front-textMuted">
            {dateLabel && <>วันที่อบรม: {dateLabel}</>}
            {room && <> • ห้อง: {room}</>}
          </div>

          {/* แสดง Day */}
          {dayNumber && (
            <div className="mt-1 text-[11px] text-brand-primary font-semibold">
              {dayLabel}
            </div>
          )}
        </div>
      )}
    </button>
  );
}

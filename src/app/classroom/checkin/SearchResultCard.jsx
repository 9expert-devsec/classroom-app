"use client";

export default function SearchResultCard({ student, onClick }) {
  const { thaiName, engName, company, classInfo } = student || {};

  const classTitle = classInfo?.courseName || "";
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
                 bg-white ring-1 ring-[#48B0FF] hover:bg-front-bgSoft/80"
    >
      <div className="text-base font-semibold text-[#0D1B2A]">{thaiName}</div>

      {engName && (
        <div className="text-xs text-front-textMuted">{engName}</div>
      )}

      {company && (
        <div className="mt-1 text-sm text-front-textMuted">{company}</div>
      )}

      {classTitle && (
        <div className="mt-2 rounded-xl bg-[#48B0FF]/20 px-3 py-2 text-base text-[#0D1B2A]">
          <div className="font-bold">
            Class: <span className="font-normal">{classTitle}</span>
          </div>

          <div className="mt-0.5 text-sm text-[#0D1B2A]">
            {dateLabel && <>วันที่อบรม: {dateLabel}</>}
            {room && <> • ห้อง: {room}</>}
          </div>

          {/* แสดง Day */}
          {dayNumber && (
            <div className="mt-1 text-sm text-[#005CFF] font-bold">
              {dayLabel}
            </div>
          )}
        </div>
      )}
    </button>
  );
}

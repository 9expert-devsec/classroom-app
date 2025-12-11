import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Class from "@/models/Class";

export async function GET() {
  await dbConnect();

  // API จริงที่คุณให้
  const API_URL = "https://9exp-sec.com/api/ai/schedule";
  const API_KEY = "eae394c471482f58743534b94e3b88df6b07d7249c937386081ab13d7836b89a";

  try {
    const res = await fetch(API_URL, {
      headers: {
        "x-api-key": API_KEY,
      },
    });

    const data = await res.json();
    if (!data.ok) {
      return NextResponse.json({ error: "API schedule error" }, { status: 400 });
    }

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const tomorrowDate = tomorrow.toISOString().split("T")[0];

    // filter เฉพาะรอบของ "พรุ่งนี้"
    const tomorrowSchedules = data.items.filter((item) => {
      return item.date.split("T")[0] === tomorrowDate;
    });

    const created = [];

    for (const sc of tomorrowSchedules) {
      // กันซ้ำ
      const exists = await Class.findOne({ scheduleId: sc._id });
      if (exists) continue;

      const newClass = await Class.create({
        scheduleId: sc._id,
        title: sc.title,
        date: sc.date,
        instructors: sc.instructors || [],
        duration: {
          dayCount: sc.dayCount || 1,
          startTime: sc.startTime || "09:00",
          endTime: sc.endTime || "16:00",
        },
      });

      created.push(newClass);
    }

    return NextResponse.json({
      ok: true,
      createdCount: created.length,
      items: created,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

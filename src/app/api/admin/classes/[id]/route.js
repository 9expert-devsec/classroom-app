// src/app/api/admin/classes/[id]/route.js
import dbConnect from "@/lib/mongoose";
import Class from "@/models/Class";

export const dynamic = "force-dynamic";

// GET /api/admin/classes/[id]
export async function GET(req, { params }) {
  await dbConnect();
  const { id } = params;

  const cls = await Class.findById(id).lean();
  if (!cls) {
    return new Response("Not found", { status: 404 });
  }
  return Response.json(cls);
}

// PATCH /api/admin/classes/[id]
export async function PATCH(req, { params }) {
  await dbConnect();
  const { id } = params;
  const body = await req.json();

  const update = {};

  if (body.title !== undefined) {
    update.title = body.title;
    update.courseTitle = body.title;
  }

  if (body.courseCode !== undefined) {
    update.courseCode = body.courseCode;
  }

  if (body.room !== undefined) {
    update.room = body.room;
    update.roomName = body.room;
  }

  if (body.channel !== undefined) {
    update.channel = body.channel;
    update.trainingChannel = body.channel;
    update.mode = body.channel;
  }

  if (body.trainerName !== undefined) {
    update.trainerName = body.trainerName;
    update.trainer = body.trainerName;
  }

  if (body.date !== undefined) {
    const d = body.date ? new Date(body.date) : null;
    update.date = d;
    update.startDate = d;
  }

  if (body.dayCount !== undefined) {
    const dayCount = Number(body.dayCount) || 1;
    update.dayCount = dayCount;
    update["duration.dayCount"] = dayCount;
  }

  try {
    const cls = await Class.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    ).lean();

    if (!cls) {
      return Response.json(
        { ok: false, error: "Class not found" },
        { status: 404 }
      );
    }

    return Response.json({ ok: true, class: cls });
  } catch (err) {
    console.error("PATCH /api/admin/classes/[id] error", err);
    return Response.json(
      { ok: false, error: "อัปเดต Class ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/classes/[id]
export async function DELETE(req, { params }) {
  await dbConnect();
  const { id } = params;

  try {
    const cls = await Class.findByIdAndDelete(id);
    if (!cls) {
      return Response.json(
        { ok: false, error: "Class not found" },
        { status: 404 }
      );
    }

    // NOTE: ถ้ามี collection อื่นที่ต้องลบตาม (เช่น checkin logs) ค่อยมาเพิ่มภายหลังได้

    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/classes/[id] error", err);
    return Response.json(
      { ok: false, error: "ลบ Class ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

"use client";

import { useRef, useEffect, useCallback } from "react";

export default function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const historyRef = useRef([]); // เก็บประวัติภาพไว้สำหรับ Undo
  const drawingRef = useRef(false); // flag ว่ากำลังเขียนอยู่ไหม
  const lastPointRef = useRef(null); // จุดล่าสุดที่วาด

  /* --------------------- helpers --------------------- */

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  }, []);

  // ปรับขนาด canvas ให้เท่ากับความกว้าง container
  const fitCanvasToParent = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement) return;

    const parentRect = canvas.parentElement.getBoundingClientRect();
    const width = parentRect.width;
    const height = 260;

    canvas.width = width;
    canvas.height = height;
  }, []);

  // snapshot เก็บ state ปัจจุบันของลายเซ็นไว้ใน history
  const saveSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    historyRef.current.push(imgData);
  }, [getCtx]);

  // แปลงตำแหน่งเมาส์/ทัชให้เป็นพิกัดใน canvas
  const getPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();

    const clientX =
      "touches" in e && e.touches.length ? e.touches[0].clientX : e.clientX;
    const clientY =
      "touches" in e && e.touches.length ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return { x, y };
  };

  /* --------------------- setup --------------------- */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    fitCanvasToParent();

    const ctx = getCtx();
    if (!ctx) return;

    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0A1F33";

    // snapshot แรก (พื้นว่างเปล่า)
    historyRef.current = [];
    saveSnapshot();

    // เวลา resize หน้าจอ ให้ปรับ canvas ตาม แล้วพยายาม restore รูปล่าสุด
    const handleResize = () => {
      const c = canvasRef.current;
      const context = getCtx();
      if (!c || !context) return;

      const last = historyRef.current[historyRef.current.length - 1] || null;

      fitCanvasToParent();

      if (last) {
        context.putImageData(last, 0, 0);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [fitCanvasToParent, getCtx, saveSnapshot]);

  /* --------------------- actions --------------------- */

  const startDrawing = (e) => {
    e.preventDefault();

    const ctx = getCtx();
    if (!ctx) return;

    const { x, y } = getPos(e);
    drawingRef.current = true;
    lastPointRef.current = { x, y };

    saveSnapshot(); // เก็บก่อนเริ่มเส้นใหม่

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();

    const ctx = getCtx();
    if (!ctx) return;

    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();

    lastPointRef.current = { x, y };
  };

  const endDrawing = () => {
    if (!drawingRef.current) return;

    drawingRef.current = false;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const base64 = canvas.toDataURL("image/png");
    onChange?.(base64);

    const ctx = getCtx();
    if (ctx) ctx.beginPath();
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;

    if (historyRef.current.length <= 1) {
      const last = historyRef.current[0];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (last) ctx.putImageData(last, 0, 0);
      onChange?.("");
      return;
    }

    historyRef.current.pop();
    const prev = historyRef.current[historyRef.current.length - 1];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(prev, 0, 0);

    const base64 = canvas.toDataURL("image/png");
    onChange?.(base64);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    historyRef.current = [];
    saveSnapshot();
    onChange?.("");
  };

  /* --------------------- render --------------------- */

  return (
    <div className="relative w-full">
      <canvas
        ref={canvasRef}
        className="rounded-2xl border-2 border-dashed border-brand-border bg-white shadow-sm touch-none"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={endDrawing}
        onMouseLeave={endDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={endDrawing}
      />

      <div className="absolute right-3 top-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handleUndo}
          className="rounded-lg bg-front-bgSoft px-3 py-1 text-sm text-front-text shadow"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="rounded-lg bg-white px-3 py-1 text-sm text-front-text shadow ring-1 ring-black/5"
        >
          ล้าง
        </button>
      </div>
    </div>
  );
}

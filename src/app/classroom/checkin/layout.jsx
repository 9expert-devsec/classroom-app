export default function CheckinLayout({ children }) {
  return (
    <div className="h-screen bg-front-bg text-front-text">
      <div className="mx-auto flex h-screen max-w-4xl flex-col px-4 py-6">
        <header className="mb-6 shrink-0">
          <h1 className="text-2xl font-semibold">9Expert Classroom Check-in</h1>
          <p className="text-sm text-front-textMuted">
            กรุณาทำตามขั้นตอนเพื่อเช็คอินเข้าห้องเรียน
          </p>
        </header>

        {/* ✅ เลื่อนเฉพาะ main */}
        <main className="min-h-0 flex-1 overflow-hidden">
          <div className="h-full min-h-0 rounded-3xl bg-front-surface shadow-card">
            {children}
          </div>
        </main>

        <footer className="mt-4 shrink-0 text-center text-xs text-front-textMuted">
          © 9Expert Training
        </footer>
      </div>
    </div>
  );
}

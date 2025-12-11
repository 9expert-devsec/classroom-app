export default function CheckinLayout({ children }) {
  return (
    <div className="min-h-screen bg-front-bg text-front-text">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-6">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">9Expert Classroom Check-in</h1>
          <p className="text-sm text-front-textMuted">
            กรุณาทำตามขั้นตอนเพื่อเช็คอินเข้าห้องเรียน
          </p>
        </header>

        <main className="flex-1">
          <div className="rounded-3xl bg-front-surface shadow-card">
            {children}
          </div>
        </main>

        <footer className="mt-4 text-center text-xs text-front-textMuted">
          © 9Expert Training
        </footer>
      </div>
    </div>
  );
}

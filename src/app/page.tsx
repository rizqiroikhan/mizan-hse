export default function HomePage() {
  return (
    <>
      <div id="app" suppressHydrationWarning>
        <div className="boot">
          <div className="brand-mark">m</div>
          <p>Preparing your workspace…</p>
        </div>
      </div>
      <div id="modal-root" />
      <div id="toast-root" aria-live="polite" />
    </>
  );
}

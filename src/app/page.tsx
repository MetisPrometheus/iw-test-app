import InteractiveGlobe from "@/components/InteractiveGlobe";

export default function Home() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-gradient-to-b from-slate-950 via-blue-950 to-slate-950">
      <header className="pointer-events-none absolute left-4 top-4 z-10 select-none">
        <div className="rounded-md bg-slate-950/40 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-blue-200/80 backdrop-blur-md">
          Globe Sandbox
        </div>
      </header>
      <InteractiveGlobe />
      <footer className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 select-none text-[10px] uppercase tracking-[0.25em] text-blue-200/40">
        test-app · iw-test-app
      </footer>
    </main>
  );
}

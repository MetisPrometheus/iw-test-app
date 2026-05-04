import InteractiveGlobe from "@/components/InteractiveGlobe";

export default function Home() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-gradient-to-b from-slate-950 via-blue-950 to-slate-950">
      <InteractiveGlobe />
      <footer className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 select-none text-[10px] uppercase tracking-[0.25em] text-blue-200/40">
        test-app · iw-test-app
      </footer>
    </main>
  );
}

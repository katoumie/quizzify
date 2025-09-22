// /src/app/(main)/test/page.tsx
"use client";

import { useState, type ChangeEvent } from "react";
import SplitText from "@/components/SplitText";
import ShinyText from "@/components/ShinyText";
import DarkVeil from "@/components/DarkVeil"; // adjust if your shadcn path differs

export default function ReactBitsTestPage() {
  // ---- DarkVeil (overlay) controls ----
  const [enabled, setEnabled] = useState(true);
  const [opacity, setOpacity] = useState(0.35);

  // Defaults per your screenshot
  const [speed, setSpeed] = useState(1.2);
  const [hueShift, setHueShift] = useState(0);
  const [noiseIntensity, setNoiseIntensity] = useState(0);
  const [scanlineFrequency, setScanlineFrequency] = useState(0);
  const [scanlineIntensity, setScanlineIntensity] = useState(0);
  const [warpAmount, setWarpAmount] = useState(0);
  const [resolutionScale, setResolutionScale] = useState(1);

  // ---- Split/Shiny demo controls (kept from earlier) ----
  const [splitText, setSplitText] = useState("Generating your AI study set.");
  const [splitDelay, setSplitDelay] = useState<number>(70);
  const [splitDuration, setSplitDuration] = useState<number>(1.2);

  const [shinyText, setShinyText] = useState("This might take a while…");
  const [shinySpeed, setShinySpeed] = useState<number>(1.8);
  const [shinyDisabled, setShinyDisabled] = useState(false);

  const INPUT = [
    "h-10 w-full rounded-md px-3 text-[15px]",
    "bg-[#18062e] text-white/90 placeholder-white/60",
    "ring-1 ring-white/12 focus:outline-none focus:ring-2 focus:ring-white/20",
  ].join(" ");
  const LABEL = "text-sm text-white/80";
  const NUM = INPUT + " [appearance:textfield]";
  const GROUP = "grid gap-2";
  const onNum =
    (fn: (n: number) => void) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const n = Number(e.target.value);
      if (!Number.isNaN(n)) fn(n);
    };

  return (
    <>
      {/* ===== Full-page DarkVeil overlay (on top, but click-through) ===== */}
      {enabled && (
        <div className="fixed inset-0 z-[100] pointer-events-none" style={{ opacity }}>
          {/* Fill the viewport; DarkVeil respects its container box */}
          <div className="h-full w-full">
            <DarkVeil
              speed={speed}
              hueShift={hueShift}
              noiseIntensity={noiseIntensity}
              scanlineFrequency={scanlineFrequency}
              scanlineIntensity={scanlineIntensity}
              warpAmount={warpAmount}
              resolutionScale={resolutionScale}
            />
          </div>
        </div>
      )}

      {/* ===== Page content to preview against the overlay ===== */}
      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[22px] md:text-[26px] font-semibold text-white">Reactbits Playground</h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEnabled((v) => !v)}
              className={[
                "h-9 rounded-md px-3 text-[15px]",
                enabled ? "bg-white/10 text-white" : "bg-[#532e95] text-white hover:bg-[#5f3aa6]",
                "ring-1 ring-white/20 transition-colors",
              ].join(" ")}
            >
              {enabled ? "Hide DarkVeil" : "Show DarkVeil"}
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* SplitText panel */}
          <div className="rounded-2xl bg-[var(--bg-card)] ring-1 ring-white/15 p-4">
            <h2 className="text-[16px] font-semibold text-white mb-3">SplitText</h2>
            <div className="grid gap-4">
              <div className={GROUP}>
                <label className={LABEL}>Text</label>
                <input className={INPUT} value={splitText} onChange={(e) => setSplitText(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className={GROUP}>
                  <label className={LABEL}>Delay (ms/char)</label>
                  <input type="number" min={0} step={5} className={NUM} value={splitDelay} onChange={onNum(setSplitDelay)} />
                </div>
                <div className={GROUP}>
                  <label className={LABEL}>Duration (s)</label>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    className={NUM}
                    value={splitDuration}
                    onChange={onNum(setSplitDuration)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ShinyText panel */}
          <div className="rounded-2xl bg-[var(--bg-card)] ring-1 ring-white/15 p-4">
            <h2 className="text-[16px] font-semibold text-white mb-3">ShinyText</h2>
            <div className="grid gap-4">
              <div className={GROUP}>
                <label className={LABEL}>Text</label>
                <input className={INPUT} value={shinyText} onChange={(e) => setShinyText(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className={GROUP}>
                  <label className={LABEL}>Speed (s per sweep)</label>
                  <input type="number" min={0.2} step={0.1} className={NUM} value={shinySpeed} onChange={onNum(setShinySpeed)} />
                </div>
                <div className={GROUP}>
                  <label className={LABEL}>Disabled</label>
                  <button
                    type="button"
                    className={[
                      "h-10 rounded-md px-3 text-[15px]",
                      shinyDisabled ? "bg-white/10 text-white" : "bg-[#532e95] text-white hover:bg-[#5f3aa6]",
                      "ring-1 ring-white/20 transition-colors",
                    ].join(" ")}
                    onClick={() => setShinyDisabled((v) => !v)}
                  >
                    {shinyDisabled ? "Enable" : "Disable"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* DarkVeil panel */}
          <div className="md:col-span-2 rounded-2xl bg-[var(--bg-card)] ring-1 ring-white/15 p-4">
            <h2 className="text-[16px] font-semibold text-white mb-3">DarkVeil (page filter)</h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <LabeledRange label="Opacity" min={0} max={1} step={0.05} value={opacity} onChange={setOpacity} />
              <LabeledRange label="Speed" min={0} max={3} step={0.1} value={speed} onChange={setSpeed} />
              <LabeledRange label="Hue Shift" min={-2} max={2} step={0.1} value={hueShift} onChange={setHueShift} />
              <LabeledRange label="Noise Intensity" min={0} max={1} step={0.05} value={noiseIntensity} onChange={setNoiseIntensity} />
              <LabeledRange label="Scanline Frequency" min={0} max={40} step={1} value={scanlineFrequency} onChange={setScanlineFrequency} />
              <LabeledRange label="Scanline Intensity" min={0} max={1} step={0.05} value={scanlineIntensity} onChange={setScanlineIntensity} />
              <LabeledRange label="Warp Amount" min={0} max={1} step={0.02} value={warpAmount} onChange={setWarpAmount} />
              <LabeledRange label="Resolution Scale" min={0.4} max={2} step={0.1} value={resolutionScale} onChange={setResolutionScale} />
            </div>
            <p className="mt-3 text-sm text-white/60">
              The overlay is <code>pointer-events-none</code> and fixed to the viewport, so it acts like a filter across the entire page.
            </p>
          </div>
        </div>

        {/* Preview area */}
        <div className="mt-8 rounded-2xl bg-[var(--bg-card)] ring-1 ring-white/15 p-8">
          <h3 className="text-[15px] font-semibold text-white/90 mb-4">Preview</h3>
          <div className="text-center flex flex-col items-center">
            <SplitText
              text={splitText}
              delay={splitDelay}
              duration={splitDuration}
              className="text-center text-[clamp(28px,4vw,48px)] font-semibold leading-tight text-white"
            />
            <ShinyText text={shinyText} speed={shinySpeed} disabled={shinyDisabled} className="block mt-5 text-[22px]" />
          </div>
        </div>
      </section>
    </>
  );
}

/** Small helper for labeled range inputs */
function LabeledRange({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="grid gap-1 text-white/80 text-sm">
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <span className="text-white/60 tabular-nums">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[--brand]"
      />
    </label>
  );
}

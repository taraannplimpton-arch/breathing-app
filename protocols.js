(function (root) {
  const BREATHING = {
    SESSION_MS: 5 * 60 * 1000,
    DURATION_MINUTES: [1, 2, 5, 10],
    QUICK_RESET_CYCLES: 3,
    MIN_SCALE: 0.42,
    MAX_SCALE: 1,
    PATTERNS: {
      rest: {
        id: "rest",
        homeLabel: "Rest",
        protocol: "2–1–6",
        mood: "calm",
        technique: "Nose inhale, short nose top-up, long mouth exhale",
        // Cyclic sighing loop (9s cycle): 2s nasal inhale, 1s nasal top-up, 6s mouth exhale.
        phases: [
          { id: "inhale", seconds: 2 },
          { id: "inhale2", seconds: 1 },
          { id: "exhale", seconds: 6 },
        ],
        colors: {
          inhale: { fill: "#7f88c8", glow: "rgba(110, 122, 190, 0.38)", atmosphere: "#090814" },
          inhale2: { fill: "#9aa3d8", glow: "rgba(140, 150, 210, 0.42)", atmosphere: "#0b0a18" },
          exhale: { fill: "#2a315c", glow: "rgba(50, 58, 110, 0.26)", atmosphere: "#06060d" },
        },
      },
      energy: {
        id: "energy",
        homeLabel: "Energy",
        protocol: "4–2",
        mood: "bright",
        technique: "Nose inhale and nose exhale (shorter out). Stop if you feel lightheaded. More air isn't better.",
        maxMinutes: 1,
        phases: [
          { id: "inhale", seconds: 4 },
          { id: "exhale", seconds: 2 },
        ],
        colors: {
          inhale: { fill: "#ffc46a", glow: "rgba(255, 176, 72, 0.55)", atmosphere: "#2a1608" },
          exhale: { fill: "#d44512", glow: "rgba(210, 70, 20, 0.4)", atmosphere: "#160a06" },
        },
      },
      hrv: {
        id: "hrv",
        homeLabel: "HRV",
        protocol: "5–5",
        mood: "steady",
        technique: "Nose inhale and nose exhale, soft belly",
        phases: [
          { id: "inhale", seconds: 5 },
          { id: "exhale", seconds: 5 },
        ],
        colors: {
          inhale: { fill: "#6ef0d8", glow: "rgba(80, 220, 196, 0.5)", atmosphere: "#072422" },
          exhale: { fill: "#0b6e66", glow: "rgba(20, 110, 100, 0.38)", atmosphere: "#041412" },
        },
      },
      focus: {
        id: "focus",
        homeLabel: "Focus",
        protocol: "Box",
        mood: "steady",
        technique: "Nose inhale, nose hold, nose exhale, nose hold — all through the nose",
        phases: [
          { id: "inhale", seconds: 4 },
          { id: "hold", seconds: 4 },
          { id: "exhale", seconds: 4 },
          { id: "hold", seconds: 4 },
        ],
        colors: {
          inhale: { fill: "#7ec3ff", glow: "rgba(90, 170, 255, 0.5)", atmosphere: "#0d1a30" },
          hold: { fill: "#b7a6ff", glow: "rgba(170, 150, 255, 0.46)", atmosphere: "#161430" },
          exhale: { fill: "#1d4ed8", glow: "rgba(40, 80, 200, 0.4)", atmosphere: "#07101f" },
        },
      },
      sleep: {
        id: "sleep",
        homeLabel: "Sleep",
        protocol: "4–6",
        mood: "calm",
        technique: "Small breath, easy longer exhale. Counts fade once the rhythm settles.",
        dropCountAfterCycles: 4,
        phases: [
          { id: "inhale", seconds: 4 },
          { id: "exhale", seconds: 6 },
        ],
        colors: {
          inhale: { fill: "#6d739e", glow: "rgba(90, 96, 150, 0.32)", atmosphere: "#07060c" },
          exhale: { fill: "#1f2444", glow: "rgba(40, 46, 80, 0.22)", atmosphere: "#05050a" },
        },
      },
    },
  };

  root.BREATHING = BREATHING;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = BREATHING;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

(function (root) {
  const BREATHING = {
    SESSION_MS: 5 * 60 * 1000,
    MIN_SCALE: 0.42,
    MAX_SCALE: 1,
    PATTERNS: {
      rest: {
        id: "rest",
        homeLabel: "Rest",
        protocol: "2–1–6",
        mood: "calm",
        technique: "Double inhale, long exhale",
        // Cyclic sighing loop that fits a calm 5:00 session (9s cycle).
        // 2s nasal inhale, 1s shorter nasal top-up, 6s mouth exhale.
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
        technique: "Nose inhale, shorter out",
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
        technique: "Nose inhale, soft belly",
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
        technique: "Even inhale, hold, exhale, hold",
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
    },
  };

  root.BREATHING = BREATHING;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = BREATHING;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

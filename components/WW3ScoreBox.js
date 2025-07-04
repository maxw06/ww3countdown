import { useEffect, useRef, useState } from "react";

// Score bands: 0–10 Peace | 11–29 Tension | 30–69 Elevated | 70–89 Crisis | 90+ Critical | 100 World War
function getScoreClass(score) {
  if (score === 100) return "bg-black text-white animate-pulse";
  if (score >= 90) return "bg-red-700 text-white";
  if (score >= 70) return "bg-orange-400 text-black";
  if (score >= 30) return "bg-yellow-300 text-black";
  if (score >= 11) return "bg-blue-400 text-black";
  return "bg-green-500 text-white";
}
function getScoreLabel(score) {
  if (score === 100) return "☢️ WORLD WAR";
  if (score >= 90) return "🚨 CRITICAL";
  if (score >= 70) return "🟠 CRISIS";
  if (score >= 30) return "🟡 ELEVATED";
  if (score >= 11) return "🔵 TENSION";
  return "🟢 PEACE";
}

export default function WW3ScoreBox({ score, lastUpdated }) {
  const alarmRef = useRef(null);
  const [audioError, setAudioError] = useState(false);

  // Play sound for score = 100 automatically
  useEffect(() => {
    if (score === 100 && alarmRef.current) {
      alarmRef.current.muted = false;
      alarmRef.current.currentTime = 0;
      alarmRef.current.play().catch(() => {});
    }
  }, [score]);

  // Play sound on button click (always works, even if useEffect above fails)
  const playTestAlarm = () => {
    if (alarmRef.current) {
      alarmRef.current.muted = false;
      alarmRef.current.currentTime = 0;
      const playPromise = alarmRef.current.play();
      if (playPromise) playPromise.catch(() => setAudioError(true));
    }
  };
  const stopAlarm = () => {
    if (alarmRef.current) {
      alarmRef.current.pause();
      alarmRef.current.currentTime = 0;
    }
  };

  return (
    <div
      className={`w-full max-w-lg mx-auto rounded-2xl p-8 shadow-2xl flex flex-col items-center justify-center transition-all duration-300 ${getScoreClass(score)}`}
      style={{
        border: "6px solid rgba(0,0,0,0.08)",
        boxSizing: "border-box",
      }}
    >
      <div className="text-7xl font-extrabold tracking-widest mb-2 drop-shadow">
        {Number(score).toFixed(2)}
        <span className="text-3xl font-bold align-top">/100</span>
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-wide uppercase flex items-center">
        <span className="mr-2">{getScoreLabel(score).split(" ")[0]}</span>
        <span>{getScoreLabel(score).split(" ").slice(1).join(" ")}</span>
      </div>
      {lastUpdated && (
        <div className="text-xs opacity-70 mt-2">
          Last updated: {typeof lastUpdated === "string"
            ? lastUpdated
            : new Date(lastUpdated).toLocaleTimeString()}
        </div>
      )}
      <div className="flex space-x-3 mt-5">
        <button
          onClick={playTestAlarm}
          className="w-40 h-12 mt-5 px-4 py-2 rounded bg-gray-900 text-white font-semibold shadow hover:bg-red-600 transition-all"
        >
          Test War Alarm
        </button>
        <button
          onClick={stopAlarm}
          className="w-40 h-12 mt-5 px-4 py-2 rounded bg-gray-700 text-red-200 font-semibold shadow hover:bg-gray-900 active:bg-black active:text-yellow-200 transition-all"
        >
          Stop Alarm
        </button>
      </div>
      <audio
        ref={alarmRef}
        src="/war.mp3"
        preload="auto"
        onError={() => setAudioError(true)}
      />
      {audioError && (
        <div className="text-xs text-red-400 mt-3">
          Could not play war.mp3. Make sure your browser allows audio and the file is in <code>/public/war.mp3</code>.
        </div>
      )}
    </div>
  );
}
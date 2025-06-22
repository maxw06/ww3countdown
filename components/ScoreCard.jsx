import React, { useEffect, useRef } from "react";

function getLevel(score) {
  if (score >= 100) return { label: "WAR", color: "bg-black text-white animate-pulse", emoji: "☢️" };
  if (score >= 98) return { label: "Imminent", color: "bg-red-700 text-white animate-pulse", emoji: "🚨" };
  if (score >= 85) return { label: "Critical", color: "bg-red-700 text-white", emoji: "🚨" };
  if (score >= 60) return { label: "High", color: "bg-orange-500 text-white", emoji: "⚠️" };
  if (score >= 30) return { label: "Elevated", color: "bg-yellow-300 text-black", emoji: "🟡" };
  return { label: "Low", color: "bg-green-500 text-white", emoji: "🟢" };
}

function scoreToClock(score) {
  const totalMinutes = 12 * 60;
  const minutesToMidnight = Math.max(0, totalMinutes - Math.round((score / 100) * totalMinutes));
  const hours = Math.floor(minutesToMidnight / 60);
  const minutes = minutesToMidnight % 60;
  const pad = n => n.toString().padStart(2, "0");
  return {
    text: `${hours}:${pad(minutes)} ${minutesToMidnight === 0 ? "AM (Midnight!)" : "to midnight"}`,
    minutesToMidnight
  };
}

export default function ScoreCard({ score = 0 }) {
  const preciseScore = Number(score).toFixed(2);
  const { label, color, emoji } = getLevel(score);
  const { text: clockText, minutesToMidnight } = scoreToClock(score);

  // War sound logic
  const warAudioRef = useRef(null);
  useEffect(() => {
    if (score >= 98 && warAudioRef.current) {
      warAudioRef.current.currentTime = 0;
      warAudioRef.current.play();
    }
  }, [score]);

  // Play test alarm
  const playTestAlarm = () => {
    if (warAudioRef.current) {
      warAudioRef.current.currentTime = 0;
      warAudioRef.current.play();
    }
  };

  // Color for score number
  let scoreNumberColor =
    score >= 100 ? "text-white" :
    score >= 98 ? "text-yellow-200 animate-pulse" :
    score >= 85 ? "text-red-400" :
    score >= 60 ? "text-orange-400" :
    score >= 30 ? "text-yellow-500" :
    "text-green-200";

  // Extra flash for war
  let warFlashing = score >= 100 ? "animate-pulse bg-black text-white border-4 border-white" : "";

  return (
    <div className={`p-8 rounded-3xl shadow-2xl w-full max-w-xl mb-8 text-center border-4 transition-colors duration-500 ${color} ${warFlashing}`}>
      {/* War sound, hidden audio tag */}
      <audio ref={warAudioRef} src="/war.mp3" preload="auto" />
      <div className="flex flex-col items-center justify-center space-y-6">
        <div className="flex flex-row items-center justify-center space-x-4">
          <span
            className={`font-extrabold ${scoreNumberColor} drop-shadow-lg`}
            style={{
              fontSize: "6rem",
              lineHeight: "1",
              letterSpacing: "0.05em",
              textShadow: score >= 90 ? "0 0 32px #fff,0 0 4px #fff" : undefined,
            }}
            aria-label="WW3 Risk Score"
          >
            {preciseScore}
          </span>
          <span className="text-2xl text-gray-300 font-medium self-end mb-4">/100</span>
        </div>
        <div className="text-3xl font-bold flex items-center justify-center space-x-2 uppercase tracking-widest">
          <span className="text-4xl">{emoji}</span>
          <span>{label}</span>
        </div>
        <div className="flex flex-col items-center mt-1">
          <span className="text-lg font-mono">⏰ <span className="font-bold">{clockText}</span></span>
          <span className="text-sm text-gray-200">
            {minutesToMidnight === 0
              ? "Midnight: Global war outbreak"
              : `${minutesToMidnight} minute${minutesToMidnight !== 1 ? "s" : ""} to midnight`}
          </span>
        </div>
        {score >= 100 && (
          <div className="mt-4 text-3xl font-black text-white animate-bounce tracking-wide">
            🚨 WAR HAS STARTED 🚨
          </div>
        )}
        <button
          onClick={playTestAlarm}
          className="mt-5 px-5 py-2 rounded-xl bg-gray-900 text-yellow-200 font-semibold shadow hover:bg-gray-800 active:bg-black active:text-red-400 transition-all duration-150"
          aria-label="Test War Alarm"
        >
          Test War Alarm
        </button>
      </div>
    </div>
  );
}
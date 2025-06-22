import React, { useEffect, useState } from "react";
import WW3ScoreBox from "../components/WW3ScoreBox";
import Link from "next/link";

function NewsFeed({ headlines }) {
  if (!headlines?.length) return null;
  return (
    <div className="w-full max-w-lg mt-8">
      <h2 className="text-lg font-bold text-gray-200 mb-2 tracking-wide">Top Headlines</h2>
      <ul className="space-y-2">
        {headlines.map((h, i) => (
          <li
            key={i}
            className="text-gray-100 bg-gray-800 rounded-lg px-4 py-2 text-base shadow-sm transition hover:bg-gray-700"
          >
            <a
              href={h.link}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-yellow-300 font-medium flex items-center"
            >
              <span>{h.title}</span>
              <span className="ml-2" aria-label="external link" title="Open original news">↗️</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Summary({ summary }) {
  return (
    <div className="w-full max-w-lg mt-7">
      <h2 className="text-lg font-bold text-gray-200 mb-1 tracking-wide">AI Summary</h2>
      <div className="bg-gray-900 text-gray-100 rounded-xl px-5 py-4 text-base shadow-md leading-relaxed">{summary}</div>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("/api/score")
      .then(res => res.json())
      .then(setData)
      .catch(() => setData({
        score: 50,
        summary: "Error loading data.",
        headlines: []
      }));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#181f29] to-black flex flex-col items-center justify-start p-4">
      <div className="w-full max-w-2xl flex flex-col items-center">
        <h1 className="text-4xl md:text-5xl font-black mb-3 text-center text-white drop-shadow">
          🌍 World War III Countdown
        </h1>
        <p className="mb-6 text-gray-300 text-center max-w-xl">
          <span className="inline-block bg-gray-700 px-3 py-1 rounded-full text-xs text-yellow-200 font-semibold mb-2">
            Nonprofit Awareness Project
          </span>
          <br />
          <span>
            This site uses AI to analyze public news and estimate the risk of global conflict.<br />
            <span className="text-green-400">Our mission: Raise public awareness, foster informed discussion, and promote peace.</span>
          </span>
        </p>
        <WW3ScoreBox score={data?.score ?? 50} lastUpdated={data?.lastUpdated} />
        <Summary summary={data?.summary ?? "Loading..."} />
        <NewsFeed headlines={data?.headlines ?? []} />   
        <Link href="/donate" className="mt-4 underline text-blue-400 hover:text-blue-300">Donate (Crypto welcome)</Link>
        <footer className="text-xs text-gray-400 mt-8 text-center max-w-md">
          <div className="mb-2">
            Score legend:
            <span className="text-green-300 ml-1">0–10 Peace</span> |
            <span className="text-yellow-200 ml-1">30–69 Elevated</span> |
            <span className="text-orange-400 ml-1">70–89 Crisis</span> |
            <span className="text-red-400 ml-1">90+ Critical</span> |
            <span className="text-white font-bold ml-1">100 World War</span>
          </div>
          Disclaimer: Informational only. No predictions or government warnings.<br />
          No personal data collected. Open source.<br />
          &copy; {new Date().getFullYear()} WW3Countdown.org
        </footer>
      </div>
    </div>
  );
}
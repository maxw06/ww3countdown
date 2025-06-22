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
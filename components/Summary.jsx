import React from "react";
export default function Summary({ summary }) {
  return (
    <div className="bg-gray-800 text-white p-4 rounded-lg w-full max-w-md mb-6">
      <h3 className="font-semibold mb-2 text-lg">AI Summary</h3>
      <p className="text-sm text-gray-200">{summary}</p>
    </div>
  );
}
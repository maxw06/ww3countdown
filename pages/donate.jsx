import Donate from "../components/Donate";
import Link from "next/link";

export default function DonatePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 bg-black">
      <h1 className="text-3xl font-bold mb-4 text-center">Support WW3Countdown.org</h1>
      <p className="mb-4 text-gray-300 text-center max-w-xl">
        This is a nonprofit, ad-free, open data project. Your crypto donation helps keep it free and online.
      </p>
      <Donate />
      <Link href="/" className="mt-6 underline text-blue-400">← Back to Home</Link>
    </div>
  );
}
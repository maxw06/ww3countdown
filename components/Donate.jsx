import React from "react";

export default function Donate() {
  return (
    <div className="bg-gray-800 rounded-lg p-6 my-6 max-w-md mx-auto text-center">
      <h3 className="text-lg font-bold mb-2 text-white">Donate Cryptocurrency</h3>
      <p className="text-sm text-gray-300 mb-3">
        Scan a QR code or copy an address.<br />
        <span className="font-mono text-xs text-gray-400">(Donations help pay for servers and data APIs.)</span>
      </p>
      {/* BTC Example */}
      <div className="flex flex-col items-center my-3">
        <img
          src="/btc_qr.png"
          alt="Bitcoin Donation QR"
          className="w-32 h-32 rounded border border-gray-600 mb-2"
        />
        <span className="text-xs text-gray-400 break-all">
          BTC: <span className="font-mono">bc1q5uwpeclhf4yun7kx55flgj28qcq7hpqk8kxmxn</span>
        </span>
      </div>
      {/* ETH Example */}
      <div className="flex flex-col items-center my-3">
        <img
          src="/eth_qr.png"
          alt="Ethereum Donation QR"
          className="w-32 h-32 rounded border border-gray-600 mb-2"
        />
        <span className="text-xs text-gray-400 break-all">
          ETH: <span className="font-mono">0x829D79fDeAC58b9D1ac31B4fd3B1689FbdE4A85B</span>
        </span>
      </div>
    </div>
  );
}
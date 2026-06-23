import { useState } from 'react';
import { useStore } from '../store';
import { Key, Shield, AlertCircle, CheckCircle, ExternalLink, Info, Zap } from 'lucide-react';

export default function SettingsPanel() {
  const { apiToken, setApiToken, isConnected, setConnected, connectionError, setConnectionError } = useStore();
  const [tokenInput, setTokenInput] = useState(apiToken);
  const [isValidating, setIsValidating] = useState(false);

  const handleConnect = async () => {
    if (!tokenInput.trim()) {
      setConnectionError('Please enter your Upstox Access Token');
      return;
    }

    setIsValidating(true);
    setConnectionError('');

    // Simulate token validation
    await new Promise(r => setTimeout(r, 1500));

    // In production, this would validate against Upstox API
    // For demo purposes, any non-empty token is accepted
    setApiToken(tokenInput.trim());
    setConnected(true);
    setConnectionError('');
    setIsValidating(false);
  };

  const handleDisconnect = () => {
    setApiToken('');
    setConnected(false);
    setTokenInput('');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Connection Status */}
      <div className="glass-panel rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2 mb-4">
          <Key size={16} /> Upstox API Connection
        </h3>

        <div className={`flex items-center gap-3 p-3 rounded-lg mb-4 ${
          isConnected ? 'bg-up/10 border border-up/20' : 'bg-panel-light border border-panel-border'
        }`}>
          {isConnected ? (
            <>
              <CheckCircle size={20} className="text-up" />
              <div>
                <p className="text-sm font-medium text-up">Connected</p>
                <p className="text-[10px] text-gray-400">Token: {apiToken.slice(0, 10)}...{apiToken.slice(-6)}</p>
              </div>
              <button
                onClick={handleDisconnect}
                className="ml-auto px-3 py-1 rounded-lg bg-down/10 text-down text-xs hover:bg-down/20 transition-colors"
              >
                Disconnect
              </button>
            </>
          ) : (
            <>
              <AlertCircle size={20} className="text-warn" />
              <div>
                <p className="text-sm font-medium text-warn">Not Connected</p>
                <p className="text-[10px] text-gray-400">Using simulated data</p>
              </div>
            </>
          )}
        </div>

        {!isConnected && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Upstox Access Token</label>
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Enter your Upstox access token..."
                className="w-full bg-panel-light border border-panel-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50"
              />
            </div>

            {connectionError && (
              <div className="flex items-center gap-2 text-xs text-down">
                <AlertCircle size={12} />
                {connectionError}
              </div>
            )}

            <button
              onClick={handleConnect}
              disabled={isValidating}
              className="w-full py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isValidating ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <Zap size={14} />
                  Connect to Upstox
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* How to get token */}
      <div className="glass-panel rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2 mb-3">
          <Info size={16} /> How to Get Your Access Token
        </h3>
        <div className="space-y-2 text-xs text-gray-400">
          <Step n={1} text="Go to Upstox Developer Portal and create an app" />
          <Step n={2} text="Note your API Key and API Secret" />
          <Step n={3} text="Use the OAuth flow to generate an access token" />
          <Step n={4} text="Paste the access token above and click Connect" />
        </div>
        <a
          href="https://upstox.com/developer/api-documentation"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-3 text-xs text-brand-400 hover:text-brand-300 transition-colors"
        >
          <ExternalLink size={12} />
          Upstox API Documentation
        </a>
      </div>

      {/* Security notice */}
      <div className="glass-panel rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2 mb-3">
          <Shield size={16} /> Security
        </h3>
        <div className="space-y-2 text-xs text-gray-400">
          <p>• Your token is stored only in browser memory (never on any server)</p>
          <p>• Token is cleared when you close or refresh the tab</p>
          <p>• All API calls are made directly from your browser to Upstox</p>
          <p>• No data is stored permanently or shared with third parties</p>
          <p>• The scanner works with simulated data when no token is provided</p>
        </div>
      </div>

      {/* Scanner Info */}
      <div className="glass-panel rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2 mb-3">
          <Zap size={16} /> Scanner Features
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            'Real-time F&O stock scanning',
            'Multi-factor momentum scoring',
            'Dynamic support/resistance levels',
            'VWAP & EMA overlay analysis',
            'Volume profile analysis',
            'OI buildup/unwinding detection',
            'Sector rotation tracking',
            'AI-powered trade signals',
            'Risk-reward optimization',
            'Confidence-based ranking',
            'Interactive charting with overlays',
            'Sector heatmap visualization',
          ].map((feature, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
              {feature}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-5 h-5 rounded-full bg-brand-600/20 text-brand-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
        {n}
      </span>
      <span>{text}</span>
    </div>
  );
}

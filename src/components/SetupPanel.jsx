import React, { useState, useEffect } from 'react';
import { KeyRound, Cpu, Play } from 'lucide-react';

export default function SetupPanel({ onComplete }) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('llama-3.3-70b-versatile');
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    const savedKey = sessionStorage.getItem('thematicus_groq_key');
    if (savedKey) {
      setApiKey(savedKey);
      setRemember(true);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    if (remember) {
      sessionStorage.setItem('thematicus_groq_key', apiKey.trim());
    } else {
      sessionStorage.removeItem('thematicus_groq_key');
    }

    onComplete({ apiKey: apiKey.trim(), model });
  };

  return (
    <div className="glass-panel fade-in" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0 }}>
        <Cpu className="text-primary" /> Setup Environment
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        Thematicus runs entirely in your browser. You need a Groq API key to power the qualitative analysis engine. Your key is never sent to any server other than Groq.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* API Key Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
            <KeyRound size={16} /> Groq API Key
          </label>
          <input 
            type="password"
            className="input"
            placeholder="gsk_..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            required
            autoComplete="off"
            style={{ fontFamily: 'monospace' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            <input 
              type="checkbox" 
              checked={remember} 
              onChange={(e) => setRemember(e.target.checked)} 
            />
            Remember for this session (sessionStorage)
          </label>
        </div>

        {/* Model Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontWeight: 500 }}>Model Selection</label>
          <select 
            className="input" 
            value={model} 
            onChange={(e) => setModel(e.target.value)}
            style={{ cursor: 'pointer' }}
          >
            <option value="llama-3.3-70b-versatile">Llama 3.3 70B Versatile (Recommended, High Quality)</option>
            <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant (Fast mode, lower reasoning)</option>
            <option value="qwen/qwen3-32b">Qwen 3 32B (Alternative)</option>
          </select>
        </div>

        <button 
          type="submit" 
          className="button" 
          disabled={!apiKey.trim()}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem', padding: '0.75rem' }}
        >
          Begin Setup <Play size={16} />
        </button>

      </form>
    </div>
  );
}

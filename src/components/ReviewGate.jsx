import React, { useState, useEffect } from 'react';
import { generateInitialCodebook } from '../engine/pipeline';
import { Check, X, Edit2, GitMerge, Loader2, Save } from 'lucide-react';

export default function ReviewGate({ config, documents, themes, onComplete }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [codebook, setCodebook] = useState(null);

  // Merge state tracking
  const [mergeSelection, setMergeSelection] = useState([]); // array of subcode IDs
  const [mergeParentId, setMergeParentId] = useState(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeLabel, setMergeLabel] = useState('');
  const [mergeDefinition, setMergeDefinition] = useState('');

  useEffect(() => {
    let mounted = true;
    const runGeneration = async () => {
      try {
        const result = await generateInitialCodebook({
          apiKey: config.apiKey,
          model: config.model,
          themes: themes,
          documents: documents
        });
        if (mounted) {
          setCodebook(result);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          console.error(err);
          setError(err.message || 'Failed to generate codebook.');
          setLoading(false);
        }
      }
    };
    runGeneration();
    return () => { mounted = false; };
  }, [config, documents, themes]);

  const handleToggleMerge = (themeId, subCodeId) => {
    if (mergeParentId && mergeParentId !== themeId) {
      // Switched theme parent, reset selection
      setMergeParentId(themeId);
      setMergeSelection([subCodeId]);
      return;
    }
    
    setMergeParentId(themeId);
    if (mergeSelection.includes(subCodeId)) {
      const newSel = mergeSelection.filter(id => id !== subCodeId);
      setMergeSelection(newSel);
      if (newSel.length === 0) setMergeParentId(null);
    } else {
      if (mergeSelection.length < 2) {
        setMergeSelection([...mergeSelection, subCodeId]);
      } else {
        alert("Select exactly 2 sub-codes to merge.");
      }
    }
  };

  const handleExecuteMerge = () => {
    if (!mergeLabel.trim() || mergeSelection.length !== 2) return;

    const newCodebook = { ...codebook, themes: [...codebook.themes] };
    const parentIndex = newCodebook.themes.findIndex(t => t.id === mergeParentId);
    const parent = newCodebook.themes[parentIndex];
    
    const sc1 = parent.sub_codes.find(s => s.id === mergeSelection[0]);
    const sc2 = parent.sub_codes.find(s => s.id === mergeSelection[1]);

    // Construct merged subcode
    const mergedId = mergeLabel.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
    const mergedKeywords = [...new Set([...sc1.keywords, ...sc2.keywords])].slice(0, 5);

    const mergedSubcode = {
      id: mergedId,
      label: mergeLabel.trim(),
      definition: mergeDefinition.trim(),
      keywords: mergedKeywords,
      generation: 2,
      source: 'user_merged',
      triggered_by: [...new Set([...(sc1.triggered_by||[]), ...(sc2.triggered_by||[])])]
    };

    // Remove old, add new
    parent.sub_codes = parent.sub_codes.filter(s => !mergeSelection.includes(s.id));
    parent.sub_codes.push(mergedSubcode);

    setCodebook(newCodebook);
    setShowMergeModal(false);
    setMergeSelection([]);
    setMergeParentId(null);
    setMergeLabel('');
    setMergeDefinition('');
  };

  const handleRemoveSubCode = (themeId, subCodeId) => {
    const newCodebook = { ...codebook, themes: [...codebook.themes] };
    const parentIndex = newCodebook.themes.findIndex(t => t.id === themeId);
    newCodebook.themes[parentIndex].sub_codes = newCodebook.themes[parentIndex].sub_codes.filter(s => s.id !== subCodeId);
    setCodebook(newCodebook);
  };

  const handleRemoveTheme = (themeId) => {
    const newCodebook = { ...codebook, themes: codebook.themes.filter(t => t.id !== themeId) };
    setCodebook(newCodebook);
  };

  const confirmCodebook = () => {
    onComplete(codebook);
  };

  if (loading) {
    return (
      <div className="glass-panel fade-in" style={{ padding: '4rem', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
        <Loader2 className="spinning text-primary" size={48} style={{ animation: 'spin 2s linear infinite', marginBottom: '1rem' }} />
        <h2>Phase 2: Generating Initial Codebook</h2>
        <p style={{ color: 'var(--text-muted)' }}>Analyzing corpus preview ({documents.length} docs) against Gen 1 themes...</p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>This takes 10-30 seconds depending on LLM response time.</p>
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel fade-in" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', textAlign: 'center', border: '1px solid var(--danger)' }}>
        <h2 style={{ color: 'var(--danger)' }}>Generation Failed</h2>
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '4px', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.85rem' }}>
          {error}
        </div>
        <button className="button" style={{ marginTop: '2rem' }} onClick={() => window.location.reload()}>Reload Application</button>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header Panel */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Edit2 className="text-accent" /> Codebook Review Gate
          </h2>
          <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)' }}>
            Groq has analyzed a preview of your corpus. Review the suggested sub-codes and emergent themes below.
            <br />Select two sub-codes under the same theme to merge them together.
          </p>
        </div>
        <button className="button" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--success)', padding: '0.75rem 1.5rem' }} onClick={confirmCodebook}>
          <Save size={18} /> Confirm &amp; Proceed to Phase 3
        </button>
      </div>

      {mergeSelection.length === 2 && (
        <div className="glass-panel fade-in" style={{ padding: '1rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>2 sub-codes selected for merge.</span>
          <button className="button" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => setShowMergeModal(true)}>
            <GitMerge size={16} /> Merge Sub-codes
          </button>
        </div>
      )}

      {/* Grid of Themes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>
        {codebook.themes.map(theme => (
          <div key={theme.id} className="glass-panel" style={{ 
            padding: '1.5rem', 
            border: theme.emergent ? '1px dashed var(--accent)' : '1px solid var(--border-color)',
            position: 'relative'
          }}>
            {/* Theme Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: theme.emergent ? 'var(--accent)' : 'white' }}>
                  {theme.label}
                  {theme.emergent && <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', backgroundColor: 'var(--accent)', color: 'white', borderRadius: '4px' }}>EMERGENT</span>}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>{theme.definition}</p>
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  {(theme.keywords||[]).map(kw => <span key={kw} style={{ fontSize: '0.7rem', backgroundColor: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>{kw}</span>)}
                </div>
              </div>
              {theme.emergent && (
                <button onClick={() => handleRemoveTheme(theme.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }} title="Reject Emergent Theme"><X size={18} /></button>
              )}
            </div>

            {/* Subcodes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Sub-codes ({theme.sub_codes?.length || 0})</h4>
              {(theme.sub_codes || []).length === 0 && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No sub-codes discovered.</span>}
              
              {(theme.sub_codes || []).map(sc => {
                const isSelected = mergeSelection.includes(sc.id);
                return (
                  <div key={sc.id} style={{ 
                    display: 'flex', 
                    gap: '0.75rem', 
                    padding: '0.75rem', 
                    backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(15, 23, 42, 0.4)', 
                    border: `1px solid ${isSelected ? 'var(--primary)' : 'transparent'}`,
                    borderRadius: 'var(--radius)'
                  }}>
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => handleToggleMerge(theme.id, sc.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ marginTop: '0.2rem', cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>{sc.label}</strong>
                        <button onClick={() => handleRemoveSubCode(theme.id, sc.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={14}/></button>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0' }}>{sc.definition}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Merge Modal Layout */}
      {showMergeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="glass-panel" style={{ padding: '2rem', width: '100%', maxWidth: '500px' }}>
            <h3 style={{ marginTop: 0 }}>Merge Sub-codes</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>New Merged Label</label>
                <input className="input" style={{ width: '90%' }} value={mergeLabel} onChange={e => setMergeLabel(e.target.value)} placeholder="e.g. Systemic distrust" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>New Merged Definition</label>
                <textarea className="input" style={{ width: '90%', height: '80px', resize: 'vertical' }} value={mergeDefinition} onChange={e => setMergeDefinition(e.target.value)} placeholder="Definition of the merged code..." />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button className="button" style={{ backgroundColor: 'transparent', border: '1px solid var(--border-color)' }} onClick={() => setShowMergeModal(false)}>Cancel</button>
                <button className="button" disabled={!mergeLabel.trim()} onClick={handleExecuteMerge}>Merge Now</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

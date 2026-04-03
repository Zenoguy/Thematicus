import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, X, AlertTriangle, CheckCircle, Tag, Plus } from 'lucide-react';

export default function InputPanel({ onComplete }) {
  const [docs, setDocs] = useState([]);
  const [themes, setThemes] = useState([]);
  const [themeInput, setThemeInput] = useState('');
  const [error, setError] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef(null);
  const themeInputRef = useRef(null);

  // === PDF Extraction Logic ===
  const extractPdfContent = async (file) => {
    try {
      const buffer = await file.arrayBuffer();
      // pdfjsLib is loaded globally via index.html
      const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(' ');
        text += pageText + ' \n';
      }
      const words = text.split(/\s+/).filter(w => w.length > 0);
      return { 
        name: file.name, 
        text: text.trim(), 
        wordCount: words.length 
      };
    } catch (err) {
      console.error(err);
      throw new Error(`Failed to extract text from ${file.name}`);
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    event.target.value = ''; // reset
    if (!files.length) return;

    if (docs.length + files.length > 10) {
      setError("Maximum 10 documents allowed.");
      return;
    }

    setIsExtracting(true);
    setError(null);

    const newDocs = [];
    for (const file of files) {
      if (file.type !== 'application/pdf') {
        setError(`File ${file.name} is not a PDF.`);
        continue;
      }
      try {
        const result = await extractPdfContent(file);
        
        let status = 'success';
        let message = '';
        if (result.wordCount < 50) {
          status = 'error';
          message = 'Extraction failed or image-only PDF.';
        } else if (result.wordCount < 200) {
          status = 'warning';
          message = 'Low word count, might be poor quality.';
        }

        newDocs.push({
          id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: result.name,
          text: result.text,
          wordCount: result.wordCount,
          status,
          message
        });
      } catch (err) {
        newDocs.push({ 
          id: `error_${Date.now()}`,
          name: file.name, 
          status: 'error', 
          message: 'Failed to read PDF.',
          wordCount: 0
        });
      }
    }

    setDocs(prev => [...prev, ...newDocs]);
    setIsExtracting(false);
  };

  const removeDoc = (id) => {
    setDocs(docs.filter(d => d.id !== id));
  };

  // === Theme Logic ===
  const handleThemeUpload = async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      let importedThemes = [];
      if (file.name.endsWith('.json')) {
        importedThemes = JSON.parse(text);
        if (!Array.isArray(importedThemes)) throw new Error("JSON must be an array of strings.");
      } else {
        importedThemes = text.split('\n').map(t => t.trim()).filter(t => t.length > 0);
      }
      
      const combined = [...new Set([...themes, ...importedThemes])];
      if (combined.length > 50) {
        setError("Maximum 50 Gen 1 themes allowed.");
      } else {
        setThemes(combined);
      }
    } catch (err) {
      setError("Failed to parse theme file. Ensure it's a valid JSON array or text file.");
    }
  };

  const addThemeManual = (e) => {
    e.preventDefault();
    const val = themeInput.trim();
    if (!val) return;
    if (themes.length >= 50) {
      setError("Max 50 themes.");
      return;
    }
    if (!themes.includes(val)) {
      setThemes([...themes, val]);
    }
    setThemeInput('');
  };

  const removeTheme = (t) => {
    setThemes(themes.filter(theme => theme !== t));
  };

  // === Submit ===
  const handleProceed = () => {
    const validDocs = docs.filter(d => d.status !== 'error');
    if (validDocs.length === 0) {
      setError("You must have at least one valid document.");
      return;
    }
    if (themes.length < 2) {
      setError("You must provide at least 2 primary themes.");
      return;
    }
    onComplete({ documents: validDocs, themes });
  };

  return (
    <div className="app-container fade-in" style={{ padding: 0 }}>
      {error && (
        <div style={{ backgroundColor: 'var(--danger)', color: 'white', padding: '1rem', borderRadius: 'var(--radius)', display: 'flex', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={16} /></button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        
        {/* Left Column: PDFs */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText className="text-accent" /> Documents 
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>({docs.length}/10)</span>
            </h2>
          </div>

          <div 
            onClick={() => docs.length < 10 && fileInputRef.current.click()}
            style={{
              border: `2px dashed var(--border-color)`,
              borderRadius: 'var(--radius)',
              padding: '2rem',
              textAlign: 'center',
              cursor: docs.length >= 10 ? 'not-allowed' : 'pointer',
              backgroundColor: 'rgba(15, 23, 42, 0.4)',
              marginBottom: '1rem',
              transition: 'border-color 0.2s',
            }}
          >
            {isExtracting ? (
              <p>Extracting text...</p>
            ) : (
              <>
                <UploadCloud size={32} style={{ color: 'var(--text-muted)' }} />
                <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)' }}>Click or drop PDFs here</p>
              </>
            )}
            <input 
              type="file" 
              multiple 
              accept=".pdf" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileUpload}
              disabled={docs.length >= 10}
            />
          </div>

          {/* Doc List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {docs.map(doc => (
              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', backgroundColor: 'rgba(30, 41, 59, 0.6)', borderLeft: `4px solid var(--${doc.status === 'success' ? 'success' : doc.status === 'warning' ? 'warning' : 'danger'})`, borderRadius: '4px' }}>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {doc.status === 'success' ? <CheckCircle size={16} color="var(--success)"/> : <AlertTriangle size={16} color={doc.status === 'warning' ? 'var(--warning)' : 'var(--danger)'}/>}
                    <span title={doc.name}>{doc.name}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem', marginLeft: '1.5rem' }}>
                    {doc.wordCount} words {doc.message ? `— ${doc.message}` : ''}
                  </div>
                </div>
                <button onClick={() => removeDoc(doc.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Themes */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Tag className="text-primary" /> Gen 1 Themes
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>({themes.length}/50)</span>
            </h2>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <form onSubmit={addThemeManual} style={{ flex: 1, display: 'flex', gap: '0.5rem' }}>
              <input type="text" className="input" placeholder="Type a theme..." value={themeInput} onChange={e => setThemeInput(e.target.value)} style={{ flex: 1 }} />
              <button type="submit" className="button" style={{ padding: '0.5rem' }} disabled={!themeInput.trim()}><Plus size={20}/></button>
            </form>
            <button className="button" onClick={() => themeInputRef.current.click()} style={{ backgroundColor: 'var(--border-color)', color: 'white' }}>
              Upload .json/.txt
            </button>
            <input type="file" accept=".json,.txt" ref={themeInputRef} style={{ display: 'none' }} onChange={handleThemeUpload} />
          </div>

          {/* Theme Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {themes.map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.75rem', backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#bfdbfe', borderRadius: '1rem', fontSize: '0.9rem', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
                {t}
                <button onClick={() => removeTheme(t)} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={14}/></button>
              </div>
            ))}
            {themes.length === 0 && <span style={{ color: 'var(--text-muted)' }}>No themes added yet.</span>}
          </div>
        </div>

      </div>

      {/* Floating Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
        <button 
          className="button" 
          onClick={handleProceed}
          disabled={docs.filter(d => d.status !== 'error').length === 0 || themes.length < 2}
          style={{ padding: '0.75rem 2rem', fontSize: '1.1rem' }}
        >
          Proceed to Phase 2 (Codebook Generator)
        </button>
      </div>
    </div>
  );
}

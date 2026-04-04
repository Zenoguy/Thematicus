import React, { useState, useEffect } from 'react';
import { generateFinalReport } from '../engine/pipeline';
import { FileText, Download, Loader2, Code, FileDown } from 'lucide-react';

export default function ReportPanel({ apiKey, model, masterData }) {
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasStarted = React.useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const runReport = async () => {
      console.log("[ReportPanel] starting report generation...");
      try {
        const markdown = await generateFinalReport({
          apiKey,
          model,
          masterData: masterData
        });
        console.log("[ReportPanel] report received, updating state...");
        setReport(markdown);
        setLoading(false);
      } catch (err) {
        console.error("[ReportPanel] error:", err);
        setError(err.message || 'Failed to generate final report.');
        setLoading(false);
      }
    };
    runReport();
  }, [apiKey, model, masterData]);

  const handleDownloadReport = () => {
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'thematicus_synthesis_report.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCodebook = () => {
    const jsonStr = JSON.stringify(masterData.codebook, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'thematicus_codebook_final.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="glass-panel fade-in" style={{ padding: '4rem', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
        <Loader2 className="spinning text-primary" size={48} style={{ animation: 'spin 2s linear infinite', marginBottom: '1rem' }} />
        <h2>Phase 5: Synthesizing Final Report</h2>
        <p style={{ color: 'var(--text-muted)' }}>Groq is writing the academic prose based on the structural tag intersections across {Object.keys(masterData.analyses).length} documents.</p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>This can take 30-45 seconds for a heavily saturated codebook.</p>
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel fade-in" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', textAlign: 'center', border: '1px solid var(--danger)' }}>
        <h2 style={{ color: 'var(--danger)' }}>Report Generation Failed</h2>
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '4px', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.85rem' }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header Panel */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText className="text-primary" /> Synthesis Report
          </h2>
          <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)' }}>
            Pipeline execution complete. Your qualitative analysis is finished. 
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="button" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--bg-panel)', border: '1px solid var(--primary)', color: 'var(--text-main)' }} onClick={handleDownloadCodebook}>
            <Code size={18} /> Download JSON Codebook
          </button>
          <button className="button" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--success)' }} onClick={handleDownloadReport}>
            <FileDown size={18} /> Export Markdown Report
          </button>
        </div>
      </div>

      {/* Markdown Viewport */}
      <div className="glass-panel" style={{ padding: '2rem', backgroundColor: 'rgba(15, 23, 42, 0.6)' }}>
        <div style={{ 
          whiteSpace: 'pre-wrap', 
          fontFamily: 'inherit',
          lineHeight: '1.6',
          color: 'var(--text-main)'
        }}>
          {/* Simple rendering for raw markdown text */}
          {report.split('\n').map((line, idx) => {
            if (line.startsWith('# ')) return <h1 key={idx} style={{ marginTop: '1.5rem' }}>{line.replace('# ', '')}</h1>;
            if (line.startsWith('## ')) return <h2 key={idx} style={{ marginTop: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>{line.replace('## ', '')}</h2>;
            if (line.startsWith('### ')) return <h3 key={idx} style={{ marginTop: '1rem', color: 'var(--primary)' }}>{line.replace('### ', '')}</h3>;
            if (line.startsWith('- ')) return <li key={idx} style={{ marginLeft: '1.5rem', marginBottom: '0.25rem' }}>{line.replace('- ', '')}</li>;
            if (line.trim() === '') return <br key={idx} />;
            return <p key={idx} style={{ margin: '0.5rem 0' }}>{line}</p>;
          })}
        </div>
      </div>

    </div>
  );
}

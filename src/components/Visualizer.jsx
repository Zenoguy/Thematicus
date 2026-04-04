import React, { useState } from 'react';
import { BarChart2, Network, Sun, Activity, Download, X, Quote, FileText, BarChart } from 'lucide-react';
import HeatmapChart from './charts/HeatmapChart';
import RadarChart from './charts/RadarChart';
import SunburstChart from './charts/SunburstChart';
import KnowledgeGraph from './charts/KnowledgeGraph';

export default function Visualizer({ masterData, onNext }) {
  const [activeTab, setActiveTab] = useState('heatmap');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);

  const tabs = [
    { id: 'heatmap', label: 'Heatmap', icon: <BarChart2 size={16} /> },
    { id: 'radar', label: 'Radar', icon: <Activity size={16} /> },
    { id: 'sunburst', label: 'Sunburst', icon: <Sun size={16} /> },
    { id: 'graph', label: 'Graph', icon: <Network size={16} /> },
  ];

  const getDetails = (id, docName) => {
    if (!id) return null;
    const { codebook, analyses } = masterData;
    
    // Find metadata (Theme or Subcode)
    let meta = codebook.themes.find(t => t.id === id);
    let type = 'theme';
    if (!meta) {
      codebook.themes.forEach(t => {
        const sc = (t.sub_codes || []).find(s => s.id === id);
        if (sc) {
          meta = sc;
          type = 'subcode';
        }
      });
    }

    if (!meta) return null;

    // Collect Quotes
    const quotes = [];
    Object.entries(analyses).forEach(([name, doc]) => {
      if (docName && name !== docName) return;
      const tags = (doc.tags || []).filter(tg => tg.theme_id === id || tg.sub_code_id === id);
      tags.forEach(tg => {
        (tg.quotes || []).forEach(q => quotes.push({ text: q, doc: name, context: tg.context }));
      });
    });

    return { meta, type, quotes };
  };

  const details = getDetails(selectedId, selectedDoc);

  return (
    <div className="fade-in app-container" style={{ padding: 0 }}>
      {/* Header */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart2 className="text-primary" /> Multi-dimensional Visualization
          </h2>
          <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)' }}>
            Explore your qualitative data before proceeding to the final LLM synthesis report.
          </p>
        </div>
        <button className="button" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={onNext}>
          Generate Final Report <Download size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        {tabs.map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              backgroundColor: activeTab === tab.id ? 'var(--primary)' : 'var(--bg-panel)',
              color: activeTab === tab.id ? 'white' : 'var(--text-muted)',
              border: 'none',
              borderTopLeftRadius: 'var(--radius)',
              borderTopRightRadius: 'var(--radius)',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 600 : 400
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Viewport & Detail Sidebar */}
      <div style={{ display: 'flex', gap: '1rem', height: '700px', marginTop: '0' }}>
        <div className="glass-panel" style={{ 
          flex: details ? 2 : 1,
          borderTopLeftRadius: 0, 
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          overflow: 'hidden'
        }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {activeTab === 'heatmap' && <HeatmapChart masterData={masterData} onSelect={(id, doc) => { setSelectedId(id); setSelectedDoc(doc); }} />}
            {activeTab === 'radar' && <RadarChart masterData={masterData} onSelect={setSelectedId} />}
            {activeTab === 'sunburst' && <SunburstChart masterData={masterData} onSelect={setSelectedId} />}
            {activeTab === 'graph' && <KnowledgeGraph masterData={masterData} onSelect={setSelectedId} />}
          </div>
        </div>

        {details && (
          <div className="glass-panel fade-in" style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            borderLeft: '1px solid var(--border-color)',
            backgroundColor: 'rgba(30, 41, 59, 0.6)',
            padding: '1.5rem',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', backgroundColor: details.type === 'theme' ? 'var(--primary)' : 'var(--accent)', borderRadius: '4px', textTransform: 'uppercase' }}>
                  {details.type}
                </span>
                <h3 style={{ margin: '0.5rem 0' }}>{details.meta.label}</h3>
              </div>
              <button onClick={() => { setSelectedId(null); setSelectedDoc(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20}/></button>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: 0 }}>{details.meta.definition}</p>

            <div style={{ margin: '1.5rem 0', display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1, padding: '0.75rem', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>OCCURRENCES</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{details.quotes.length}</div>
              </div>
              <div style={{ flex: 1, padding: '0.75rem', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>AVG INTENSITY</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{masterData.theme_metrics?.[selectedId]?.avg_intensity || 'N/A'}</div>
              </div>
            </div>

            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}><Quote size={18} className="text-accent" /> Quotes ({details.quotes.length})</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {details.quotes.length === 0 && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No quotes captured for this selection.</p>}
              {details.quotes.map((q, idx) => (
                <div key={idx} style={{ padding: '1rem', backgroundColor: 'rgba(255,255,255,0.03)', borderLeft: '3px solid var(--accent)', borderRadius: '0 var(--radius) var(--radius) 0' }}>
                  <p style={{ margin: 0, fontSize: '0.95rem', fontStyle: 'italic', lineHeight: '1.5' }}>"{q.text}"</p>
                  <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><FileText size={12} /> {q.doc}</div>
                  </div>
                  {q.context && <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: 'rgba(255,255,255,0.4)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>Context: {q.context}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

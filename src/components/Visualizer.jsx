import React, { useState } from 'react';
import { BarChart2, Network, Sun, Activity, Download } from 'lucide-react';
import HeatmapChart from './charts/HeatmapChart';
import RadarChart from './charts/RadarChart';
import SunburstChart from './charts/SunburstChart';
import KnowledgeGraph from './charts/KnowledgeGraph';

export default function Visualizer({ masterData, onNext }) {
  const [activeTab, setActiveTab] = useState('heatmap');

  const tabs = [
    { id: 'heatmap', label: 'Document Heatmap', icon: <BarChart2 size={16} /> },
    { id: 'radar', label: 'Intensity Radar', icon: <Activity size={16} /> },
    { id: 'sunburst', label: 'Theme Sunburst', icon: <Sun size={16} /> },
    { id: 'graph', label: 'Knowledge Graph', icon: <Network size={16} /> },
  ];

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

      {/* Viewport */}
      <div className="glass-panel" style={{ 
        borderTopLeftRadius: 0, 
        minHeight: '600px', 
        padding: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.8)'
      }}>
        {activeTab === 'heatmap' && <HeatmapChart masterData={masterData} />}
        {activeTab === 'radar' && <RadarChart masterData={masterData} />}
        {activeTab === 'sunburst' && <SunburstChart masterData={masterData} />}
        {activeTab === 'graph' && <KnowledgeGraph masterData={masterData} />}
      </div>

    </div>
  );
}

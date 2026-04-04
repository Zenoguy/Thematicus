import React, { useState, useEffect, useRef } from 'react';
import { processDocumentPhase3 } from '../engine/pipeline';
import { mergeNewCodes } from '../engine/codebookUtils';
import { saveToCache } from '../engine/storage';
import { Play, Loader2, CheckCircle, Database } from 'lucide-react';

export default function AnalysisPanel({ apiKey, model, documents, initialCodebook, existingData, onComplete }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(existingData ? documents.length : 0);
  const [logs, setLogs] = useState(existingData ? [{ 
    time: new Date().toLocaleTimeString(), 
    msg: 'Previous analysis results reloaded. Click Visualize to see detailed charts.', 
    type: 'success' 
  }] : []);
  const [currentCodebook, setCurrentCodebook] = useState(existingData ? existingData.codebook : initialCodebook);
  const [analyses, setAnalyses] = useState(existingData ? existingData.analyses : {});
  const [isDone, setIsDone] = useState(!!existingData);
  const isStarted = useRef(!!existingData);
  
  const logEndRef = useRef(null);

  const addLog = (msg, type = 'info') => {
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg, type }]);
  };

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const startAnalysis = async () => {
    setIsProcessing(true);
    addLog(`Initiating Phase 3 Pipeline...`, 'success');
    
    let workingCodebook = JSON.parse(JSON.stringify(currentCodebook));
    let workingAnalyses = {};
    let consecutiveZeroAdditions = 0;
    let saturationPoint = null;

    for (let i = 0; i < documents.length; i++) {
      setCurrentIndex(i);
      const doc = documents[i];
      addLog(`[Doc ${i+1}/${documents.length}] Processing "${doc.name}"...`);
      
      try {
        const analysisOut = await processDocumentPhase3({
          apiKey,
          model,
          document: doc,
          currentCodebook: workingCodebook,
          onProgress: (msg) => addLog(msg)
        });

        // Check for partials (if LLM returned error or stopped abruptly we'd catch in pipeline, but pipeline throws)
        const tagsCount = analysisOut.tags.length;
        const newSubs = analysisOut.new_sub_codes?.length || 0;
        const newEmergent = analysisOut.emergent_themes?.length || 0;

        addLog(`[Doc ${i+1}/${documents.length}] Tagged ${tagsCount} segments. Found ${newSubs} new sub-codes, ${newEmergent} emergent themes.`, 'success');

        // Apply mutations to codebook sequentially
        if (newSubs > 0 || newEmergent > 0) {
          workingCodebook = mergeNewCodes(workingCodebook, analysisOut.new_sub_codes, analysisOut.emergent_themes, doc.name);
          setCurrentCodebook(workingCodebook);
          consecutiveZeroAdditions = 0; // Reset on discovery
        } else {
          consecutiveZeroAdditions++;
          // Detect saturation (3 docs in a row with 0 additions)
          if (consecutiveZeroAdditions === 3 && !saturationPoint) {
            saturationPoint = doc.name;
            addLog(`Thematic saturation likely reached at "${doc.name}" (3 docs without new themes).`, 'success');
          }
        }

        workingAnalyses[doc.name] = analysisOut;
        setAnalyses({ ...workingAnalyses });
        
        // Caching checkpoint
        await saveToCache('codebook_live', workingCodebook);
        await saveToCache('analyses_live', workingAnalyses);

      } catch (err) {
        addLog(`[Doc ${i+1}/${documents.length}] Failed: ${err.message}`, 'error');
        workingAnalyses[doc.name] = { error: true, message: err.message, status: 'partial' };
      }
    }

    addLog('All documents processed successfully! Aggregating master structure...', 'success');
    
    // Enriched Aggregation for Report Writer
    const themeMetrics = {};
    workingCodebook.themes.forEach(t => {
      const intensities = Object.values(workingAnalyses)
        .map(a => a.tags?.find(tag => tag.theme_id === t.id)?.intensity || 0);
      
      const totalIntensity = intensities.reduce((sum, val) => sum + val, 0);
      const avgIntensity = intensities.length > 0 ? (totalIntensity / intensities.length) : 0;
      
      themeMetrics[t.id] = {
        avg_intensity: parseFloat(avgIntensity.toFixed(2)),
        total_occurrences: intensities.filter(v => v > 0).length
      };
    });

    const masterData = {
      codebook: workingCodebook,
      analyses: workingAnalyses,
      theme_metrics: themeMetrics,
      saturationPoint: saturationPoint
    };
    
    setIsDone(true);
    setIsProcessing(false);
    
    // Auto-proceed after a brief delay
    setTimeout(() => {
      onComplete(masterData);
    }, 2000);
  };

  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <Database className="text-primary" /> Phase 3: Sequential Pipeline Run
        </h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Thematicus is ready to dynamically code {documents.length} documents against your Codebook (v2).
          Codebook mutations will cascade sequentially.
        </p>

        {!isProcessing && !isDone && (
          <button className="button" style={{ fontSize: '1.1rem', padding: '1rem 3rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }} onClick={() => {
            if (isStarted.current) return;
            isStarted.current = true;
            startAnalysis();
          }}>
            <Play size={20} /> Run Pipeline
          </button>
        )}
      </div>

      {(isProcessing || isDone) && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          
          {/* Progress Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
            <span>Processing documents...</span>
            <span>{isDone ? documents.length : currentIndex} / {documents.length}</span>
          </div>
          <div style={{ height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1.5rem' }}>
            <div style={{ 
              height: '100%', 
              backgroundColor: 'var(--success)', 
              width: `${isDone ? 100 : (currentIndex / documents.length) * 100}%`,
              transition: 'width 0.5s ease'
            }} />
          </div>

          {/* Terminal / Live Log */}
          <div style={{ 
            backgroundColor: '#000', 
            borderRadius: 'var(--radius)', 
            padding: '1rem', 
            fontFamily: 'monospace', 
            fontSize: '0.85rem',
            height: '300px',
            overflowY: 'auto',
            border: '1px solid var(--border-color)'
          }}>
            {logs.length === 0 && <span style={{ color: 'var(--text-muted)' }}>Waiting to start...</span>}
            {logs.map((log, idx) => (
              <div key={idx} style={{ 
                marginBottom: '0.5rem', 
                color: log.type === 'error' ? 'var(--danger)' : log.type === 'success' ? 'var(--success)' : 'var(--text-main)' 
              }}>
                <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>[{log.time}]</span>
                {log.msg}
              </div>
            ))}
            {isProcessing && (
              <div style={{ color: 'var(--primary)', marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Loader2 className="spinning" size={14} style={{ animation: 'spin 2s linear infinite' }} /> Processing...
              </div>
            )}
            {isDone && (
              <div style={{ color: 'var(--success)', marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle size={14} /> Pipeline Complete. Moving to Aggregation...
              </div>
            )}
            <div ref={logEndRef} />
          </div>
          
        </div>
      )}

    </div>
  );
}

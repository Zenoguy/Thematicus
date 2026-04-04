import React from 'react';
import { Check } from 'lucide-react';

const PHASES = [
  { id: 0, label: 'Setup' },
  { id: 1, label: 'Input' },
  { id: 2, label: 'Codebook' },
  { id: 3, label: 'Analysis' },
  { id: 4, label: 'Visualize' },
  { id: 5, label: 'Report' },
];

export default function PhaseStepper({ activePhase, maxPhaseReached, onPhaseClick }) {
  return (
    <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {PHASES.map((phase, index) => {
          const isCompleted = activePhase > phase.id;
          const isActive = activePhase === phase.id;
          const isReachable = phase.id <= maxPhaseReached;

          return (
            <div key={phase.id} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div 
                onClick={() => isReachable && onPhaseClick?.(phase.id)}
                className="phase-item"
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  position: 'relative',
                  zIndex: 2,
                  cursor: isReachable ? 'pointer' : 'not-allowed',
                  opacity: isReachable ? 1 : 0.5,
                  padding: '0.5rem',
                  borderRadius: 'var(--radius)',
                  transition: 'all 0.3s ease',
                  backgroundColor: isActive ? 'rgba(255,255,255,0.05)' : 'transparent'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isCompleted ? 'var(--success)' : isActive ? 'var(--primary)' : 'var(--bg-base)',
                  border: `2px solid ${isCompleted ? 'var(--success)' : isActive ? 'var(--primary)' : 'var(--border-color)'}`,
                  color: isCompleted || isActive ? 'white' : 'var(--text-muted)',
                  boxShadow: isActive ? '0 0 15px var(--primary)' : 'none',
                  transition: 'all 0.3s ease'
                }}>
                  {isCompleted ? <Check size={16} /> : <span>{phase.id + 1}</span>}
                </div>
                <span style={{ 
                  fontSize: '0.8rem', 
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'white' : 'var(--text-muted)'
                }}>
                  {phase.label}
                </span>
              </div>
              
              {/* Connecting line */}
              {index < PHASES.length - 1 && (
                <div style={{
                  flex: 1,
                  height: '2px',
                  backgroundColor: activePhase > phase.id ? 'var(--success)' : 'var(--border-color)',
                  margin: '0 1rem',
                  transform: 'translateY(-12px)',
                  transition: 'background-color 0.3s ease'
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

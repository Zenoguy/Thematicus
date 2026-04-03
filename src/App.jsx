import React, { useReducer } from 'react';
import PhaseStepper from './components/PhaseStepper';
import SetupPanel from './components/SetupPanel';

// App State Reducer
const initialState = {
  phase: 0,
  apiKey: '',
  model: 'llama-3.3-70b-versatile',
  documents: [],
  themes: [],
  codebook: null,
  analyses: {},
  masterData: null,
  logs: [],
  cache: null
};

function reducer(state, action) {
  switch (action.type) {
    case 'SETUP_COMPLETE':
      return { 
        ...state, 
        apiKey: action.payload.apiKey, 
        model: action.payload.model,
        phase: 1 
      };
    case 'SET_PHASE':
      return { ...state, phase: action.payload };
    default:
      return state;
  }
}

function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const handleSetupComplete = (config) => {
    dispatch({ type: 'SETUP_COMPLETE', payload: config });
  };

  return (
    <div className="app-container fade-in">
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0, fontSize: '2.5rem', background: 'linear-gradient(to right, var(--primary), var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Thematicus
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>Automated Qualitative Thematic Analysis</p>
      </div>

      {/* Stepper */}
      <PhaseStepper activePhase={state.phase} />

      {/* Router (Phase Panels) */}
      <div style={{ position: 'relative' }}>
        {state.phase === 0 && <SetupPanel onComplete={handleSetupComplete} />}
        {state.phase === 1 && (
          <div className="glass-panel fade-in" style={{ padding: '3rem', textAlign: 'center' }}>
            <h2 style={{marginTop: 0}}>Phase 1: Input</h2>
            <p style={{color: 'var(--text-muted)'}}>Placeholder for InputPanel</p>
            <button className="button" onClick={() => dispatch({ type: 'SET_PHASE', payload: 2 })}>Skip to Phase 2</button>
          </div>
        )}
        {state.phase === 2 && (
          <div className="glass-panel fade-in" style={{ padding: '3rem', textAlign: 'center' }}>
            <h2 style={{marginTop: 0}}>Phase 2: Review Gate</h2>
            <p style={{color: 'var(--text-muted)'}}>Placeholder for ReviewGate</p>
          </div>
        )}
      </div>

    </div>
  );
}

export default App;

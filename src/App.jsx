import React, { useReducer } from 'react';
import PhaseStepper from './components/PhaseStepper';
import SetupPanel from './components/SetupPanel';
import InputPanel from './components/InputPanel';
import ReviewGate from './components/ReviewGate';
import AnalysisPanel from './components/AnalysisPanel';
import Visualizer from './components/Visualizer';
import ReportPanel from './components/ReportPanel';
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
    case 'INPUT_COMPLETE':
      return {
        ...state,
        documents: action.payload.documents,
        themes: action.payload.themes,
        phase: 2
      };
    case 'CODEBOOK_CONFIRMED':
      return {
        ...state,
        codebook: action.payload,
        phase: 3
      };
    case 'ANALYSIS_COMPLETE':
      return {
        ...state,
        masterData: action.payload,
        phase: 4
      };
    case 'PROCEED_REPORT':
      return {
        ...state,
        phase: 5
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

  const handleInputComplete = (data) => {
    dispatch({ type: 'INPUT_COMPLETE', payload: data });
  };

  const handleCodebookConfirmed = (finalCodebook) => {
    dispatch({ type: 'CODEBOOK_CONFIRMED', payload: finalCodebook });
  };

  const handleAnalysisComplete = (masterData) => {
    dispatch({ type: 'ANALYSIS_COMPLETE', payload: masterData });
  };

  const handleProceedReport = () => {
    dispatch({ type: 'PROCEED_REPORT' });
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
        {state.phase === 1 && <InputPanel onComplete={handleInputComplete} />}
        {state.phase === 2 && (
          <ReviewGate 
            config={{ apiKey: state.apiKey, model: state.model }}
            documents={state.documents}
            themes={state.themes}
            onComplete={handleCodebookConfirmed}
          />
        )}
        {state.phase === 3 && (
          <AnalysisPanel 
            config={{ apiKey: state.apiKey, model: state.model }}
            documents={state.documents}
            initialCodebook={state.codebook}
            onComplete={handleAnalysisComplete}
          />
        )}
        {state.phase === 4 && (
          <Visualizer 
            masterData={state.masterData}
            onNext={handleProceedReport}
          />
        )}
        {state.phase === 5 && (
          <ReportPanel 
            config={{ apiKey: state.apiKey, model: state.model }}
            masterData={state.masterData}
          />
        )}
      </div>

    </div>
  );
}

export default App;

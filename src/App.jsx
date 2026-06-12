import React from 'react';
import BOQ from './pages/BOQ';
import { useApp } from './context/AppContext';
import AuthGate from './components/auth/AuthGate';

export default function App() {
  const { editorKey } = useApp();

  // editorKey forces a clean remount when opening or starting a new BOQ.
  return (
    <AuthGate>
      <BOQ key={editorKey} />
    </AuthGate>
  );
}

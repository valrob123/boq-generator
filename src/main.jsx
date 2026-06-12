import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { SettingsProvider } from './context/SettingsContext';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import './styles/index.css';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <NotificationProvider>
          <SettingsProvider>
            <AppProvider>
              <AuthProvider>
                <App />
              </AuthProvider>
            </AppProvider>
          </SettingsProvider>
        </NotificationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const SETTINGS_KEY = 'boqdesktop:settings';

const SettingsContext = createContext(null);

function readSettings() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeSettings(next) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    /* ignore persistence failures */
  }
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(readSettings);

  const update = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      writeSettings(next);
      return next;
    });
  }, []);

  const setCompanyLogo = useCallback(
    (dataUrl) => update({ companyLogo: dataUrl || '' }),
    [update],
  );

  const setCompanyName = useCallback(
    (name) => update({ companyName: name || '' }),
    [update],
  );

  const value = useMemo(
    () => ({
      companyLogo: settings.companyLogo || '',
      companyName: settings.companyName || '',
      setCompanyLogo,
      setCompanyName,
    }),
    [settings.companyLogo, settings.companyName, setCompanyLogo, setCompanyName],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within a <SettingsProvider>');
  }
  return ctx;
}

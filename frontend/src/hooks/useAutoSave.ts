import { useEffect, useRef, useCallback } from 'react';

// Simple debounce function to avoid lodash dependency
function debounce<T extends (...args: any[]) => any>(func: T, delay: number): T & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout;
  
  const debouncedFunc = ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  }) as T & { cancel: () => void };
  
  debouncedFunc.cancel = () => {
    clearTimeout(timeoutId);
  };
  
  return debouncedFunc;
}

interface AutoSaveOptions {
  key: string;
  data: any;
  interval?: number;
  enabled?: boolean;
  onSave?: (data: any) => void;
  onRestore?: (data: any) => void;
}

export const useAutoSave = ({
  key,
  data,
  interval = 3000,
  enabled = true,
  onSave,
  onRestore
}: AutoSaveOptions) => {
  const savedDataRef = useRef<any>(null);
  const isInitializedRef = useRef(false);

  // Save to localStorage
  const saveToStorage = useCallback((dataToSave: any) => {
    if (!enabled || !dataToSave) return;

    try {
      const serializedData = JSON.stringify({
        data: dataToSave,
        timestamp: Date.now(),
        version: '1.0'
      });
      
      localStorage.setItem(`autosave_${key}`, serializedData);
      savedDataRef.current = dataToSave;
      onSave?.(dataToSave);
      
      console.log(`[AutoSave] Data saved for ${key}`);
    } catch (error) {
      console.error('[AutoSave] Failed to save data:', error);
    }
  }, [key, enabled, onSave]);

  // Debounced save function
  const debouncedSave = useCallback(
    debounce(saveToStorage, interval),
    [saveToStorage, interval]
  );

  // Restore from localStorage
  const restoreFromStorage = useCallback(() => {
    if (!enabled) return null;

    try {
      const savedItem = localStorage.getItem(`autosave_${key}`);
      if (!savedItem) return null;

      const parsed = JSON.parse(savedItem);
      const { data: savedData, timestamp } = parsed;

      // Check if data is not too old (24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (Date.now() - timestamp > maxAge) {
        clearSavedData();
        return null;
      }

      console.log(`[AutoSave] Data restored for ${key}`);
      return savedData;
    } catch (error) {
      console.error('[AutoSave] Failed to restore data:', error);
      return null;
    }
  }, [key, enabled]);

  // Clear saved data
  const clearSavedData = useCallback(() => {
    localStorage.removeItem(`autosave_${key}`);
    savedDataRef.current = null;
    console.log(`[AutoSave] Cleared data for ${key}`);
  }, [key]);

  // Check if there's saved data available
  const hasSavedData = useCallback(() => {
    const savedItem = localStorage.getItem(`autosave_${key}`);
    if (!savedItem) return false;

    try {
      const parsed = JSON.parse(savedItem);
      const maxAge = 24 * 60 * 60 * 1000;
      return Date.now() - parsed.timestamp < maxAge;
    } catch {
      return false;
    }
  }, [key]);

  // Auto-save effect
  useEffect(() => {
    if (!enabled || !data) return;

    // Skip if data hasn't changed
    if (JSON.stringify(data) === JSON.stringify(savedDataRef.current)) {
      return;
    }

    debouncedSave(data);

    // Cleanup function
    return () => {
      debouncedSave.cancel();
    };
  }, [data, enabled, debouncedSave]);

  // Initialize and restore data on mount
  useEffect(() => {
    if (!isInitializedRef.current && enabled) {
      const restoredData = restoreFromStorage();
      if (restoredData && onRestore) {
        onRestore(restoredData);
      }
      isInitializedRef.current = true;
    }
  }, [enabled, restoreFromStorage, onRestore]);

  // Save immediately (bypass debounce)
  const saveImmediately = useCallback(() => {
    if (enabled && data) {
      debouncedSave.cancel();
      saveToStorage(data);
    }
  }, [enabled, data, debouncedSave, saveToStorage]);

  return {
    saveImmediately,
    clearSavedData,
    hasSavedData,
    restoreFromStorage
  };
};
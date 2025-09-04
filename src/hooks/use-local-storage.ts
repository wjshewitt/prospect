
"use client";

import { useState, useEffect } from 'react';

// This function signature is a bit complex, but it's what allows the hook to be used
// with a value or a function update, just like useState.
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  
  // Initialize state with the initial value.
  // We will read from localStorage on the client-side in a useEffect.
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  useEffect(() => {
    // This effect runs only on the client, after the initial render.
    try {
      const item = window.localStorage.getItem(key);
      // If a value exists in localStorage, parse it and update the state.
      if (item) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      // If there's an error (e.g., in private browsing), log it and proceed with the initial value.
      console.log(error);
    }
  }, [key]); // The effect re-runs only if the key changes.

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have the same API as useState's setter
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Update the state
      setStoredValue(valueToStore);
      
      // Persist the new value to localStorage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.log(error);
    }
  };

  return [storedValue, setValue];
}


"use client"

import { useState, useEffect, useCallback } from "react";

const API_KEY_STORAGE_KEY = "helios-control-api-key";

export function useApiKey() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
      if (storedApiKey) {
        setApiKey(storedApiKey);
      }
    } catch (error) {
      console.error("Failed to load API key from localStorage:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveApiKey = useCallback((key: string) => {
    try {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
      setApiKey(key);
    } catch (error) {
      console.error("Failed to save API key to localStorage:", error);
    }
  }, []);

  const clearApiKey = useCallback(() => {
    try {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
      setApiKey(null);
    } catch (error) {
      console.error("Failed to remove API key from localStorage:", error);
    }
  }, []);

  const exportApiKey = useCallback(() => {
    if (!apiKey) return;
    const blob = new Blob([JSON.stringify({ apiKey })], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "helios-control-api-key.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [apiKey]);

  const importApiKey = useCallback((file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const result = event.target?.result;
          if (typeof result === "string") {
            const parsed = JSON.parse(result);
            if (parsed.apiKey && typeof parsed.apiKey === "string") {
              saveApiKey(parsed.apiKey);
              resolve();
            } else {
              reject(new Error("Invalid API key file format."));
            }
          } else {
            reject(new Error("Failed to read file content."));
          }
        } catch (error) {
          console.error("Error importing API key:", error);
          reject(new Error("Error processing API key file."));
        }
      };
      reader.onerror = (error) => {
        console.error("Error reading file:", error);
        reject(new Error("Could not read the file."));
      };
      reader.readAsText(file);
    });
  }, [saveApiKey]);

  return { apiKey, saveApiKey, clearApiKey, isLoading, exportApiKey, importApiKey };
}

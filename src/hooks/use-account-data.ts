
"use client";

import { useState, useEffect, useCallback } from "react";
import type { AccountData } from "@/lib/types";
import { getAccountDetails } from "@/lib/givenergy";

export function useAccountData(apiKey: string | null) {
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccountData = useCallback(async (key: string) => {
    if (!key) {
      setAccountData(null);
      setError(null); 
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAccountDetails(key);
      setAccountData(data);
    } catch (e: any) {
      console.error("Error fetching account data:", e);
      setError(e.message || "Failed to fetch account details.");
      setAccountData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (apiKey) {
      fetchAccountData(apiKey);
    } else {
      setAccountData(null);
      setError(null);
      setIsLoading(false);
    }
  }, [apiKey, fetchAccountData]);

  const refetch = useCallback(() => {
    if (apiKey) {
      fetchAccountData(apiKey);
    }
  }, [apiKey, fetchAccountData]);

  return { accountData, isLoading, error, refetch };
}

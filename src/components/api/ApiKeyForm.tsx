
"use client"

import { useEffect, useRef, useState } from "react";
import type React from "react";
import { useApiKey } from "@/hooks/use-api-key";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Keep if used, though FormLabel is preferred
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { KeyRound, Upload, Download, Trash2, Loader2 } from "lucide-react";

const apiKeyFormSchema = z.object({
  apiKey: z.string().min(1, "API Key is required."),
});

type ApiKeyFormValues = z.infer<typeof apiKeyFormSchema>;

// ApiKeyForm no longer needs onApiKeySet prop
export function ApiKeyForm() {
  const { 
    apiKey, 
    saveApiKey, 
    clearApiKey, 
    exportApiKey, 
    importApiKey, 
    isLoading: isApiKeyHookLoading, // Initial load from storage
    isProcessingNewKey // True when save/import is active (includes ID fetching)
  } = useApiKey();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeyFormSchema),
    defaultValues: {
      apiKey: apiKey || "",
    },
  });

  // Update form if apiKey from hook changes (e.g., after import or initial load)
  useEffect(() => {
    if (!isProcessingNewKey) { // Avoid resetting form while processing, could clear user input if they type fast
        form.reset({ apiKey: apiKey || "" });
    }
  }, [apiKey, form, isProcessingNewKey]);

  const onSubmit = async (data: ApiKeyFormValues) => {
    try {
      await saveApiKey(data.apiKey);
      toast({
        title: "API Key Saved",
        description: "Your GivEnergy API key has been securely stored and system identifiers fetched.",
      });
    } catch (error: any) {
      toast({
        title: "Error Saving API Key",
        description: error.message || "Failed to save API Key or fetch initial data.",
        variant: "destructive",
      });
    }
  };

  const handleClearApiKey = () => {
    clearApiKey();
    // Form will be reset by useEffect reacting to apiKey change
    toast({
      title: "API Key Cleared",
      description: "Your API key has been removed.",
    });
  };

  const handleExportApiKey = () => {
    if (!apiKey) {
       toast({
        title: "Export Failed",
        description: "No API key set to export.",
        variant: "destructive",
      });
      return;
    }
    try {
      exportApiKey();
      toast({
        title: "API Key Exported",
        description: "Your API key has been prepared for download.",
      });
    } catch (error) {
       toast({
        title: "Export Failed",
        description: "Could not export API key.",
        variant: "destructive",
      });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        await importApiKey(file);
        toast({
          title: "API Key Imported",
          description: "API key successfully imported, saved, and system identifiers fetched.",
        });
        // Form will reset via useEffect reacting to apiKey change from the hook
      } catch (e: any) {
        toast({
          title: "Import Failed",
          description: e.message || "Could not import API key from file.",
          variant: "destructive",
        });
      }
    }
  };

  // Overall loading state for the form's context (initial key load)
  if (isApiKeyHookLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="ml-2 text-sm">Loading API Key status...</p>
      </div>
    );
  }

  return (
    // No top-level Card here, as AuthenticationArea provides it.
    // This component is now focused on the form itself.
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="apiKey"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="apiKey">GivEnergy API Key</FormLabel>
                <FormControl>
                  <Input id="apiKey" type="password" placeholder="Enter your API key" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            onChange={handleFileImport}
            className="hidden"
            aria-hidden="true"
          />
        <div className="flex flex-col sm:flex-row justify-between gap-2 pt-2">
          <div className="flex gap-2 flex-wrap">
            <Button type="button" variant="outline" onClick={handleImportClick} disabled={isProcessingNewKey}>
              <Upload className="mr-2 h-4 w-4" /> Import
            </Button>
            {apiKey && (
              <Button type="button" variant="outline" onClick={handleExportApiKey} disabled={isProcessingNewKey}>
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {apiKey && (
              <Button type="button" variant="destructive" onClick={handleClearApiKey} disabled={isProcessingNewKey}>
                <Trash2 className="mr-2 h-4 w-4" /> Clear
              </Button>
            )}
            <Button type="submit" disabled={isProcessingNewKey}>
              {isProcessingNewKey ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Save Key
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}

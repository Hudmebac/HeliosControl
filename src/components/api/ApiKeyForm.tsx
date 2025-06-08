
"use client"

import { useApiKey } from "@/hooks/use-api-key";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { KeyRound, Upload, Download, Trash2, Loader2 } from "lucide-react";
import type React from "react";
import { useRef } from "react";

const apiKeyFormSchema = z.object({
  apiKey: z.string().min(1, "API Key is required.").refine(key => key.startsWith("sk_") || key === "VALID_KEY", { // Example validation
    message: "API Key format seems incorrect. It usually starts with 'sk_'.",
  }),
});

type ApiKeyFormValues = z.infer<typeof apiKeyFormSchema>;

interface ApiKeyFormProps {
  onApiKeySet: () => void;
}

export function ApiKeyForm({ onApiKeySet }: ApiKeyFormProps) {
  const { apiKey, saveApiKey, clearApiKey, exportApiKey, importApiKey, isLoading: isApiKeyLoading } = useApiKey();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeyFormSchema),
    defaultValues: {
      apiKey: apiKey || "",
    },
  });

  const {formState: {isSubmitting}} = form;

  const onSubmit = async (data: ApiKeyFormValues) => {
    try {
      saveApiKey(data.apiKey);
      toast({
        title: "API Key Saved",
        description: "Your GivEnergy API key has been securely stored.",
      });
      onApiKeySet();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save API Key.",
        variant: "destructive",
      });
    }
  };

  const handleClearApiKey = () => {
    clearApiKey();
    form.reset({ apiKey: "" });
    toast({
      title: "API Key Cleared",
      description: "Your API key has been removed.",
    });
  };

  const handleExportApiKey = () => {
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
          description: "API key successfully imported and saved.",
        });
        // Update form field with new key, need to re-fetch it from hook as it's async
        // For simplicity, user might need to see it updated or we refetch from useApiKey
        const newApiKey = localStorage.getItem("helios-control-api-key"); // quick way to get it
        form.setValue("apiKey", newApiKey || "");
        onApiKeySet();
      } catch (e: any) {
        toast({
          title: "Import Failed",
          description: e.message || "Could not import API key from file.",
          variant: "destructive",
        });
      }
    }
  };

  if (isApiKeyLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading API Key...</p>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center">
          <KeyRound className="mr-2 h-6 w-6 text-primary" />
          GivEnergy API Key
        </CardTitle>
        <CardDescription>
          Enter your GivEnergy API key to connect. Your key is stored locally in your browser.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="apiKey">API Key</FormLabel>
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
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-between gap-2">
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleImportClick} disabled={isSubmitting}>
                <Upload className="mr-2 h-4 w-4" /> Import
              </Button>
              {apiKey && (
                <Button type="button" variant="outline" onClick={handleExportApiKey} disabled={isSubmitting}>
                  <Download className="mr-2 h-4 w-4" /> Export
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {apiKey && (
                <Button type="button" variant="destructive" onClick={handleClearApiKey} disabled={isSubmitting}>
                  <Trash2 className="mr-2 h-4 w-4" /> Clear
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Save Key
              </Button>
            </div>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

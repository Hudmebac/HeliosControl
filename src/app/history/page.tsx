
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BarChart3, ArrowLeft } from "lucide-react";

export default function HistoryPage() {
  return (
    <div className="w-full space-y-8 py-8">
 <div className="absolute top-4 left-4">
        <Button variant="ghost" asChild>
          <Link href="/"><ArrowLeft className="h-4 w-4 mr-2" />Dashboard</Link>
        </Button>
      <div className="text-center">
 </div>
        <BarChart3 className="mx-auto h-16 w-16 text-primary mb-4" />
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Energy History
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Track and analyze your historical energy consumption, generation, and flow over time.
        </p>
      </div>

      <div className="max-w-2xl mx-auto bg-card p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-card-foreground mb-4">Under Development</h2>
        <p className="text-card-foreground mb-6">
          This page is currently under construction. Detailed charts and data analysis features for your energy history will be available here soon. We appreciate your patience!
        </p>
        <div className="flex justify-center">
          <Button asChild>
            <Link href="/">Return to Dashboard</Link>
          </Button>
        </div>
      </div>

      {/* Placeholder sections for future content */}
      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="bg-muted/30 p-6 rounded-lg shadow text-center border border-border/50">
          <p className="text-muted-foreground font-medium">Daily Consumption Trends</p>
          <p className="text-xs text-muted-foreground mt-1">(Chart Coming Soon)</p>
        </div>
        <div className="bg-muted/30 p-6 rounded-lg shadow text-center border border-border/50">
          <p className="text-muted-foreground font-medium">Solar Generation History</p>
          <p className="text-xs text-muted-foreground mt-1">(Chart Coming Soon)</p>
        </div>
        <div className="bg-muted/30 p-6 rounded-lg shadow text-center border border-border/50">
          <p className="text-muted-foreground font-medium">Battery Usage Patterns</p>
          <p className="text-xs text-muted-foreground mt-1">(Data Table Coming Soon)</p>
        </div>
      </div>
    </div>
  );
}

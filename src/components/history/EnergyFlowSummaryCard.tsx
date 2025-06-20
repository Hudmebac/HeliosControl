'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChartHorizontalBig } from 'lucide-react';
import type { ProcessedEnergyFlowDataPoint, EnergyFlowTypeID } from '@/lib/types';
import { ENERGY_FLOW_TYPE_DETAILS } from '@/lib/types';
import { format, parseISO, differenceInDays } from 'date-fns';

interface EnergyFlowSummaryCardProps {
  flowData: ProcessedEnergyFlowDataPoint[];
  selectedFlowTypeIDs: EnergyFlowTypeID[];
  groupingLabel?: string;
  selectedGroupingId: string; // Add selectedGroupingId prop
}

interface FlowSummaryItem {
  flowTypeName: string;
  typeId: EnergyFlowTypeID;
  totalKWh: number;
  dailyAvgKWh: number;
  notes: string;
}

function calculateStandardDeviation(arr: number[]): number {
    const n = arr.length;
    if (n === 0) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / n;
    if (n === 1) return 0; // Standard deviation is 0 for a single point
    return Math.sqrt(arr.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / (n -1)); // Use (n-1) for sample std dev
}

function generateFlowInsights(
  flowTypeDetails: { name: string; typeId: EnergyFlowTypeID },
  allEntriesForFlow: number[],
  flowDataForPeriod: ProcessedEnergyFlowDataPoint[],
  dailyAvgKWh: number,
  totalKWh: number,
  periodDays: number
): string {
    if (allEntriesForFlow.length === 0 || totalKWh < 0.01) {
        return "No significant activity recorded.";
    }

    const nonZeroEntries = allEntriesForFlow.filter(v => v > 0.01);

    if (nonZeroEntries.length === 0) {
        return "Negligible activity recorded.";
    }

    let notes: string[] = [];

    // Insight 1: Peak day for this flow
    if (nonZeroEntries.length > 0) {
        const maxVal = Math.max(...nonZeroEntries);
        const peakEntry = flowDataForPeriod.find(entry => (entry.values[flowTypeDetails.typeId] ?? 0) === maxVal);
        
        if (peakEntry) {
            const peakDayLabel = peakEntry.timeLabel;
            if (nonZeroEntries.length > 1 && maxVal > dailyAvgKWh * 1.5 && dailyAvgKWh > 0.1 && periodDays > 1) {
               notes.push(`Peaked on ${peakDayLabel} (${maxVal.toFixed(1)} kWh).`);
            } else if (nonZeroEntries.length > 2 && periodDays > 1) {
                 notes.push(`Highest on ${peakDayLabel} (${maxVal.toFixed(1)} kWh).`);
            } else if (nonZeroEntries.length === 1 && periodDays === 1) {
                notes.push(`Value: ${nonZeroEntries[0].toFixed(1)} kWh on ${peakDayLabel}.`);
            }
        }
    }


    // Insight 2: Consistency or variability
    if (nonZeroEntries.length > 2 && periodDays > 1) {
        const stdDev = calculateStandardDeviation(nonZeroEntries);
        if (dailyAvgKWh > 0.1) {
            const relativeStdDev = stdDev / dailyAvgKWh;
            if (relativeStdDev > 0.75) {
                notes.push("Varied significantly day-to-day.");
            } else if (relativeStdDev < 0.25 && nonZeroEntries.length > 1) {
                notes.push("Consistent daily usage.");
            }
        }
    }

    // Insight 3: Specific notes based on flow type
    switch (flowTypeDetails.typeId) {
        case "0": // PV to Home
            if (dailyAvgKWh > 10 && periodDays > 0) notes.push("Strong direct solar usage.");
            else if (dailyAvgKWh < 2 && totalKWh > 0.1 && periodDays > 0) notes.push("Low direct solar usage.");
            break;
        case "1": // PV to Battery
            if (dailyAvgKWh > 5 && periodDays > 0) notes.push("Significant solar charging.");
            break;
        case "2": // PV to Grid
            if (dailyAvgKWh > 5 && periodDays > 0) notes.push("Substantial solar export.");
            else if (totalKWh > 0.1 && dailyAvgKWh < 1 && periodDays > 0) notes.push("Minimal solar export.");
            break;
        case "3": // Grid to Home
            if (totalKWh < 0.1 && periodDays > 0 && !notes.some(n=>n.toLowerCase().includes("no activity"))) notes.push("No direct grid import to home.");
            else if (dailyAvgKWh > 10 && periodDays > 0) notes.push("High reliance on grid for home.");
            break;
        case "4": // Grid to Battery
             if (totalKWh < 0.1 && periodDays > 0 && !notes.some(n=>n.toLowerCase().includes("no activity"))) notes.push("No grid charging for battery.");
             else if (dailyAvgKWh > 5 && periodDays > 0) notes.push("Significant battery charging from grid.");
            break;
        case "5": // Battery to Home
            if (dailyAvgKWh > 5 && periodDays > 0) notes.push("Battery supported home consumption well.");
            break;
        case "6": // Battery to Grid
            if (totalKWh > 0.1 && dailyAvgKWh < 1 && periodDays > 0) notes.push("Minor battery export to grid.");
            else if (dailyAvgKWh > 2 && periodDays > 0) notes.push("Notable battery export to grid.");
            break;
    }
    
    if (notes.length === 0 && totalKWh > 0.01) {
        notes.push(`Total ${totalKWh.toFixed(1)} kWh over ${periodDays} ${periodDays === 1 ? "day" : "days"}.`);
    }


    return notes.slice(0, 2).join(" ").trim() || "Average/Total reflects data shown.";
}


export function EnergyFlowSummaryCard({
  flowData,
  selectedFlowTypeIDs,
  groupingLabel,
  selectedGroupingId, // Destructure the new prop
}: EnergyFlowSummaryCardProps) {
  if (!flowData || flowData.length === 0 || selectedFlowTypeIDs.length === 0) {
    return null;
  }

  let summaryPeriodString = "N/A";
  let daysCount = 0;

  if (flowData.length > 0) {
    if (flowData.length === 1) {
        const entry = flowData[0];
        summaryPeriodString = entry.timeLabel; // Use pre-formatted label for single entries
        try {
            const singleEntryStart = parseISO(entry.startTimeOriginal.split(' ')[0]);
            const singleEntryEnd = parseISO(entry.endTimeOriginal.split(' ')[0]);
            daysCount = differenceInDays(singleEntryEnd, singleEntryStart) + 1;
        } catch (e) {
            console.error("Error parsing dates for single entry daysCount:", e);
            daysCount = 1; // Fallback for single entry
        }
    } else {
        const firstDate = parseISO(flowData[0].startTimeOriginal.split(' ')[0]);
        const lastDate = parseISO(flowData[flowData.length - 1].startTimeOriginal.split(' ')[0]);
        if (format(firstDate, "yyyy-MM-dd") === format(lastDate, "yyyy-MM-dd")) {
            summaryPeriodString = format(firstDate, "MMM d, yyyy");
        } else {
            summaryPeriodString = `${format(firstDate, "MMM d")}–${format(lastDate, "MMM d, yyyy")}`;
        }
        const distinctDays = new Set(flowData.map(d => d.startTimeOriginal.split(' ')[0]));
        daysCount = distinctDays.size > 0 ? distinctDays.size : flowData.length;
    }
  }
  
  if (daysCount <= 0) daysCount = 1;

  const summaryItems: FlowSummaryItem[] = selectedFlowTypeIDs.map(typeId => {
    const flowDetail = ENERGY_FLOW_TYPE_DETAILS[typeId];
    const allEntriesForThisFlow = flowData.map(entry => entry.values[typeId] || 0);
    const totalKWh = allEntriesForThisFlow.reduce((sum, val) => sum + val, 0);
    const dailyAvgKWh = daysCount > 0 ? totalKWh / daysCount : 0;
    
    const notes = generateFlowInsights(
        { name: flowDetail.name, typeId },
        allEntriesForThisFlow,
        flowData,
        dailyAvgKWh,
        totalKWh,
        daysCount
    );

    return {
      flowTypeName: flowDetail.name,
      typeId,
      totalKWh: parseFloat(totalKWh.toFixed(2)),
      dailyAvgKWh: parseFloat(dailyAvgKWh.toFixed(2)),
      notes,
    };
  }).filter(item => item.totalKWh > 0.009); // Only show flows with more than negligible total kWh

  if (summaryItems.length === 0) {
     return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center">
                    <BarChartHorizontalBig className="mr-2 h-5 w-5 text-primary" />
                    Energy Flow Summary
                </CardTitle>
                <CardDescription>
                    Summary for the period: {summaryPeriodString} ({daysCount} {daysCount === 1 ? "day" : "days"})
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground text-center py-4">No significant energy flow data to summarize for the selected types in this period.</p>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <BarChartHorizontalBig className="mr-2 h-5 w-5 text-primary" />
          Energy Flow Summary
        </CardTitle>
        <CardDescription>
          Totals, daily averages, and insights for {groupingLabel ? groupingLabel.toLowerCase() : 'selected'} period: {summaryPeriodString} ({daysCount} {daysCount === 1 ? "day" : "days"})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Flow Type</TableHead>
              <TableHead className="text-right">Total kWh</TableHead>
              <TableHead className="text-right">Daily Avg (kWh)</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summaryItems.map((item) => (
              <TableRow key={item.typeId}>
                <TableCell className="font-medium">{item.flowTypeName}</TableCell>
                <TableCell className="text-right">{item.totalKWh.toFixed(2)}</TableCell>
                <TableCell className="text-right">{item.dailyAvgKWh.toFixed(2)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{item.notes}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}


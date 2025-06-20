
'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { BarChartHorizontalBig } from 'lucide-react';
import type { ProcessedEnergyFlowDataPoint, EnergyFlowTypeID } from '@/lib/types';
import { ENERGY_FLOW_TYPE_DETAILS } from '@/lib/types';
import { format, parseISO, differenceInDays } from 'date-fns';

interface EnergyFlowSummaryCardProps {
  flowData: ProcessedEnergyFlowDataPoint[];
  selectedFlowTypeIDs: EnergyFlowTypeID[];
  groupingLabel?: string;
}

interface FlowSummaryItem {
  flowTypeName: string;
  typeId: EnergyFlowTypeID;
  totalKWh: number;
  dailyAvgKWh: number;
}

export function EnergyFlowSummaryCard({
  flowData,
  selectedFlowTypeIDs,
  groupingLabel,
}: EnergyFlowSummaryCardProps) {
  if (!flowData || flowData.length === 0 || selectedFlowTypeIDs.length === 0) {
    return null;
  }

  let summaryPeriodString = "N/A";
  let daysCount = 0;

  if (flowData.length > 0) {
    const firstEntryDateStr = flowData[0].startTimeOriginal.split(' ')[0];
    const lastEntryDateStr = flowData[flowData.length - 1].startTimeOriginal.split(' ')[0];

    const firstDate = parseISO(firstEntryDateStr);
    const lastDate = parseISO(lastEntryDateStr);

    if (flowData.length === 1) {
      summaryPeriodString = flowData[0].timeLabel;
      const singleEntryStart = parseISO(flowData[0].startTimeOriginal.split(' ')[0]);
      const singleEntryEnd = parseISO(flowData[0].endTimeOriginal.split(' ')[0]);
      daysCount = differenceInDays(singleEntryEnd, singleEntryStart) + 1;
    } else {
      if (format(firstDate, "yyyy-MM-dd") === format(lastDate, "yyyy-MM-dd")) {
        summaryPeriodString = format(firstDate, "MMM d, yyyy");
      } else {
        summaryPeriodString = `${format(firstDate, "MMM d")}–${format(lastDate, "MMM d, yyyy")}`;
      }
      // For multiple entries, assume each distinct startTimeOriginal date is a day
      const distinctDays = new Set(flowData.map(d => d.startTimeOriginal.split(' ')[0])).size;
      daysCount = distinctDays > 0 ? distinctDays : flowData.length;
    }
  }
  
  if (daysCount <= 0) daysCount = 1; // Fallback, ensure at least 1 day if data exists

  const summaryItems: FlowSummaryItem[] = selectedFlowTypeIDs.map(typeId => {
    const flowDetail = ENERGY_FLOW_TYPE_DETAILS[typeId];
    const totalKWh = flowData.reduce((sum, entry) => sum + (entry.values[typeId] || 0), 0);
    const dailyAvgKWh = daysCount > 0 ? totalKWh / daysCount : 0;

    return {
      flowTypeName: flowDetail.name,
      typeId,
      totalKWh: parseFloat(totalKWh.toFixed(2)),
      dailyAvgKWh: parseFloat(dailyAvgKWh.toFixed(2)),
    };
  }).filter(item => item.totalKWh !== 0); // Only show flows with non-zero total kWh

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
                <p className="text-muted-foreground text-center py-4">No energy flow data to summarize for the selected types in this period.</p>
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
          Totals and daily averages for {groupingLabel ? groupingLabel.toLowerCase() : 'selected'} period: {summaryPeriodString} ({daysCount} {daysCount === 1 ? "day" : "days"})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Flow Type</TableHead>
              <TableHead className="text-right">Total kWh</TableHead>
              <TableHead className="text-right">Daily Avg (kWh)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summaryItems.map((item) => (
              <TableRow key={item.typeId}>
                <TableCell className="font-medium">{item.flowTypeName}</TableCell>
                <TableCell className="text-right">{item.totalKWh.toFixed(2)}</TableCell>
                <TableCell className="text-right">{item.dailyAvgKWh.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

"use client";

import * as React from 'react';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plug } from "lucide-react";

interface Tariff {
  name: string;
  provider: string;
  periods: {
    time: string;
    price: string;
    isCheap?: boolean;
  }[];
}

const exampleTariffs: Tariff[] = [
  {
    name: "Octopus Cosy Home",
    provider: "Octopus Energy",
    periods: [
      { time: "00:00 - 04:00", price: "27.24 p/kWh" },
    ]
  },
  {
    name: "Octopus Cheap Cosy",
    provider: "Octopus Energy",
    periods: [
      { time: "04:00 - 07:00", price: "13.36 p/kWh", isCheap: true },
    ]
  },
  {
    name: "Octopus Cosy Norm",
    provider: "Octopus Energy",
    periods: [
      { time: "07:00 - 13:00", price: "27.24 p/kWh" },
    ]
  },
  {
    name: "Octopus Cosy Afternoon",
    provider: "Octopus Energy",
    periods: [
      { time: "13:00 - 16:00", price: "13.36 p/kWh", isCheap: true },
    ]
  },
  {
    name: "Octopus Cosy Late Afternoon",
    provider: "Octopus Energy",
    periods: [
      { time: "16:00 - 19:00", price: "40.86 p/kWh" },
    ]
  },
  {
    name: "Octopus Cosy Evening",
    provider: "Octopus Energy",
    periods: [
      { time: "19:00 - 22:00", price: "27.24 p/kWh" },
    ]
  },
  {
    name: "Octopus Cosy Night",
    provider: "Octopus Energy",
    periods: [
      { time: "22:00 - 00:00", price: "13.36 p/kWh", isCheap: true },
    ]
  },
  {
    name: "Octopus Go - Cheap Rate",
    provider: "Octopus Energy",
    periods: [
      { time: "00:30 - 04:30", price: "9.50 p/kWh", isCheap: true },
    ]
  },
  {
    name: "Octopus Go - Peak Rate",
    provider: "Octopus Energy",
    periods: [
      { time: "04:30 - 00:30", price: "30.50 p/kWh" },
    ]
  },
  {
    name: "Intelligent Octopus Go - Cheap Rate",
    provider: "Octopus Energy",
    periods: [
      { time: "23:30 - 05:30", price: "7.50 p/kWh", isCheap: true },
    ]
  },
  {
    name: "Intelligent Octopus Go - Peak Rate",
    provider: "Octopus Energy",
    periods: [
      { time: "05:30 - 23:30", price: "30.50 p/kWh" },
    ]
  },
  {
    name: "Flexible Octopus (SVT)",
    provider: "Octopus Energy",
    periods: [
      { time: "00:00 - 00:00", price: "28.62 p/kWh" },
    ]
  },
  {
    name: "Octopus Agile - Variable",
    provider: "Octopus Energy",
    periods: [
      { time: "00:00 - 00:00", price: "15.00 p/kWh" },
    ]
  },
  {
    name: "British Gas Standard Variable",
    provider: "British Gas",
    periods: [
      { time: "00:00 - 00:00", price: "29.00 p/kWh" },
    ]
  },
  {
    name: "British Gas Economy 7 - Night",
    provider: "British Gas",
    periods: [
      { time: "00:30 - 07:30", price: "16.50 p/kWh", isCheap: true },
    ]
  },
  {
    name: "British Gas Economy 7 - Day",
    provider: "British Gas",
    periods: [
      { time: "07:30 - 00:30", price: "38.00 p/kWh" },
    ]
  },
  {
    name: "British Gas Electric Driver - Off-Peak",
    provider: "British Gas",
    periods: [
      { time: "00:00 - 05:00", price: "8.95 p/kWh", isCheap: true },
    ]
  },
  {
    name: "British Gas Electric Driver - Peak",
    provider: "British Gas",
    periods: [
      { time: "05:00 - 00:00", price: "32.00 p/kWh" },
    ]
  },
  {
    name: "E.ON Next Pledge (SVT Tracker)",
    provider: "E.ON Next",
    periods: [
      { time: "00:00 - 00:00", price: "28.00 p/kWh" },
    ]
  },
  {
    name: "E.ON Next Drive - Off-Peak",
    provider: "E.ON Next",
    periods: [
      { time: "00:00 - 07:00", price: "9.50 p/kWh", isCheap: true },
    ]
  },
  {
    name: "E.ON Next Drive - Peak",
    provider: "E.ON Next",
    periods: [
      { time: "07:00 - 00:00", price: "31.50 p/kWh" },
    ]
  },
  {
    name: "EDF Standard Variable",
    provider: "EDF Energy",
    periods: [
      { time: "00:00 - 00:00", price: "28.80 p/kWh" },
    ]
  },
  {
    name: "EDF GoElectric Overnight - Off-Peak",
    provider: "EDF Energy",
    periods: [
      { time: "00:00 - 05:00", price: "8.00 p/kWh", isCheap: true },
    ]
  },
  {
    name: "EDF GoElectric Overnight - Peak",
    provider: "EDF Energy",
    periods: [
      { time: "05:00 - 00:00", price: "33.00 p/kWh" },
    ]
  },
];


export default function TariffsPage() {
  return (
    <div className="w-full space-y-8 py-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl flex items-center">
          <Plug className="mr-3 h-8 w-8 text-primary" />
          Electricity Tariffs
        </h1>
        <Button variant="default" asChild style={{ backgroundColor: '#ff8c00', color: '#000000', borderColor: '#ff8c00' }}>
          <Link href="/"><ArrowLeft className="h-4 w-4 mr-2" />Dashboard</Link>
        </Button>
      </div>

      <p className="text-muted-foreground">
        Explore different electricity tariffs to understand potential costs and savings. Please note that the example tariffs below are illustrative and actual rates may vary based on your specific location, provider, and plan details. Always consult directly with energy providers for the most accurate and up-to-date information.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Octopus Energy Open API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            If you are an Octopus Energy customer, you can potentially utilize their Open API for more detailed and real-time tariff information.
          </p>
          <p>
            <a href="https://developer.octopus.energy/rest/guides/endpoints" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              🔌 Octopus Energy Open API Documentation
            </a>
          </p>
          <div className="space-y-2">
            <h4 className="text-lg font-semibold">What it offers:</h4>
            <ul className="list-disc list-inside text-muted-foreground">
              <li>Real-time and historical electricity and gas tariff data, including Agile, Go, Flux, and Tracker tariffs.</li>
              <li>Granularity: Half-hourly pricing, regional breakdowns, and full tariff metadata.</li>
              <li>Authentication: Public endpoints for tariff data; account-specific data requires an API key.</li>
              <li>Use case: Ideal for integrating dynamic pricing into your app or visualising time-of-use rates.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {exampleTariffs.map((tariff, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle>{tariff.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">{tariff.provider}</p>
              {tariff.periods.map((period, pIndex) => (
                <div key={pIndex} className="text-sm">
                  {period.time}: <span className={`font-semibold ${period.isCheap ? 'text-green-600' : ''}`}>{period.price}{period.isCheap && " (Cheap)"}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
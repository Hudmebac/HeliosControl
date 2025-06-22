
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LayoutDashboard,
  Zap,
  Settings,
  Sunrise,
  HandCoins,
  Car,
  Clock,
  ZoomIn,
  HelpCircle,
  Search,
  Building2,
  BookUser,
} from 'lucide-react';

export default function GuidePage() {
  return (
    <div className="container mx-auto py-8">
      <div className="text-center mb-8">
        <BookUser className="h-12 w-12 mx-auto text-primary mb-2" />
        <h1 className="text-4xl font-bold">Helios Control User Guide</h1>
        <p className="text-muted-foreground mt-2">Your comprehensive guide to mastering the application.</p>
      </div>
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="energy-flow">Energy Flow</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="solar-forecast">Solar Forecast</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="ev-charger">EV Charger</TabsTrigger>
          <TabsTrigger value="timed-charge">Timed Charge</TabsTrigger>
          <TabsTrigger value="deep-dive">Deep Dive</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="aj-renewables">AJ Renewables</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <ScrollArea className="h-[600px] p-4 border rounded-md">
            <div className="flex items-center mb-4">
              <LayoutDashboard className="h-8 w-8 mr-4 text-primary" />
              <h2 className="text-2xl font-semibold">Dashboard Overview</h2>
            </div>
            <p className="mb-4 text-muted-foreground">
              The Dashboard is your primary command center, offering a real-time, at-a-glance overview of your entire GivEnergy ecosystem. It's designed to provide immediate insights into your energy generation, consumption, and storage, helping you make informed decisions instantly.
            </p>

            <h3 className="text-xl font-medium mt-6 mb-2">Core Components</h3>
            <ul className="list-disc list-inside space-y-3 mb-4">
              <li>
                <strong>Energy Flow Visualisation:</strong> This dynamic diagram is the heart of the dashboard. It illustrates the live movement of electricity between the four key points of your system: Solar Panels (Generation), your Home (Consumption), the Grid (Import/Export), and your Battery (Charge/Discharge). Animated lines indicate the direction and relative magnitude of power flow.
              </li>
              <li>
                <strong>Metric Cards:</strong> Positioned around the flow diagram, these cards provide precise, real-time numerical data for each key component. This includes your current Solar Generation, Home Consumption, Battery Status and power flow, and Grid interaction. These cards offer a quick way to understand the exact performance of your system.
              </li>
            </ul>

            <h3 className="text-xl font-medium mt-6 mb-2">Purpose and Use</h3>
            <p className="mb-4">
              Use the dashboard to quickly assess your home's energy status. For example, high solar generation and low home consumption might be a good time to run high-powered appliances or charge your EV. Conversely, if you see high grid import, you might choose to defer non-essential energy use. The data refreshes automatically to keep you constantly updated.
            </p>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="energy-flow">
          <ScrollArea className="h-[600px] p-4 border rounded-md">
            <div className="flex items-center mb-4">
              <Zap className="h-8 w-8 mr-4 text-primary" />
              <h2 className="text-2xl font-semibold">Energy Flow & Cards Explained</h2>
            </div>
            <p className="mb-4 text-muted-foreground">
              Understanding the flow of energy is key to optimizing your usage. The app follows a logical priority for distributing the power you generate and store.
            </p>

            <h3 className="text-xl font-medium mt-6 mb-2">Energy Flow Priority</h3>
            <p className="mb-2">Your GivEnergy system generally prioritizes energy use in this order:</p>
            <ol className="list-decimal list-inside space-y-2 mb-4">
              <li><strong>Powering Your Home:</strong> Solar generation is first used to meet your home's immediate electricity needs.</li>
              <li><strong>Charging the Battery:</strong> Any excess solar power after meeting home demand is used to charge your battery.</li>
              <li><strong>Exporting to Grid:</strong> Once your home's needs are met and your battery is full, any remaining solar power is exported to the grid.</li>
            </ol>
            <p className="mb-4">When solar power is insufficient, the system will first discharge the battery to meet home demand, and only then will it import from the grid.</p>

            <h3 className="text-xl font-medium mt-6 mb-2">Metric Card Details</h3>
            <ul className="list-disc list-inside space-y-2 mb-4">
              <li><strong>Solar Production:</strong> Shows the current output from your PV array.</li>
              <li><strong>Home Consumption:</strong> A calculated value representing all active loads in your house.</li>
              <li><strong>Grid Status:</strong> Shows power being imported from (negative value in API, shown as "Importing") or exported to (positive value in API, shown as "Exporting") the grid.</li>
              <li><strong>Battery Status:</strong> Displays the current state of charge (SoC) as a percentage. The power value indicates charging (negative) or discharging (positive).</li>
            </ul>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="settings">
          <ScrollArea className="h-[600px] p-4 border rounded-md">
            <div className="flex items-center mb-4">
              <Settings className="h-8 w-8 mr-4 text-primary" />
              <h2 className="text-2xl font-semibold">Settings & Authentication</h2>
            </div>
            <p className="mb-4 text-muted-foreground">
              Properly configuring the application is the first step to unlocking its full potential. This section details how to manage your API key and other settings.
            </p>

            <h3 className="text-xl font-medium mt-6 mb-2">GivEnergy API Key</h3>
            <p className="mb-2">Your API key is a unique password that allows Helios Control to securely access your system's data. To get your key:</p>
            <ol className="list-decimal list-inside space-y-2 mb-4">
              <li>Log in to your <strong>GivEnergy Cloud</strong> account online.</li>
              <li>Navigate to the "API Tokens" section of your account settings.</li>
              <li>Click "Generate New Token". For best results, give it a memorable name (e.g., "Helios Control") and set it to "No Expiry".</li>
              <li><strong>Crucially, you must select "API Full Control"</strong> to grant all necessary permissions for the app to function correctly.</li>
              <li>Create and copy the token, then paste it into the API key field in this app's settings.</li>
            </ol>

            <h3 className="text-xl font-medium mt-6 mb-2">System Identifiers</h3>
            <p className="mb-4">Once you save a valid API key, the app automatically fetches your unique Inverter Serial Number and, if present, your EV Charger ID. These are required to send commands and retrieve data for the correct devices.</p>

            <h3 className="text-xl font-medium mt-6 mb-2">Dashboard Refresh Interval</h3>
            <p className="mb-4">This setting controls how frequently the dashboard automatically fetches new data. A shorter interval provides more up-to-the-minute data but increases API usage. A longer interval is less demanding. You can always use the manual refresh button for an instant update.</p>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="solar-forecast">
          <ScrollArea className="h-[600px] p-4 border rounded-md">
            <div className="flex items-center mb-4">
              <Sunrise className="h-8 w-8 mr-4 text-primary" />
              <h2 className="text-2xl font-semibold">Solar Forecast</h2>
            </div>
            <p className="mb-4 text-muted-foreground">
              This feature provides an estimate of your future solar generation, allowing you to plan your energy usage proactively.
            </p>

            <h3 className="text-xl font-medium mt-6 mb-2">Why Use the Forecast?</h3>
            <ul className="list-disc list-inside space-y-2 mb-4">
              <li><strong>Plan Ahead:</strong> See a sunny afternoon forecast? Plan to run the washing machine or dishwasher then to maximize your use of free solar energy.</li>
              <li><strong>Optimize Charging:</strong> If you know a cloudy day is coming, you might decide to charge your battery or EV from the grid during a cheap overnight tariff period.</li>
              <li><strong>Make Informed Decisions:</strong> The forecast empowers you to shift your consumption to align with peak generation times, reducing your reliance on the grid and saving money.</li>
            </ul>

            <h3 className="text-xl font-medium mt-6 mb-2">How It Works</h3>
            <p className="mb-4">Helios Control integrates with the Helios Heggie solar forecast service, which uses weather data and your system's specifications to generate a generation estimate for the upcoming period.</p>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="financials">
          <ScrollArea className="h-[600px] p-4 border rounded-md">
            <div className="flex items-center mb-4">
              <HandCoins className="h-8 w-8 mr-4 text-primary" />
              <h2 className="text-2xl font-semibold">Financials</h2>
            </div>
            <p className="mb-4 text-muted-foreground">
              The Financials page helps you understand the economic impact of your energy system by calculating estimated costs and revenues based on your specific electricity tariffs.
            </p>

            <h3 className="text-xl font-medium mt-6 mb-2">Configuration is Key</h3>
            <p className="mb-4">
              For accurate calculations, you must first set up your tariff details. You can load a preset for common tariffs (like Octopus Go) or manually enter your rates.
            </p>
            <ul className="list-disc list-inside space-y-2 mb-4">
              <li><strong>Import Tariff:</strong> This is the price you pay per kWh for electricity you import from the grid. The tool supports multiple time-based rates (e.g., a cheap overnight rate and a standard day rate).</li>
              <li><strong>Export Tariff:</strong> This is the price you are paid per kWh for excess solar or battery energy you export to the grid. This is typically a flat rate.</li>
            </ul>

            <h3 className="text-xl font-medium mt-6 mb-2">Interpreting the Results</h3>
            <ul className="list-disc list-inside space-y-2 mb-4">
              <li><strong>Import Cost:</strong> The total estimated cost of the electricity you've imported in the selected period.</li>
              <li><strong>Export Revenue:</strong> The total estimated income from the electricity you've exported.</li>
              <li><strong>Net Cost / Revenue:</strong> The final balance after subtracting your export revenue from your import cost. A positive value is a net cost; a negative value indicates you earned more than you spent.</li>
            </ul>
            <p className="text-sm italic text-muted-foreground">Disclaimer: All financial figures are estimates based on the data provided and should be used for guidance only. They may not perfectly match your utility bill due to factors like standing charges and rounding.</p>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="ev-charger">
          <ScrollArea className="h-[600px] p-4 border rounded-md">
            <div className="flex items-center mb-4">
              <Car className="h-8 w-8 mr-4 text-primary" />
              <h2 className="text-2xl font-semibold">EV Charger Controls</h2>
            </div>
            <p className="mb-4 text-muted-foreground">
              This section provides comprehensive control and monitoring for your GivEnergy EV charger, all from within Helios Control.
            </p>
            <h3 className="text-xl font-medium mt-6 mb-2">Feature Breakdown</h3>
            <ul className="list-disc list-inside space-y-3 mb-4">
              <li><strong>Overview:</strong> View the live status of your charger (e.g., Charging, Available), current power delivery, and access instant controls to Start/Stop a charge or adjust the power limit on the fly.</li>
              <li><strong>Schedules:</strong> This is the core of smart charging. You can create multiple named schedules with specific time windows, days of the week, and charging currents.
                <ul className="list-disc list-inside ml-6 mt-2">
                  <li><strong>Local vs. Device:</strong> Schedules are first saved locally in your browser. You must click "Activate" to send a schedule to the EV charger itself. The "Active on Device" badge confirms which of your local schedules matches the one currently running on the charger.</li>
                  <li><strong>Syncing:</strong> Use "Update" to pull all schedules from the device into your local list, and "Refresh" to check the current active status.</li>
                </ul>
              </li>
              <li><strong>Analytics:</strong> Dive into your charging history. View past sessions in a table and visualize energy delivered and session duration over time with interactive charts.</li>
              <li><strong>Settings (Legacy):</strong> Access older, register-based settings like "Plug & Charge" and "Solar Charging Mode". For most day-to-day use, the command-based controls in the Overview tab are recommended.</li>
            </ul>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="timed-charge">
          <ScrollArea className="h-[600px] p-4 border rounded-md">
            <div className="flex items-center mb-4">
              <Clock className="h-8 w-8 mr-4 text-primary" />
              <h2 className="text-2xl font-semibold">Inverter Timed Charge / Export</h2>
            </div>
            <p className="mb-4 text-muted-foreground">
              Take direct control of your battery's behaviour by setting timed presets. This is essential for tariff optimization, allowing you to charge from the grid when it's cheap and export back when it's profitable.
            </p>
            <h3 className="text-xl font-medium mt-6 mb-2">Understanding Presets</h3>
            <p className="mb-4">This page uses the official GivEnergy Presets API. You can create, save, and activate different modes:</p>
            <ul className="list-disc list-inside space-y-2 mb-4">
              <li><strong>Timed Charge:</strong> Instructs the inverter to charge the battery from the grid during your defined time slots (e.g., 00:30-04:30). You set a target State of Charge (SoC) for the end of the period.</li>
              <li><strong>Timed Export:</strong> Instructs the inverter to discharge the battery to the grid during your defined time slots. This is useful for "revenue stacking" on tariffs with high peak export rates.</li>
            </ul>
            <h3 className="text-xl font-medium mt-6 mb-2">How to Use</h3>
            <p className="mb-4">Similar to EV Schedules, presets are saved locally first. Create a new preset, define your time slots and charge/discharge percentages, and then click "Activate" to send the configuration to your inverter. The "Active on Device" badge will confirm when a local preset matches the inverter's current settings.</p>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="deep-dive">
          <ScrollArea className="h-[600px] p-4 border rounded-md">
            <div className="flex items-center mb-4">
              <ZoomIn className="h-8 w-8 mr-4 text-primary" />
              <h2 className="text-2xl font-semibold">Energy Data Deep Dive</h2>
            </div>
            <p className="mb-4 text-muted-foreground">
              This section explores the technical details behind the data you see in the app, helping you better understand your system's behaviour.
            </p>
            <h3 className="text-xl font-medium mt-6 mb-2">Power (kW) vs. Energy (kWh)</h3>
            <ul className="list-disc list-inside space-y-2 mb-4">
              <li><strong>Power (kW or W):</strong> This is an instantaneous measurement, like the speed of a car. It shows how much electricity is being used or generated *right now*. The dashboard's flow diagram and main metric cards primarily show power.</li>
              <li><strong>Energy (kWh):</strong> This is a measurement of power used over a period of time, like the distance a car has travelled. It represents a quantity of electricity. The History and Financials pages primarily use energy. (1 kWh = using 1 kW of power for 1 hour).</li>
            </ul>
            <h3 className="text-xl font-medium mt-6 mb-2">Key Calculation Logic</h3>
            <p className="mb-4">While many values come directly from the API, some, like Home Consumption, are calculated. The fundamental energy balance equation is:</p>
            <p className="p-3 my-2 bg-muted rounded-md text-sm italic text-center">Generation + Imports = Consumption + Exports</p>
            <p className="mb-4">Where 'Generation' includes solar and battery discharge, and 'Imports' is from the grid. 'Consumption' is your home load, and 'Exports' includes charging the battery and sending to the grid. The app solves this equation to determine where the power is flowing.</p>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="faq">
          <ScrollArea className="h-[600px] p-4 border rounded-md">
            <div className="flex items-center mb-4">
              <HelpCircle className="h-8 w-8 mr-4 text-primary" />
              <h2 className="text-2xl font-semibold">Frequently Asked Questions</h2>
            </div>

            <h3 className="text-xl font-medium mt-6 mb-2">How do I get my GivEnergy API key?</h3>
            <p className="mb-4 text-muted-foreground">Log in to the GivEnergy Cloud portal online, go to your account page, find the "API Tokens" section, and generate a new token. Ensure you select "API Full Control" for permissions. For detailed steps, see the "Settings & Authentication" tab in this guide.</p>

            <h3 className="text-xl font-medium mt-6 mb-2">Why is my energy flow diagram not updating?</h3>
            <p className="mb-4 text-muted-foreground">This can be due to several reasons: 1) Your API key might be incorrect or expired. 2) Your inverter or internet connection may be offline. 3) The GivEnergy API service might be temporarily unavailable. Check your API key in settings and ensure your system is online in the GivEnergy portal.</p>

            <h3 className="text-xl font-medium mt-6 mb-2">How accurate are the financial calculations?</h3>
            <p className="mb-4 text-muted-foreground">The calculations are estimates based on the energy data from the API and the tariff rates you provide. They are generally accurate for guidance but may differ slightly from your official utility bill, which can include other charges like standing fees, taxes, or different rounding methods.</p>

            <h3 className="text-xl font-medium mt-6 mb-2">What data does Helios Control collect?</h3>
            <p className="mb-4 text-muted-foreground">Helios Control is designed with privacy in mind. Your API key and any saved schedules or presets are stored *locally* in your browser's storage. They are not sent to any server other than the official GivEnergy API for data retrieval and command execution. The application itself is static and does not have a backend database for user data.</p>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="search">
          <ScrollArea className="h-[600px] p-4 border rounded-md">
            <div className="flex items-center mb-4">
              <Search className="h-8 w-8 mr-4 text-primary" />
              <h2 className="text-2xl font-semibold">Search</h2>
            </div>
            <p className="mb-4 text-muted-foreground">
              A comprehensive search feature for this guide is planned for a future update. This will allow you to quickly find specific information across all sections of the user manual. Please check back later!
            </p>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="aj-renewables">
          <ScrollArea className="h-[600px] p-4 border rounded-md">
            <div className="flex items-center mb-4">
              <Building2 className="h-8 w-8 mr-4 text-primary" />
              <h2 className="text-2xl font-semibold">About AJ Renewables</h2>
            </div>
            <p className="mb-4 text-muted-foreground">
              AJ Renewables is a leading UK-based provider of bespoke renewable energy solutions, committed to helping homeowners and businesses reduce their carbon footprint and secure their energy future.
            </p>

            <h3 className="text-xl font-medium mt-6 mb-2">Core Services</h3>
            <ul className="list-disc list-inside space-y-2 mb-4">
              <li>Solar PV Systems</li>
              <li>Battery Storage Solutions (GivEnergy, Tesla, etc.)</li>
              <li>EV Charging Point Installation</li>
              <li>Air Source Heat Pumps (ASHPs)</li>
              <li>Solar Thermal Systems</li>
            </ul>

            <h3 className="text-xl font-medium mt-6 mb-2">Why Choose AJ Renewables?</h3>
            <ul className="list-disc list-inside space-y-2 mb-4">
              <li>Fully accredited (MCS, NICEIC, RECC, HIES).</li>
              <li>Extensive experience and customer-focused approach.</li>
              <li>Full turnkey service from design to installation and handover.</li>
              <li>Commitment to quality products and workmanship.</li>
            </ul>
            <p className="text-sm mt-4">For more information or to get a free, no-obligation quote, visit the dedicated <a href="/aj_renewables_info" className="text-primary underline">AJ Renewables Info Page</a>.</p>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

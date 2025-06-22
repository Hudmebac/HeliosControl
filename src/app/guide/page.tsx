
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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10">
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
        </TabsList>

        <TabsContent value="dashboard">
          <ScrollArea className="h-[600px] p-4 border rounded-md">
            <div className="flex items-center mb-4">
              <LayoutDashboard className="h-8 w-8 mr-4 text-primary" />
              <h2 className="text-2xl font-semibold">Dashboard Overview</h2>
            </div>
            <p className="mb-4 text-muted-foreground">
              The Dashboard is your primary command centre, offering a real-time, at-a-glance overview of your entire GivEnergy ecosystem. It's designed to provide immediate insights into your energy generation, consumption, and storage, helping you make informed decisions instantly. The data refreshes automatically at an interval you can set in the settings menu.
            </p>

            <h3 className="text-xl font-medium mt-6 mb-2">Core Components</h3>
            <ul className="list-disc list-inside space-y-4 mb-4">
              <li>
                <strong>Energy Flow Visualisation:</strong> This dynamic diagram is the heart of the dashboard. It illustrates the live movement of electricity between the four key points of your system: Solar Panels (Generation), your Home (Consumption), the Grid (Import/Export), and your Battery (Charge/Discharge). Animated, pulsing lines indicate the direction and relative magnitude of the power flow, allowing you to see exactly where your energy is coming from and going to at any moment.
              </li>
              <li>
                <strong>Metric Cards:</strong> Positioned around the flow diagram, these cards provide precise, real-time numerical data for each key component. This includes your current Solar Generation, Home Consumption, Battery State of Charge (SoC) and power flow, and Grid interaction (import/export). These cards offer a quick way to understand the exact performance figures of your system, supplementing the visual flow diagram.
              </li>
            </ul>

            <h3 className="text-xl font-medium mt-6 mb-2">Purpose and Use</h3>
            <p className="mb-4">
              Use the dashboard to quickly assess your home's energy status. For example, seeing high solar generation and low home consumption is the perfect time to run high-powered appliances like a washing machine or to charge your electric vehicle, maximising your use of free, self-generated energy. Conversely, if you observe high grid import during peak hours, you might choose to defer non-essential energy use until a cheaper tariff period. The dashboard is your guide to becoming more energy-efficient and cost-effective.
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
              Understanding the logical flow of energy in your system is key to optimising your usage and savings. The GivEnergy system is designed to prioritise self-consumption of your generated solar power.
            </p>

            <h3 className="text-xl font-medium mt-6 mb-2">Energy Flow Priority</h3>
            <p className="mb-2">When your solar panels are generating electricity, your GivEnergy system prioritises its use in the following order:</p>
            <ol className="list-decimal list-inside space-y-2 mb-4">
              <li><strong>Powering Your Home:</strong> All solar generation is first directed to meet your home's immediate electricity needs.</li>
              <li><strong>Charging the Battery:</strong> Once home demand is met, any excess solar power is used to charge your battery storage system.</li>
              <li><strong>Exporting to the Grid:</strong> After your home's needs are satisfied and your battery is fully charged, any remaining surplus solar power is exported to the national grid, potentially earning you revenue via an export tariff.</li>
            </ol>
            <p className="mb-4">When solar power is insufficient to meet your home's demand, the system will first discharge the battery. Only when the battery is depleted (or has reached its reserve limit) will the system import electricity from the grid.</p>

            <h3 className="text-xl font-medium mt-6 mb-2">Metric Card Details</h3>
            <ul className="list-disc list-inside space-y-2 mb-4">
              <li><strong>Solar Production:</strong> Shows the instantaneous power output from your PV array in kilowatts (kW) or watts (W).</li>
              <li><strong>Home Consumption:</strong> A calculated value representing the total electrical load of your house at that moment.</li>
              <li><strong>Grid Status:</strong> Displays the power being imported from or exported to the grid. The dashboard indicates the direction of flow clearly.</li>
              <li><strong>Battery Status:</strong> Shows the current State of Charge (SoC) as a percentage. The power value here indicates charging (typically shown as an inflow) or discharging (as an outflow).</li>
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
              Properly configuring the application is the first step to unlocking its full potential. This section details how to manage your API key, which is your secure key to your system's data.
            </p>

            <h3 className="text-xl font-medium mt-6 mb-2">Obtaining Your GivEnergy API Key</h3>
            <p className="mb-2">Your API key is a unique password that allows Helios Control to securely access your system's data. It is stored locally in your browser and never sent anywhere else. To get your key:</p>
            <ol className="list-decimal list-inside space-y-2 mb-4">
              <li>Log in to your <strong>GivEnergy Cloud</strong> account online (not the mobile app).</li>
              <li>Navigate to your account settings and find the "API Tokens" section.</li>
              <li>Click "Generate New Token". We recommend giving it a memorable name (e.g., "Helios Control") and setting the expiry to "No Expiry" for uninterrupted use.</li>
              <li><strong>Crucially, you must select the top checkbox for "API Full Control".</strong> This grants the necessary permissions for Helios Control to not only read data but also send commands, such as starting/stopping your EV charger or setting battery charge times.</li>
              <li>Create and copy the new token. Paste it into the API key field in this app's settings and click "Save".</li>
            </ol>

            <h3 className="text-xl font-medium mt-6 mb-2">System Identifiers & Refresh Rate</h3>
            <p className="mb-2">Once you save a valid API key, the app automatically discovers and stores your unique Inverter Serial Number and EV Charger ID (if you have one). These are essential for the app to function correctly.</p>
            <p className="mb-4">The <strong>Dashboard Refresh Interval</strong> controls how frequently the app fetches new data. A shorter interval (e.g., 5-10 seconds) gives you a near-live view but uses more of your GivEnergy API allowance. A longer interval is less demanding. You can always use the manual refresh button in the header for an instant update regardless of this setting.</p>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="solar-forecast">
          <ScrollArea className="h-[600px] p-4 border rounded-md">
            <div className="flex items-center mb-4">
              <Sunrise className="h-8 w-8 mr-4 text-primary" />
              <h2 className="text-2xl font-semibold">Solar Forecast</h2>
            </div>
            <p className="mb-4 text-muted-foreground">
              This feature provides an estimate of your future solar generation, allowing you to plan your energy usage proactively and make smarter decisions.
            </p>

            <h3 className="text-xl font-medium mt-6 mb-2">Why Use the Forecast?</h3>
            <p className="mb-2">The forecast helps you to:</p>
            <ul className="list-disc list-inside space-y-2 mb-4">
              <li><strong>Plan Appliance Use:</strong> See a sunny afternoon forecast? That's the ideal time to schedule your washing machine, dishwasher, or tumble dryer to run on free solar energy.</li>
              <li><strong>Optimise Charging Schedules:</strong> If you know a cloudy day is coming, you might decide to schedule your battery or EV to charge from the grid during a cheap overnight tariff period, ensuring you have enough stored energy for the next day.</li>
              <li><strong>Maximise Self-Consumption:</strong> The forecast empowers you to shift your energy consumption to align with peak generation times, reducing your reliance on expensive grid electricity and saving money. Seeing a clear forecast for tomorrow gives you the confidence to delay high-consumption tasks.</li>
            </ul>

            <h3 className="text-xl font-medium mt-6 mb-2">How It Works</h3>
            <p className="mb-4">Helios Control integrates with an external solar forecast service (Helios Heggie) that uses your system's specifications (like location and panel orientation, if available) combined with up-to-date weather data to generate a detailed generation estimate for the upcoming period.</p>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="financials">
          <ScrollArea className="h-[600px] p-4 border rounded-md">
            <div className="flex items-center mb-4">
              <HandCoins className="h-8 w-8 mr-4 text-primary" />
              <h2 className="text-2xl font-semibold">Financials</h2>
            </div>
            <p className="mb-4 text-muted-foreground">
              The Financials page helps you understand the economic impact of your energy system by calculating estimated costs and revenues. To get started, you must configure your specific electricity tariff details.
            </p>

            <h3 className="text-xl font-medium mt-6 mb-2">Configuration is Key</h3>
            <p className="mb-4">
              For accurate calculations, you must first set up your tariffs. You can load a preset for common agile tariffs or manually enter your rates. All rates should be entered in pence per kilowatt-hour (p/kWh).
            </p>
            <ul className="list-disc list-inside space-y-2 mb-4">
              <li><strong>Import Tariff:</strong> This is the price you pay per kWh for electricity you import from the grid. The tool supports multiple time-based rates, allowing you to define peak, off-peak, and standard periods accurately.</li>
              <li><strong>Export Tariff:</strong> This is the rate you are paid per kWh for any surplus energy you export to the grid. This is often a flat rate but can be configured as needed.</li>
            </ul>

            <h3 className="text-xl font-medium mt-6 mb-2">Interpreting the Results</h3>
            <ul className="list-disc list-inside space-y-2 mb-4">
              <li><strong>Import Cost:</strong> The total estimated cost (£) of the electricity you've imported in the selected period.</li>
              <li><strong>Export Revenue:</strong> The total estimated income (£) from the electricity you've exported.</li>
              <li><strong>Net Cost / Revenue:</strong> The final balance after subtracting export revenue from your import cost. A positive value is a net cost; a negative value indicates you earned more than you spent.</li>
            </ul>
            <p className="text-sm italic text-muted-foreground">Disclaimer: All financial figures are estimates based on the data from the GivEnergy API and the rates you provide. They are for guidance only and may not perfectly match your utility bill due to factors like standing charges, VAT, and rounding differences.</p>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="ev-charger">
          <ScrollArea className="h-[600px] p-4 border rounded-md">
            <div className="flex items-center mb-4">
              <Car className="h-8 w-8 mr-4 text-primary" />
              <h2 className="text-2xl font-semibold">EV Charger Controls</h2>
            </div>
            <p className="mb-4 text-muted-foreground">
              This dedicated section provides comprehensive control and monitoring for your GivEnergy EV charger, allowing you to manage your vehicle charging intelligently.
            </p>
            <h3 className="text-xl font-medium mt-6 mb-2">Feature Breakdown</h3>
            <ul className="list-disc list-inside space-y-3 mb-4">
              <li><strong>Overview:</strong> View the live status of your charger (e.g., Charging, Available), the current power delivery in kW, and access instant controls to Start/Stop a charge or adjust the charge power limit on the fly.</li>
              <li><strong>Schedules:</strong> This is the core of smart charging. Create multiple named schedules with specific time windows, days of the week, and charging currents (Amps).
                <ul className="list-disc list-inside ml-6 mt-2">
                  <li><strong>Local vs. Device:</strong> Schedules are first created and saved "locally" in your browser's storage. To make a schedule active, you must click the "Activate" button, which sends it to the physical EV charger device. The "Active on Device" badge confirms which of your local schedules is currently running on the charger.</li>
                  <li><strong>Syncing:</strong> Use the "Update" button to pull all schedules from the device into your local list. This is useful for importing schedules you may have set up via the official GivEnergy app.</li>
                </ul>
              </li>
              <li><strong>Analytics:</strong> Dive into your charging history. View past sessions in a table and visualise the energy delivered and session duration over time with interactive charts. This helps you track your EV's energy consumption and associated costs.</li>
              <li><strong>Settings (Legacy):</strong> Access older, register-based settings like "Plug & Charge" mode. For most day-to-day use, the modern, command-based controls in the Overview and Schedules tabs are recommended.</li>
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
              Take direct control of your battery's charging and discharging behaviour by setting timed presets. This is the most powerful tool for tariff optimisation, allowing you to force your battery to charge from the grid when electricity is cheap and export back to the grid when the price is high.
            </p>
            <h3 className="text-xl font-medium mt-6 mb-2">Understanding Presets</h3>
            <p className="mb-4">This page uses the official GivEnergy Presets API. You can create, save, and activate different modes for your inverter:</p>
            <ul className="list-disc list-inside space-y-2 mb-4">
              <li><strong>Timed Charge:</strong> Instructs the inverter to charge the battery from the grid during your defined time slots (e.g., 00:30-04:30 for an overnight tariff). You set a target State of Charge (SoC) for the battery to reach by the end of the period.</li>
              <li><strong>Timed Export:</strong> Instructs the inverter to discharge the battery to the grid during your defined time slots. This is perfect for "revenue stacking" on tariffs with high peak export rates (e.g., Octopus Flux), allowing you to sell stored energy for a profit.</li>
            </ul>
            <h3 className="text-xl font-medium mt-6 mb-2">Practical Example</h3>
            <p className="mb-4">To optimise for a variable tariff, you could set a 'Timed Charge' preset to charge your battery to 100% between 00:30 and 04:30 when the import rate is 9p/kWh. You could then create and activate a 'Timed Export' preset to discharge the battery to its reserve limit between 16:00 and 19:00, selling that energy back to the grid for 35p/kWh.</p>
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
            <p className="mb-4">It is vital to understand the difference between power and energy:</p>
            <ul className="list-disc list-inside space-y-2 mb-4">
              <li><strong>Power (kW or W):</strong> This is an instantaneous measurement, like the speed of a car. It shows how much electricity is being used or generated *right now*. The dashboard's flow diagram and main metric cards primarily show power.</li>
              <li><strong>Energy (kWh):</strong> This is a measurement of power used over a period of time, like the distance a car has travelled. It represents a quantity of electricity. The History and Financials pages primarily use energy. (1 kWh is the energy consumed by a 1 kW appliance running for 1 hour).</li>
            </ul>
            <h3 className="text-xl font-medium mt-6 mb-2">Key Calculation Logic</h3>
            <p className="mb-4">While many values come directly from the API, some, like Home Consumption, are calculated. The fundamental energy balance equation is: "Energy In = Energy Out". The app uses the following logic:</p>
            <p className="p-3 my-2 bg-muted rounded-md text-sm italic text-center">(Solar Generation + Battery Discharge + Grid Import) = (Home Consumption + Battery Charge + Grid Export)</p>
            <p className="mb-4">By knowing most of these values from the API, the app can calculate the remaining unknown, which is typically your total home consumption.</p>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="faq">
          <ScrollArea className="h-[600px] p-4 border rounded-md">
            <div className="flex items-center mb-4">
              <HelpCircle className="h-8 w-8 mr-4 text-primary" />
              <h2 className="text-2xl font-semibold">Frequently Asked Questions</h2>
            </div>

            <h3 className="text-xl font-medium mt-6 mb-2">Why are my dashboard values not updating?</h3>
            <p className="mb-4 text-muted-foreground">This can be due to several reasons: 1) Your API key might be incorrect, expired, or lack "Full Control" permissions. Please generate a new one. 2) Your home internet or the inverter's connection to it may be down. 3) The GivEnergy API service might be temporarily unavailable. Check your API key in settings and ensure your system is showing as "online" in the official GivEnergy portal.</p>

            <h3 className="text-xl font-medium mt-6 mb-2">Why don't the financial calculations exactly match my utility bill?</h3>
            <p className="mb-4 text-muted-foreground">The calculations are estimates based on the energy data from the API and the tariff rates you provide. They are very accurate for guidance but will likely differ slightly from your official bill. This is because your utility bill also includes daily standing charges, VAT, and may use different rounding methods, which are not factored into the app's calculations.</p>

            <h3 className="text-xl font-medium mt-6 mb-2">Is my data secure? What does Helios Control collect?</h3>
            <p className="mb-4 text-muted-foreground">Helios Control is designed with privacy as a priority. Your GivEnergy API key, along with any saved EV charger or inverter presets, are stored *only* in your local browser storage on your device. This data is never sent to any server other than the official GivEnergy API for data retrieval and command execution. The application itself is "serverless" and does not have its own backend database to store any user data.</p>
            
            <h3 className="text-xl font-medium mt-6 mb-2">Why do the figures sometimes differ from the official GivEnergy app?</h3>
            <p className="mb-4 text-muted-foreground">Minor discrepancies can occur due to differences in data refresh timing between the two applications. Both apps use the same core API data, but may fetch it at slightly different intervals, leading to small, temporary variations in the "live" values displayed.</p>
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
      </Tabs>
    </div>
  );
}

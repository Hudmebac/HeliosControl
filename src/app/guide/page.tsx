'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
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
import { Input } from '@/components/ui/input';

export default function GuidePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold flex items-center">
            <BookUser className="mr-3 h-8 w-8 text-primary" />
            Helios Guide
        </h1>
        <Button variant="default" asChild>
            <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
            </Link>
        </Button>
    </div>
   
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search guide..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {searchQuery.length > 0 && (
        <div className="mb-6 p-4 border rounded-md bg-muted/40">
          <h3 className="text-lg font-semibold mb-2">Search Results:</h3>
          {Object.entries({
            'dashboard': {
              title: 'Dashboard Overview',
              content: `The Dashboard is your primary command centre, offering a real-time, at-a-glance overview of your entire GivEnergy ecosystem. It is designed to provide immediate insights into your energy generation, consumption, and storage, helping you make informed decisions instantly. The data refreshes automatically at an interval you can set in the settings menu, or you can perform a manual refresh at any time using the refresh button in the header.
            Core Components: This dynamic diagram is the heart of the dashboard. It illustrates the live movement of electricity between the four key points of your system: Solar Panels (Generation), your Home (Consumption), the Grid (Import/Export), and your Battery (Charge/Discharge). Animated, pulsing lines indicate the direction and relative magnitude of the power flow, allowing you to see precisely where your energy is coming from and going to at any moment. Metric Cards: Positioned around the flow diagram, these cards provide precise, real-time numerical data for each key component. This includes your current Solar Generation, Home Consumption, Battery State of Charge (SoC) and power flow, and Grid interaction (import/export). These cards offer a quick way to understand the exact performance figures of your system, supplementing the visual flow diagram.
            Purpose and Use: Use the dashboard to quickly assess your home's energy status. For example, seeing high solar generation and low home consumption is the perfect time to run high-powered appliances like a washing machine or to charge your electric vehicle, maximising your use of free, self-generated energy. Conversely, if you observe high grid import during peak hours, you might choose to defer non-essential energy use until a cheaper tariff period. The dashboard is your guide to becoming more energy-efficient and cost-effective. By understanding the live flow, you can adapt your behaviour to reduce your carbon footprint and your energy bills.`,
            },
            'energy-flow': {
              title: 'Energy Flow & Cards Explained',
              content: `Understanding the logical flow of energy in your system is key to optimising your usage and savings. The GivEnergy system is designed to prioritise self-consumption of your generated solar power, ensuring you use as much of your own free electricity as possible before interacting with the grid.
            Energy Flow Priority: When your solar panels are generating electricity, your GivEnergy system prioritises its use in the following order: Powering Your Home: All solar generation is first directed to meet your home's immediate electricity needs. This is the most efficient use of your solar power. Charging the Battery: Once home demand is met, any excess solar power is used to charge your battery storage system. This stores the energy for later use, for instance, during the evening or on cloudy days. Exporting to the Grid: After your home's needs are satisfied and your battery is fully charged, any remaining surplus solar power is exported to the national grid. Depending on your energy tariff, you may be paid for this exported energy. When solar power is insufficient to meet your home's demand, the system will first discharge the battery to power your home. Only when the battery is depleted (or has reached its reserve limit, which you can configure) will the system import electricity from the grid.
            Metric Card Details: Solar Production: Shows the instantaneous power output from your PV array in kilowatts (kW) or watts (W). This figure fluctuates based on the intensity of sunlight. Home Consumption: A calculated value representing the total electrical load of your house at that moment. This is the sum of all appliances, lighting, and devices currently running. Grid Status: Displays the power being imported from or exported to the grid. The dashboard indicates the direction of flow clearly. Positive values mean export, negative values (or an 'importing' label) mean import. Battery Status: Shows the current State of Charge (SoC) as a percentage, and the rate at which it is charging or discharging in kW or W. A positive power value indicates discharging, while a negative value indicates charging.`,
            },
            'settings': {
              title: 'Settings & Authentication',
              content: `Properly configuring the application is the first step to unlocking its full potential. This section details how to manage your API key, which is your secure credential for accessing your system's data.
            Obtaining Your GivEnergy API Key: Your API key is a unique password that allows Helios Control to securely access your system's data. It is stored locally in your browser and never sent anywhere else. To get your key: Log in to your GivEnergy Cloud account online (this cannot be done via the mobile app). Navigate to your account settings and find the "API Tokens" section. Click "Generate New Token". We recommend giving it a memorable name (e.g., "Helios Control") and setting the expiry to "No Expiry" for uninterrupted use. Crucially, you must select the top checkbox for "API Full Control". This grants the necessary permissions for Helios Control to not only read data but also send commands, such as starting/stopping your EV charger or setting battery charge times. Without full control, some features may not work. Create and copy the new token. Paste it into the API key field in this app's settings (click the cog icon in the header) and click "Save". The app should then automatically detect your system identifiers.
            System Identifiers & Refresh Rate: Once you save a valid API key, the app automatically discovers and stores your unique Inverter Serial Number and EV Charger ID (if you have one). These are essential for the app to function correctly and are stored locally in your browser. You can view them in the settings panel. The Dashboard Refresh Interval controls how frequently the app fetches new data. A shorter interval (e.g., 5-10 seconds) gives you a near-live view but uses more of your GivEnergy API allowance and may lead to rate-limiting if set too low. A longer interval is less demanding. You can always use the manual refresh button in the header for an instant update regardless of this setting.`,
            },
            'solar-forecast': {
              title: 'Solar Forecast',
              content: `This feature provides an estimate of your future solar generation, allowing you to plan your energy usage proactively and make smarter decisions about when to use high-consumption appliances.
            Why Use the Forecast? The forecast helps you to: Plan Appliance Use: See a sunny afternoon forecast? That's the ideal time to schedule your washing machine, dishwasher, or tumble dryer to run on free solar energy, rather than expensive grid electricity. Optimise Charging Schedules: If you know a cloudy day is coming, you might decide to schedule your battery or EV to charge from the grid during a cheap overnight tariff period, ensuring you have enough stored energy for the next day without being caught short. Maximise Self-Consumption: The forecast empowers you to shift your energy consumption to align with peak generation times, reducing your reliance on expensive grid electricity and saving money. Seeing a clear forecast for tomorrow gives you the confidence to delay high-consumption tasks.
            How It Works: Helios Control integrates with an external solar forecast service (Helios Heggie) that uses your system's specifications (like location, panel orientation, and tilt, if available) combined with up-to-date meteorological data to generate a detailed generation estimate for the upcoming period. This gives you a powerful planning tool beyond just looking at the current weather.`,
            },
            'financials': {
              title: 'Financials',
              content: `The Financials page helps you understand the economic impact of your energy system by calculating estimated costs and revenues. To get accurate results, you must configure your specific electricity tariff details.
            Configuration is Key: For accurate calculations, you must first set up your tariffs on the "Tariff Setup" tab. You can load a preset for common agile tariffs or manually enter your rates. All rates should be entered in pence per kilowatt-hour (p/kWh). Import Tariff: This is the price you pay per kWh for electricity you import from the grid. The tool supports multiple time-based rates, allowing you to define peak, off-peak, and standard periods accurately to match your energy bill. Export Tariff: This is the rate you are paid per kWh for any surplus energy you export to the grid. This is often a flat rate but can be configured as needed if you are on a variable export tariff.
            Interpreting the Results: Once configured, select a day or week to view the financial breakdown: Total Import/Export (kWh): The total volume of energy moved to and from the grid. Import Cost: The total estimated cost (£) of the electricity you've imported in the selected period. Export Revenue: The total estimated income (£) from the electricity you've exported. Net Cost / Revenue: The final balance after subtracting export revenue from your import cost. A positive value is a net cost; a negative value indicates you earned more than you spent. Disclaimer: All financial figures are estimates based on the data from the GivEnergy API and the rates you provide. They are for guidance only and may not perfectly match your utility bill due to factors like standing charges, VAT, and rounding differences.`,
            },
            'ev-charger': {
              title: 'EV Charger Controls',
              content: `This dedicated section provides comprehensive control and monitoring for your GivEnergy EV charger, allowing you to manage your vehicle charging intelligently and cost-effectively.
            Feature Breakdown: Overview: View the live status of your charger (e.g., Charging, Available), the current power delivery in kW, and access instant controls to Start/Stop a charge or adjust the charge power limit on the fly. This is useful for immediate, manual control. Schedules: This is the core of smart charging. Create multiple named schedules with specific time windows, days of the week, and charging currents (Amps). Local vs. Device: Schedules are first created and saved "locally" in your browser's storage for this application. To make a schedule active, you must click the "Activate" button, which sends it to the physical EV charger device. The "Active on Device" badge confirms which of your local schedules is currently running on the charger. Syncing: Use the "Update" button to pull all schedules from the device into your local list. This is useful for importing schedules you may have set up via the official GivEnergy app or another interface. Analytics: Dive into your charging history. View past sessions in a table and visualise the energy delivered and session duration over time with interactive charts. This helps you track your EV's energy consumption and associated costs. Settings (Legacy): Access older, register-based settings like "Plug & Charge" mode. For most day-to-day use, the modern, command-based controls in the Overview and Schedules tabs are recommended.`,
            },
            'timed-charge': {
              title: 'Inverter Timed Charge / Export',
              content: `Take direct control of your battery's charging and discharging behaviour by setting timed presets. This is the most powerful tool for tariff optimisation, allowing you to force your battery to charge from the grid when electricity is cheap and export back to the grid when the price is high.
            Understanding Presets: This page uses the official GivEnergy Presets API. You can create, save, and activate different modes for your inverter: Timed Charge: Instructs the inverter to charge the battery from the grid during your defined time slots (e.g., 00:30-04:30 for an overnight tariff). You set a target State of Charge (SoC) for the battery to reach by the end of the period. This is essential for ensuring your battery is full of cheap energy for the day ahead. Timed Export: Instructs the inverter to discharge the battery to the grid during your defined time slots. This is perfect for "revenue stacking" on tariffs with high peak export rates (e.g., Octopus Flux), allowing you to sell stored energy for a profit. You can set a lower SoC limit to ensure you don't fully deplete your battery.
            Practical Example: To optimise for a variable tariff, you could set a 'Timed Charge' preset to charge your battery to 100% between 00:30 and 04:30 when the import rate is 9p/kWh. You could then create and activate a 'Timed Export' preset to discharge the battery to its reserve limit (e.g., 10%) between 16:00 and 19:00, selling that energy back to the grid for 35p/kWh. This page allows you to manage these strategies effectively.`,
            },
            'deep-dive': {
              title: 'Energy Data Deep Dive',
              content: `This section explores the technical details behind the data you see in the app, helping you better understand your system's behaviour and the terminology used.
            Power (kW) vs. Energy (kWh): It is vital to understand the difference between power and energy, as they are often confused: Power (kW or W): This is an instantaneous measurement, like the speed of a car. It shows how much electricity is being used or generated *right now*. A higher power rating means more electricity is flowing at that moment. The dashboard's flow diagram and main metric cards primarily show power. Energy (kWh): This is a measurement of power used over a period of time, like the distance a car has travelled. It represents a quantity of electricity. Your electricity bill is based on the kWh you consume. The History and Financials pages primarily use energy. (1 kWh is the energy consumed by a 1 kW appliance running for 1 hour).
            Key Calculation Logic: While many values come directly from the API, some, like Home Consumption, are calculated. The fundamental energy balance equation is: "Energy In = Energy Out". The app uses the following logic: (Solar Generation + Battery Discharge + Grid Import) = (Home Consumption + Battery Charge + Grid Export) By knowing most of these values from the API, the app can calculate the remaining unknown, which is typically your total home consumption. This is why the home consumption figure is an accurate representation of your house's total load, even without a dedicated meter on every circuit.`,
            },
            'faq': {
              title: 'Frequently Asked Questions',
              content: `Why are my dashboard values not updating? This can be due to several reasons: 1) Your API key might be incorrect, expired, or lack "Full Control" permissions. Please generate a new one following the instructions in the Settings tab of this guide. 2) Your home internet or the inverter's connection to it may be down. 3) The GivEnergy API service might be temporarily unavailable. Check your API key in settings and ensure your system is showing as "online" in the official GivEnergy portal.
            Why don't the financial calculations exactly match my utility bill? The calculations are estimates based on the energy data from the API and the tariff rates you provide. They are very accurate for guidance but will likely differ slightly from your official bill. This is because your utility bill also includes daily standing charges, VAT, and may use different rounding methods, which are not factored into the app's calculations.
            Is my data secure? What does Helios Control collect? Helios Control is designed with privacy as a priority. Your GivEnergy API key, along with any saved EV charger or inverter presets, are stored *only* in your local browser storage on your device. This data is never sent to any server other than the official GivEnergy API for data retrieval and command execution. The application itself is "serverless" and does not have its own backend database to store any user data.\n            
            Why do the figures sometimes differ from the official GivEnergy app? Minor discrepancies can occur due to differences in data refresh timing between the two applications. Both apps use the same core API data, but may fetch it at slightly different intervals, leading to small, temporary variations in the "live" values displayed. Furthermore, this app may use slightly different calculations for derived values like "Home Consumption", which can lead to minor differences.`,
            },
          }).filter(([, { content }]) =>
            content && typeof content === 'string' && content.toLowerCase().includes(searchQuery.toLowerCase())
          ).map(([value, { title }]) => (
            <button
              key={value}
              className="block text-primary hover:underline mb-1 text-left"
              onClick={() => {
                setActiveTab(value);
                setSearchQuery(''); // Clear search after clicking a result
              }}
            >
              {title}
            </button>
          ))}
          {Object.keys({
             'dashboard': {
              title: 'Dashboard Overview',
              content: `The Dashboard is your primary command centre, offering a real-time, at-a-glance overview of your entire GivEnergy ecosystem. It is designed to provide immediate insights into your energy generation, consumption, and storage, helping you make informed decisions instantly. The data refreshes automatically at an interval you can set in the settings menu, or you can perform a manual refresh at any time using the refresh button in the header.
            Core Components: This dynamic diagram is the heart of the dashboard. It illustrates the live movement of electricity between the four key points of your system: Solar Panels (Generation), your Home (Consumption), the Grid (Import/Export), and your Battery (Charge/Discharge). Animated, pulsing lines indicate the direction and relative magnitude of the power flow, allowing you to see precisely where your energy is coming from and going to at any moment. Metric Cards: Positioned around the flow diagram, these cards provide precise, real-time numerical data for each key component. This includes your current Solar Generation, Home Consumption, Battery State of Charge (SoC) and power flow, and Grid interaction (import/export). These cards offer a quick way to understand the exact performance figures of your system, supplementing the visual flow diagram.
            Purpose and Use: Use the dashboard to quickly assess your home's energy status. For example, seeing high solar generation and low home consumption is the perfect time to run high-powered appliances like a washing machine or to charge your electric vehicle, maximising your use of free, self-generated energy. Conversely, if you observe high grid import during peak hours, you might choose to defer non-essential energy use until a cheaper tariff period. The dashboard is your guide to becoming more energy-efficient and cost-effective. By understanding the live flow, you can adapt your behaviour to reduce your carbon footprint and your energy bills.`,
            },
            'energy-flow': {
              title: 'Energy Flow & Cards Explained',
              content: `Understanding the logical flow of energy in your system is key to optimising your usage and savings. The GivEnergy system is designed to prioritise self-consumption of your generated solar power, ensuring you use as much of your own free electricity as possible before interacting with the grid.
            Energy Flow Priority: When your solar panels are generating electricity, your GivEnergy system prioritises its use in the following order: Powering Your Home: All solar generation is first directed to meet your home's immediate electricity needs. This is the most efficient use of your solar power. Charging the Battery: Once home demand is met, any excess solar power is used to charge your battery storage system. This stores the energy for later use, for instance, during the evening or on cloudy days. Exporting to the Grid: After your home's needs are satisfied and your battery is fully charged, any remaining surplus solar power is exported to the national grid. Depending on your energy tariff, you may be paid for this exported energy. When solar power is insufficient to meet your home's demand, the system will first discharge the battery to power your home. Only when the battery is depleted (or has reached its reserve limit, which you can configure) will the system import electricity from the grid.
            Metric Card Details: Solar Production: Shows the instantaneous power output from your PV array in kilowatts (kW) or watts (W). This figure fluctuates based on the intensity of sunlight. Home Consumption: A calculated value representing the total electrical load of your house at that moment. This is the sum of all appliances, lighting, and devices currently running. Grid Status: Displays the power being imported from or exported to the grid. The dashboard indicates the direction of flow clearly. Positive values mean export, negative values (or an 'importing' label) mean import. Battery Status: Shows the current State of Charge (SoC) as a percentage, and the rate at which it is charging or discharging in kW or W. A positive power value indicates discharging, while a negative value indicates charging.`,
            },
            'settings': {
              title: 'Settings & Authentication',
              content: `Properly configuring the application is the first step to unlocking its full potential. This section details how to manage your API key, which is your secure credential for accessing your system's data.
            Obtaining Your GivEnergy API Key: Your API key is a unique password that allows Helios Control to securely access your system's data. It is stored locally in your browser and never sent anywhere else. To get your key: Log in to your GivEnergy Cloud account online (this cannot be done via the mobile app). Navigate to your account settings and find the "API Tokens" section. Click "Generate New Token". We recommend giving it a memorable name (e.g., "Helios Control") and setting the expiry to "No Expiry" for uninterrupted use. Crucially, you must select the top checkbox for "API Full Control". This grants the necessary permissions for Helios Control to not only read data but also send commands, such as starting/stopping your EV charger or setting battery charge times. Without full control, some features may not work. Create and copy the new token. Paste it into the API key field in this app's settings (click the cog icon in the header) and click "Save". The app should then automatically detect your system identifiers.
            System Identifiers & Refresh Rate: Once you save a valid API key, the app automatically discovers and stores your unique Inverter Serial Number and EV Charger ID (if you have one). These are essential for the app to function correctly and are stored locally in your browser. You can view them in the settings panel. The Dashboard Refresh Interval controls how frequently the app fetches new data. A shorter interval (e.g., 5-10 seconds) gives you a near-live view but uses more of your GivEnergy API allowance and may lead to rate-limiting if set too low. A longer interval is less demanding. You can always use the manual refresh button in the header for an instant update regardless of this setting.`,
            },
            'solar-forecast': {
              title: 'Solar Forecast',
              content: `This feature provides an estimate of your future solar generation, allowing you to plan your energy usage proactively and make smarter decisions about when to use high-consumption appliances.
            Why Use the Forecast? The forecast helps you to: Plan Appliance Use: See a sunny afternoon forecast? That's the ideal time to schedule your washing machine, dishwasher, or tumble dryer to run on free solar energy, rather than expensive grid electricity. Optimise Charging Schedules: If you know a cloudy day is coming, you might decide to schedule your battery or EV to charge from the grid during a cheap overnight tariff period, ensuring you have enough stored energy for the next day without being caught short. Maximise Self-Consumption: The forecast empowers you to shift your energy consumption to align with peak generation times, reducing your reliance on expensive grid electricity and saving money. Seeing a clear forecast for tomorrow gives you the confidence to delay high-consumption tasks.`,
            },
            'financials': {
              title: 'Financials',
              content: `The Financials page helps you understand the economic impact of your energy system by calculating estimated costs and revenues. To get accurate results, you must configure your specific electricity tariff details.
            Configuration is Key: For accurate calculations, you must first set up your tariffs on the "Tariff Setup" tab. You can load a preset for common agile tariffs or manually enter your rates. All rates should be entered in pence per kilowatt-hour (p/kWh). Import Tariff: This is the price you pay per kWh for electricity you import from the grid. The tool supports multiple time-based rates, allowing you to define peak, off-peak, and standard periods accurately to match your energy bill. Export Tariff: This is the rate you are paid per kWh for any surplus energy you export to the grid. This is often a flat rate but can be configured as needed if you are on a variable export tariff.
            Interpreting the Results: Once configured, select a day or week to view the financial breakdown: Total Import/Export (kWh): The total volume of energy moved to and from the grid. Import Cost: The total estimated cost (£) of the electricity you've imported in the selected period. Export Revenue: The total estimated income (£) from the electricity you've exported. Net Cost / Revenue: The final balance after subtracting export revenue from your import cost. A positive value is a net cost; a negative value indicates you earned more than you spent. Disclaimer: All financial figures are estimates based on the data from the GivEnergy API and the rates you provide. They are for guidance only and may not perfectly match your utility bill due to factors like standing charges, VAT, and rounding differences.`,
            },
            'ev-charger': {
              title: 'EV Charger Controls',
              content: `This dedicated section provides comprehensive control and monitoring for your GivEnergy EV charger, allowing you to manage your vehicle charging intelligently and cost-effectively.
            Feature Breakdown: Overview: View the live status of your charger (e.g., Charging, Available), the current power delivery in kW, and access instant controls to Start/Stop a charge or adjust the charge power limit on the fly. This is useful for immediate, manual control. Schedules: This is the core of smart charging. Create multiple named schedules with specific time windows, days of the week, and charging currents (Amps). Local vs. Device: Schedules are first created and saved "locally" in your browser's storage for this application. To make a schedule active, you must click the "Activate" button, which sends it to the physical EV charger device. The "Active on Device" badge confirms which of your local schedules is currently running on the charger. Syncing: Use the "Update" button to pull all schedules from the device into your local list. This is useful for importing schedules you may have set up via the official GivEnergy app or another interface. Analytics: Dive into your charging history. View past sessions in a table and visualise the energy delivered and session duration over time with interactive charts. This helps you track your EV's energy consumption and associated costs. Settings (Legacy): Access older, register-based settings like "Plug & Charge" mode. For most day-to-day use, the modern, command-based controls in the Overview and Schedules tabs are recommended.`,
            },
            'timed-charge': {
              title: 'Inverter Timed Charge / Export',
              content: `Take direct control of your battery's charging and discharging behaviour by setting timed presets. This is the most powerful tool for tariff optimisation, allowing you to force your battery to charge from the grid when electricity is cheap and export back to the grid when the price is high.
            Understanding Presets: This page uses the official GivEnergy Presets API. You can create, save, and activate different modes for your inverter: Timed Charge: Instructs the inverter to charge the battery from the grid during your defined time slots (e.g., 00:30-04:30 for an overnight tariff). You set a target State of Charge (SoC) for the battery to reach by the end of the period. This is essential for ensuring your battery is full of cheap energy for the day ahead. Timed Export: Instructs the inverter to discharge the battery to the grid during your defined time slots. This is perfect for "revenue stacking" on tariffs with high peak export rates (e.g., Octopus Flux), allowing you to sell stored energy for a profit. You can set a lower SoC limit to ensure you don't fully deplete your battery.
            Practical Example: To optimise for a variable tariff, you could set a 'Timed Charge' preset to charge your battery to 100% between 00:30 and 04:30 when the import rate is 9p/kWh. You could then create and activate a 'Timed Export' preset to discharge the battery to its reserve limit (e.g., 10%) between 16:00 and 19:00, selling that energy back to the grid for 35p/kWh. This page allows you to manage these strategies effectively.`,
            },
            'deep-dive': {
              title: 'Energy Data Deep Dive',
              content: `This section explores the technical details behind the data you see in the app, helping you better understand your system's behaviour and the terminology used.
            Power (kW) vs. Energy (kWh): It is vital to understand the difference between power and energy, as they are often confused: Power (kW or W): This is an instantaneous measurement, like the speed of a car. It shows how much electricity is being used or generated *right now*. A higher power rating means more electricity is flowing at that moment. The dashboard's flow diagram and main metric cards primarily show power. Energy (kWh): This is a measurement of power used over a period of time, like the distance a car has travelled. It represents a quantity of electricity. Your electricity bill is based on the kWh you consume. The History and Financials pages primarily use energy. (1 kWh is the energy consumed by a 1 kW appliance running for 1 hour).
            Key Calculation Logic: While many values come directly from the API, some, like Home Consumption, are calculated. The fundamental energy balance equation is: "Energy In = Energy Out". The app uses the following logic: (Solar Generation + Battery Discharge + Grid Import) = (Home Consumption + Battery Charge + Grid Export) By knowing most of these values from the API, the app can calculate the remaining unknown, which is typically your total home consumption. This is why the home consumption figure is an accurate representation of your house's total load, even without a dedicated meter on every circuit.`,
            },
            'faq': {
              title: 'Frequently Asked Questions',
              content: `Why are my dashboard values not updating? This can be due to several reasons: 1) Your API key might be incorrect, expired, or lack "Full Control" permissions. Please generate a new one following the instructions in the Settings tab of this guide. 2) Your home internet or the inverter's connection to it may be down. 3) The GivEnergy API service might be temporarily unavailable. Check your API key in settings and ensure your system is showing as "online" in the official GivEnergy portal.
            Why don't the financial calculations exactly match my utility bill? The calculations are estimates based on the energy data from the API and the tariff rates you provide. They are very accurate for guidance but will likely differ slightly from your official bill. This is because your utility bill also includes daily standing charges, VAT, and may use different rounding methods, which are not factored into the app's calculations.
            Is my data secure? What does Helios Control collect? Helios Control is designed with privacy as a priority. Your GivEnergy API key, along with any saved EV charger or inverter presets, are stored *only* in your local browser storage on your device. This data is never sent to any server other than the official GivEnergy API for data retrieval and command execution. The application itself is "serverless" and does not have its own backend database to store any user data.
            Why do the figures sometimes differ from the official GivEnergy app? Minor discrepancies can occur due to differences in data refresh timing between the two applications. Both apps use the same core API data, but may fetch it at slightly different intervals, leading to small, temporary variations in the "live" values displayed. Furthermore, this app may use slightly different calculations for derived values like "Home Consumption", which can lead to minor differences.`,
            },
          }).filter(([, { content }]) =>
             content && typeof content === 'string' && content.toLowerCase().includes(searchQuery.toLowerCase())
          ).length === 0 && (
            <p className="text-muted-foreground">No results found.</p>
          )}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex overflow-x-auto whitespace-nowrap w-full grid-cols-2 lg:grid-cols-9 scrollbar-hide">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="energy-flow">Energy Flow</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="solar-forecast">Solar Forecast</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="ev-charger">EV Charger</TabsTrigger>
          <TabsTrigger value="timed-charge">Timed Charge</TabsTrigger>
          <TabsTrigger value="deep-dive">Deep Dive</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <ScrollArea className="h-[600px] p-4 border rounded-md">
            <div className="flex items-center mb-4">
              <LayoutDashboard className="h-8 w-8 mr-4 text-primary" />
              <h2 className="text-2xl font-semibold">Dashboard Overview</h2>
            </div>
            <p className="mb-4 text-muted-foreground">
              The Dashboard is your primary command centre, offering a real-time, at-a-glance overview of your entire GivEnergy ecosystem. It is designed to provide immediate insights into your energy generation, consumption, and storage, helping you make informed decisions instantly. The data refreshes automatically at an interval you can set in the settings menu, or you can perform a manual refresh at any time using the refresh button in the header.
            </p>

            <h3 className="text-xl font-medium mt-6 mb-2">Core Components</h3>
            <ul className="list-disc list-inside space-y-4 mb-4">
              <li>
                <strong>Energy Flow Visualisation:</strong> This dynamic diagram is the heart of the dashboard. It illustrates the live movement of electricity between the four key points of your system: Solar Panels (Generation), your Home (Consumption), the Grid (Import/Export), and your Battery (Charge/Discharge). Animated, pulsing lines indicate the direction and relative magnitude of the power flow, allowing you to see precisely where your energy is coming from and going to at any moment.
              </li>
              <li>
                <strong>Metric Cards:</strong> Positioned around the flow diagram, these cards provide precise, real-time numerical data for each key component. This includes your current Solar Generation, Home Consumption, Battery State of Charge (SoC) and power flow, and Grid interaction (import/export). These cards offer a quick way to understand the exact performance figures of your system, supplementing the visual flow diagram.
              </li>
            </ul>

            <h3 className="text-xl font-medium mt-6 mb-2">Purpose and Use</h3>
            <p className="mb-4">
              Use the dashboard to quickly assess your home&apos;s energy status. For example, seeing high solar generation and low home consumption is the perfect time to run high-powered appliances like a washing machine or to charge your electric vehicle, maximising your use of free, self-generated energy. Conversely, if you observe high grid import during peak hours, you might choose to defer non-essential energy use until a cheaper tariff period. The dashboard is your guide to becoming more energy-efficient and cost-effective. By understanding the live flow, you can adapt your behaviour to reduce your carbon footprint and your energy bills.
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
              Understanding the logical flow of energy in your system is key to optimising your usage and savings. The GivEnergy system is designed to prioritise self-consumption of your generated solar power, ensuring you use as much of your own free electricity as possible before interacting with the grid.
            </p>

            <h3 className="text-xl font-medium mt-6 mb-2">Energy Flow Priority</h3>
            <p className="mb-2">When your solar panels are generating electricity, your GivEnergy system prioritises its use in the following order:</p>
            <ol className="list-decimal list-inside space-y-2 mb-4">
              <li><strong>Powering Your Home:</strong> All solar generation is first directed to meet your home&apos;s immediate electricity needs. This is the most efficient use of your solar power.</li>
              <li><strong>Charging the Battery:</strong> Once home demand is met, any excess solar power is used to charge your battery storage system. This stores the energy for later use, for instance, during the evening or on cloudy days.</li>
              <li><strong>Exporting to the Grid:</strong> After your home&apos;s needs are satisfied and your battery is fully charged, any remaining surplus solar power is exported to the national grid. Depending on your energy tariff, you may be paid for this exported energy.</li>
            </ol>
            <p className="mb-4">When solar power is insufficient to meet your home&apos;s demand, the system will first discharge the battery to power your home. Only when the battery is depleted (or has reached its reserve limit, which you can configure) will the system import electricity from the grid.</p>

            <h3 className="text-xl font-medium mt-6 mb-2">Metric Card Details</h3>
            <ul className="list-disc list-inside space-y-2 mb-4">
              <li><strong>Solar Production:</strong> Shows the instantaneous power output from your PV array in kilowatts (kW) or watts (W). This figure fluctuates based on the intensity of sunlight.</li>
              <li><strong>Home Consumption:</strong> A calculated value representing the total electrical load of your house at that moment. This is the sum of all appliances, lighting, and devices currently running.</li>
              <li><strong>Grid Status:</strong> Displays the power being imported from or exported to the grid. The dashboard indicates the direction of flow clearly. Positive values mean export, negative values (or an 'importing' label) mean import.</li>
              <li><strong>Battery Status:</strong> Shows the current State of Charge (SoC) as a percentage, and the rate at which it is charging or discharging in kW or W. A positive power value indicates discharging, while a negative value indicates charging.</li>
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
              Properly configuring the application is the first step to unlocking its full potential. This section details how to manage your API key, which is your secure credential for accessing your system&apos;s data.
            </p>

            <h3 className="text-xl font-medium mt-6 mb-2">Obtaining Your GivEnergy API Key</h3>
            <p className="mb-2">Your API key is a unique password that allows Helios Control to securely access your system&apos;s data. It is stored locally in your browser and never sent anywhere else. To get your key:</p>
            <ol className="list-decimal list-inside space-y-2 mb-4">
              <li>Log in to your <strong>GivEnergy Cloud</strong> account online (this cannot be done via the mobile app).</li>
              <li>Navigate to your account settings and find the &quot;API Tokens&quot; section.</li>
              <li>Click &quot;Generate New Token&quot;. We recommend giving it a memorable name (e.g., &quot;Helios Control&quot;) and setting the expiry to &quot;No Expiry&quot; for uninterrupted use.</li>
              <li><strong>Crucially, you must select the top checkbox for &quot;API Full Control&quot;.</strong> This grants the necessary permissions for Helios Control to not only read data but also send commands, such as starting/stopping your EV charger or setting battery charge times. Without full control, some features may not work.</li>
              <li>Create and copy the new token. Paste it into the API key field in this app&apos;s settings (click the cog icon in the header) and click &quot;Save&quot;. The app should then automatically detect your system identifiers.</li>
            </ol>

            <h3 className="text-xl font-medium mt-6 mb-2">System Identifiers & Refresh Rate</h3>
            <p className="mb-2">Once you save a valid API key, the app automatically discovers and stores your unique Inverter Serial Number and EV Charger ID (if you have one). These are essential for the app to function correctly and are stored locally in your browser. You can view them in the settings panel.</p>
            <p className="mb-4">The <strong>Dashboard Refresh Interval</strong> controls how frequently the app fetches new data. A shorter interval (e.g., 5-10 seconds) gives you a near-live view but uses more of your GivEnergy API allowance and may lead to rate-limiting if set too low. A longer interval is less demanding. You can always use the manual refresh button in the header for an instant update regardless of this setting.</p>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="solar-forecast">
          <ScrollArea className="h-[600px] p-4 border rounded-md">
            <div className="flex items-center mb-4">
              <Sunrise className="h-8 w-8 mr-4 text-primary" />
              <h2 className="text-2xl font-semibold">Solar Forecast</h2>
            </div>
            <p className="mb-4 text-muted-foreground">
              This feature provides an estimate of your future solar generation, allowing you to plan your energy usage proactively and make smarter decisions about when to use high-consumption appliances.
            </p>

            <h3 className="text-xl font-medium mt-6 mb-2">Why Use the Forecast?</h3>
            <p className="mb-2">The forecast helps you to:</p>
            <ul className="list-disc list-inside space-y-2 mb-4">
              <li><strong>Plan Appliance Use:</strong> See a sunny afternoon forecast? That&apos;s the ideal time to schedule your washing machine, dishwasher, or tumble dryer to run on free solar energy, rather than expensive grid electricity.</li>
              <li><strong>Optimise Charging Schedules:</strong> If you know a cloudy day is coming, you might decide to schedule your battery or EV to charge from the grid during a cheap overnight tariff period, ensuring you have enough stored energy for the next day without being caught short.</li>
              <li><strong>Maximise Self-Consumption:</strong> The forecast empowers you to shift your energy consumption to align with peak generation times, reducing your reliance on expensive grid electricity and saving money. Seeing a clear forecast for tomorrow gives you the confidence to delay high-consumption tasks.</li>
            </ul>

            <h3 className="text-xl font-medium mt-6 mb-2">How It Works</h3>
            <p className="mb-4">Helios Control integrates with an external solar forecast service (Helios Heggie) that uses your system&apos;s specifications (like location, panel orientation, and tilt, if available) combined with up-to-date meteorological data to generate a detailed generation estimate for the upcoming period. This gives you a powerful planning tool beyond just looking at the current weather.</p>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="financials">
          <ScrollArea className="h-[600px] p-4 border rounded-md">
            <div className="flex items-center mb-4">
              <HandCoins className="h-8 w-8 mr-4 text-primary" />
              <h2 className="text-2xl font-semibold">Financials</h2>
            </div>
            <p className="mb-4 text-muted-foreground">
              The Financials page helps you understand the economic impact of your energy system by calculating estimated costs and revenues. To get accurate results, you must configure your specific electricity tariff details.
            </p>

            <h3 className="text-xl font-medium mt-6 mb-2">Configuration is Key</h3>
            <p className="mb-4">
              For accurate calculations, you must first set up your tariffs on the &quot;Tariff Setup&quot; tab. You can load a preset for common agile tariffs or manually enter your rates. All rates should be entered in pence per kilowatt-hour (p/kWh).
            </p>
            <ul className="list-disc list-inside space-y-2 mb-4">
              <li><strong>Import Tariff:</strong> This is the price you pay per kWh for electricity you import from the grid. The tool supports multiple time-based rates, allowing you to define peak, off-peak, and standard periods accurately to match your energy bill.</li>
              <li><strong>Export Tariff:</strong> This is the rate you are paid per kWh for any surplus energy you export to the grid. This is often a flat rate but can be configured as needed if you are on a variable export tariff.</li>
            </ul>

            <h3 className="text-xl font-medium mt-6 mb-2">Interpreting the Results</h3>
            <p className="mb-2">Once configured, select a day or week to view the financial breakdown:</p>
            <ul className="list-disc list-inside space-y-2 mb-4">
              <li><strong>Total Import/Export (kWh):</strong> The total volume of energy moved to and from the grid.</li>
              <li><strong>Import Cost:</strong> The total estimated cost (£) of the electricity you&apos;ve imported in the selected period.</li>
              <li><strong>Export Revenue:</strong> The total estimated income (£) from the electricity you&apos;ve exported.</li>
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
              This dedicated section provides comprehensive control and monitoring for your GivEnergy EV charger, allowing you to manage your vehicle charging intelligently and cost-effectively.
            </p>
            <h3 className="text-xl font-medium mt-6 mb-2">Feature Breakdown</h3>
            <ul className="list-disc list-inside space-y-3 mb-4">
              <li><strong>Overview:</strong> View the live status of your charger (e.g., Charging, Available), the current power delivery in kW, and access instant controls to Start/Stop a charge or adjust the charge power limit on the fly. This is useful for immediate, manual control.</li>
              <li><strong>Schedules:</strong> This is the core of smart charging. Create multiple named schedules with specific time windows, days of the week, and charging currents (Amps).
                <ul className="list-disc list-inside ml-6 mt-2">
                  <li><strong>Local vs. Device:</strong> Schedules are first created and saved &quot;locally&quot; in your browser&apos;s storage for this application. To make a schedule active, you must click the &quot;Activate&quot; button, which sends it to the physical EV charger device. The &quot;Active on Device&quot; badge confirms which of your local schedules is currently running on the charger.</li>
                  <li><strong>Syncing:</strong> Use the &quot;Update&quot; button to pull all schedules from the device into your local list. This is useful for importing schedules you may have set up via the official GivEnergy app or another interface.</li>
                </ul>
              </li>
              <li><strong>Analytics:</strong> Dive into your charging history. View past sessions in a table and visualise the energy delivered and session duration over time with interactive charts. This helps you track your EV&apos;s energy consumption and associated costs.</li>
              <li><strong>Settings (Legacy):</strong> Access older, register-based settings like &quot;Plug & Charge&quot; mode. For most day-to-day use, the modern, command-based controls in the Overview and Schedules tabs are recommended.</li>
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
              Take direct control of your battery&apos;s charging and discharging behaviour by setting timed presets. This is the most powerful tool for tariff optimisation, allowing you to force your battery to charge from the grid when electricity is cheap and export back to the grid when the price is high.
            </p>
            <h3 className="text-xl font-medium mt-6 mb-2">Understanding Presets</h3>
            <p className="mb-4">This page uses the official GivEnergy Presets API. You can create, save, and activate different modes for your inverter:</p>
            <ul className="list-disc list-inside space-y-2 mb-4">
              <li><strong>Timed Charge:</strong> Instructs the inverter to charge the battery from the grid during your defined time slots (e.g., 00:30-04:30 for an overnight tariff). You set a target State of Charge (SoC) for the battery to reach by the end of the period. This is essential for ensuring your battery is full of cheap energy for the day ahead.</li>
              <li><strong>Timed Export:</strong> Instructs the inverter to discharge the battery to the grid during your defined time slots. This is perfect for &quot;revenue stacking&quot; on tariffs with high peak export rates (e.g., Octopus Flux), allowing you to sell stored energy for a profit. You can set a lower SoC limit to ensure you don&apos;t fully deplete your battery.</li>
            </ul>
            <h3 className="text-xl font-medium mt-6 mb-2">Practical Example</h3>
            <p className="mb-4">To optimise for a variable tariff, you could set a &apos;Timed Charge&apos; preset to charge your battery to 100% between 00:30 and 04:30 when the import rate is 9p/kWh. You could then create and activate a &apos;Timed Export&apos; preset to discharge the battery to its reserve limit (e.g., 10%) between 16:00 and 19:00, selling that energy back to the grid for 35p/kWh. This page allows you to manage these strategies effectively.</p>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="deep-dive">
          <ScrollArea className="h-[600px] p-4 border rounded-md">
            <div className="flex items-center mb-4">
              <ZoomIn className="h-8 w-8 mr-4 text-primary" />
              <h2 className="text-2xl font-semibold">Energy Data Deep Dive</h2>
            </div>
            <p className="mb-4 text-muted-foreground">
              This section explores the technical details behind the data you see in the app, helping you better understand your system&apos;s behaviour and the terminology used.
            </p>
            <h3 className="text-xl font-medium mt-6 mb-2">Power (kW) vs. Energy (kWh)</h3>
            <p className="mb-4">It is vital to understand the difference between power and energy, as they are often confused:</p>
            <ul className="list-disc list-inside space-y-2 mb-4">
              <li><strong>Power (kW or W):</strong> This is an instantaneous measurement, like the speed of a car. It shows how much electricity is being used or generated *right now*. A higher power rating means more electricity is flowing at that moment. The dashboard&apos;s flow diagram and main metric cards primarily show power.</li>
              <li><strong>Energy (kWh):</strong> This is a measurement of power used over a period of time, like the distance a car has travelled. It represents a quantity of electricity. Your electricity bill is based on the kWh you consume. The History and Financials pages primarily use energy. (1 kWh is the energy consumed by a 1 kW appliance running for 1 hour).</li>
            </ul>
            <h3 className="text-xl font-medium mt-6 mb-2">Key Calculation Logic</h3>
            <p className="mb-4">While many values come directly from the API, some, like Home Consumption, are calculated. The fundamental energy balance equation is: &quot;Energy In = Energy Out&quot;. The app uses the following logic:</p>
            <p className="p-3 my-2 bg-muted rounded-md text-sm italic text-center font-mono">(Solar Generation + Battery Discharge + Grid Import) = (Home Consumption + Battery Charge + Grid Export)</p>
            <p className="mb-4">By knowing most of these values from the API, the app can calculate the remaining unknown, which is typically your total home consumption. This is why the home consumption figure is an accurate representation of your house&apos;s total load, even without a dedicated meter on every circuit.</p>
          </ScrollArea>
        </TabsContent>

<TabsContent value="faq">
  <ScrollArea className="h-[600px] p-4 border rounded-md">
    <div className="flex items-center mb-4">
      <HelpCircle className="h-8 w-8 mr-4 text-primary" />
      <h2 className="text-2xl font-semibold">Frequently Asked Questions</h2>
    </div>

    {/* ⚙️ Troubleshooting & Data Accuracy */}
    <h3 className="text-lg font-semibold text-primary mt-8 mb-4">⚙️ Troubleshooting & Data Accuracy</h3>

    <h3 className="text-xl font-medium mt-6 mb-2">Why are my dashboard values not updating?</h3>
    <p className="mb-4 text-muted-foreground">This can be due to several reasons: 1) Your API key might be incorrect, expired, or lack "Full Control" permissions. Please generate a new one following the instructions in the Settings tab of this guide. 2) Your home internet or the inverter's connection to it may be down. 3) The GivEnergy API service might be temporarily unavailable. Check your API key in settings and ensure your system is showing as "online" in the official GivEnergy portal.</p>

    <h3 className="text-xl font-medium mt-6 mb-2">My schedule didn’t apply. What might be wrong?</h3>
    <p className="mb-4 text-muted-foreground">Double-check that the battery isn’t already full or empty, the inverter isn’t in a conflicting mode, and the schedule time hasn’t already passed. Reapplying your preset after refreshing the dashboard may help.</p>

    <h3 className="text-xl font-medium mt-6 mb-2">Why do the figures sometimes differ from the official GivEnergy app?</h3>
    <p className="mb-4 text-muted-foreground">Minor discrepancies can occur due to differences in data refresh timing between the two applications. Both apps use the same core API data, but may fetch it at slightly different intervals, leading to small, temporary variations in the "live" values displayed. Furthermore, this app may use slightly different calculations for derived values like "Home Consumption", which can lead to minor differences.</p>

    <h3 className="text-xl font-medium mt-6 mb-2">Why don't the financial calculations exactly match my utility bill?</h3>
    <p className="mb-4 text-muted-foreground">The calculations are estimates based on the energy data from the API and the tariff rates you provide. They are very accurate for guidance but will likely differ slightly from your official bill. This is because your utility bill also includes daily standing charges, VAT, and may use different rounding methods, which are not factored into the app's calculations.</p>

    <h3 className="text-xl font-medium mt-6 mb-2">What happens if the GivEnergy API goes down?</h3>
    <p className="mb-4 text-muted-foreground">The app may temporarily lose access to live data or control features. Once the API is back online, everything will automatically resume without user action needed.</p>

    {/* 📊 Features & Functionality */}
    <h3 className="text-lg font-semibold text-primary mt-8 mb-4">📊 Features & Functionality</h3>

    <h3 className="text-xl font-medium mt-6 mb-2">What does "Inverter Control" actually let me do?</h3>
    <p className="mb-4 text-muted-foreground">The Inverter Control tab allows you to set charge/discharge times, change operational modes (e.g., Eco, Backup), or apply saved presets. All commands are securely sent to your GivEnergy system via the official API.</p>

    <h3 className="text-xl font-medium mt-6 mb-2">Can I control my EV charger with Helios?</h3>
    <p className="mb-4 text-muted-foreground">Yes — if your charger is linked via GivEnergy, you’ll be able to schedule, adjust power, and view charging data directly within the EV Charger tab.</p>

    <h3 className="text-xl font-medium mt-6 mb-2">What’s the difference between Manual, Timed Charge, and Eco modes?</h3>
    <p className="mb-4 text-muted-foreground"><strong>Manual</strong>: You’re in full control — set charge/discharge instantly.<br /><strong>Timed Charge</strong>: Schedule charging during off-peak hours.<br /><strong>Eco</strong>: Prioritizes solar energy and surplus management automatically.</p>

    <h3 className="text-xl font-medium mt-6 mb-2">How does Helios calculate “Home Consumption” and “Solar Used on Site”?</h3>
    <p className="mb-4 text-muted-foreground"><strong>Home Consumption</strong> = Generation + Battery Discharge + Grid Import − Battery Charge − Export.<br /><strong>Solar Used on Site</strong> = Generation − Export.<br />These real-time values give you insight into energy flow and usage efficiency.</p>

    <h3 className="text-xl font-medium mt-6 mb-2">Does Helios work offline?</h3>
    <p className="mb-4 text-muted-foreground">Some cached values and presets may still be viewable, but live updates and controls require an internet connection since the app depends on GivEnergy’s API.</p>

    {/* 🛡️ Security & Data Handling */}
    <h3 className="text-lg font-semibold text-primary mt-8 mb-4">🛡️ Security & Data Handling</h3>

    <h3 className="text-xl font-medium mt-6 mb-2">Is my data secure? What does Helios Control collect?</h3>
    <p className="mb-4 text-muted-foreground">Helios Control is designed with privacy as a priority. Your GivEnergy API key, along with any saved EV charger or inverter presets, are stored <em>only</em> in your local browser storage on your device. This data is never sent to any server other than the official GivEnergy API for data retrieval and command execution. The application itself is "serverless" and does not have its own backend database to store any user data.</p>

    <h3 className="text-xl font-medium mt-6 mb-2">Can I use Helios across multiple devices?</h3>
    <p className="mb-4 text-muted-foreground">Yes, but settings and presets are stored per device. To replicate a setup elsewhere, you’ll need to manually re-enter or export/import your preferences.</p>

  </ScrollArea>
</TabsContent>
      </Tabs>
    </div>
  );
}

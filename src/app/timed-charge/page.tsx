
"use client";

import { useState, useEffect } from 'react';
import { useApiKey } from "@/hooks/use-api-key";
import Link from 'next/link'; // Import Link component
import { _fetchGivEnergyAPI } from "@/lib/givenergy"; // Import the API helper
import { Loader2, AlertCircle } from "lucide-react";

// Assume TimePickerInput component exists and takes value and onChange props
interface TimedChargeSlot {
  startTime: string;
  endTime: string;
  percentLimit?: number;
}

export default function TimedChargePage() {
  const [slots, setSlots] = useState<TimedChargeSlot[]>([]);
  const [newSlot, setNewSlot] = useState<TimedChargeSlot>({ startTime: '', endTime: '', percentLimit: undefined });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { apiKey, isLoading: isApiKeyLoading, inverterSerial, isDeviceIDsLoading } = useApiKey();

  const handleAddSlot = () => {
    setValidationError(null); // Clear previous validation errors

    if (!newSlot.startTime || !newSlot.endTime) {
      setValidationError("Both start and end times are required.");
      return;
    }

    if (newSlot.startTime >= newSlot.endTime) {
      setValidationError("End time must be after start time.");
      return;
    }

    if (newSlot.percentLimit !== undefined && (newSlot.percentLimit < 0 || newSlot.percentLimit > 100)) {
        setValidationError("Percent limit must be between 0 and 100.");
        return;
    }

    setSlots([...slots, newSlot]);
    setNewSlot({ startTime: '', endTime: '', percentLimit: undefined });
  };

  const handleRemoveSlot = (index: number) => {
    setSlots(slots.filter((_, i) => i !== index));
  };
  
  const fetchTimedChargeSettings = async () => {
    if (!apiKey || !inverterSerial) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // TODO: Verify the exact endpoint for reading Timed Charge preset
    // Assuming the read endpoint is /inverter/{inverter_serial_number}/settings/{setting_id}
    try {
      const response = await _fetchGivEnergyAPI<any>(apiKey, `/inverter/${inverterSerial}/settings/timed-charge`);

      // Assuming the _fetchGivEnergyAPI handles response.ok and throws errors
      // The response data is expected in response.data
      const data = response;

      // TODO: Adapt this based on the actual API response structure for Timed Charge preset
      if (data && data.data && Array.isArray(data.data.slots)) {
        setSlots(data.data.slots.map((slot: any) => ({
          startTime: slot.start_time,
          endTime: slot.end_time,
          percentLimit: slot.percent_limit,
        })));
      } else {
        setSlots([]); // Assuming no data means no slots configured
      }

    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching settings.');
      setSlots([]); // Clear slots on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!apiKey || !inverterSerial) {
      setError("API key or inverter serial number is missing.");
      return;
    }

    setIsLoading(true);
    setError(null);

    // TODO: Verify the exact structure expected by the API for writing Timed Charge preset
    try {
      await _fetchGivEnergyAPI<any>(apiKey, `/inverter/${inverterSerial}/settings/timed-charge/write`, {
        method: 'POST', // Assuming POST for write operations
        body: JSON.stringify({
          value: { // Assuming the API expects the slots and enabled status within a 'value' key
            enabled: true, // Assuming we always enable the preset when saving slots
            slots: slots.map(slot => ({
              start_time: slot.startTime,
              end_time: slot.endTime,
              percent_limit: slot.percentLimit,
            })),
          },
          context: 'Helios Control Timed Charge Save', // Optional context
        }),
      });
      
      // Optionally fetch settings again to confirm the save
      await fetchTimedChargeSettings();

    } catch (err: any) {
      setError(err.message || 'An error occurred while saving settings.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch settings on initial load and when API key or inverter serial number becomes available
  // Only fetch if API key and inverterSerial are available AND device IDs are not currently loading
  useEffect(() => {
    if (apiKey && inverterSerial && !isDeviceIDsLoading) {
      fetchTimedChargeSettings();
    } else {
     setIsLoading(false);
    }
  }, [apiKey, inverterSerial, isApiKeyLoading, isDeviceIDsLoading]); // Depend on apiKey, inverterSerial, and isDeviceIDsLoading

  if (isLoading || isApiKeyLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading Timed Charge Settings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <AlertCircle className="h-8 w-8 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2 text-red-500">Error</h2>
        <p className="text-muted-foreground">{error}</p>
        {/* Optionally add a button to retry fetching */}
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Timed Charge Settings</h1>
      <Link href="/" className="mb-4 inline-block bg-orange-500 text-black px-4 py-2 rounded hover:bg-orange-600 transition-colors">
        Back to Dashboard
      </Link>

      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Add New Slot</h2>
        <div className="flex space-x-4">
          {/* Replace with actual TimePickerInput component */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Start Time</label>
            <input type="time" value={newSlot.startTime} onChange={(e) => setNewSlot({ ...newSlot, startTime: e.target.value })} />
            {/* <TimePickerInput value={newSlot.startTime} onChange={(time) => setNewSlot({ ...newSlot, startTime: time })} /> */}
          </div>
          {/* Replace with actual TimePickerInput component */}
          <div>
             <label className="block text-sm font-medium text-gray-700">End Time</label>
            <input type="time" value={newSlot.endTime} onChange={(e) => setNewSlot({ ...newSlot, endTime: e.target.value })} />
            {/* <TimePickerInput value={newSlot.endTime} onChange={(time) => setNewSlot({ ...newSlot, endTime: time })} /> */}
          </div>
          <div>
             <label className="block text-sm font-medium text-gray-700">Percent Limit</label>
             <input type="number" placeholder="Optional" value={newSlot.percentLimit || ''} onChange={(e) => setNewSlot({ ...newSlot, percentLimit: e.target.value ? parseInt(e.target.value) : undefined })} className="w-32"/>
          </div>

          <button onClick={handleAddSlot} className="bg-blue-500 text-white px-4 py-2 rounded">Add Slot</button>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Current Slots</h2>
        {validationError && (
            <div className="text-red-500 mb-4">
              <AlertCircle className="h-5 w-5 inline mr-2" />
              {validationError}
            </div>
        )}
        {slots.length === 0 ? (
          <p>No timed charge slots added yet.</p>
        ) : (
          <ul>
            {slots.map((slot, index) => (
              <li key={index} className="flex items-center space-x-4 mb-2">
                <span>{slot.startTime} to {slot.endTime} {slot.percentLimit !== undefined ? `(${slot.percentLimit}%)` : ''}</span>
                <button onClick={() => handleRemoveSlot(index)} className="text-red-500">Remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6">
          <button onClick={handleSaveSettings} className="bg-green-500 text-white px-4 py-2 rounded">Save Settings</button>
      </div>
    </div>
  );
}

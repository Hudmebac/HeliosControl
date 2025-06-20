
'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import type { NamedEVChargerSchedule, EVChargerAPIRule } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';

// Day mapping constants
const ALL_DAYS_DISPLAY_FORMAT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_MAP_DISPLAY_TO_API: { [key: string]: string } = {
  "Mon": "MONDAY", "Tue": "TUESDAY", "Wed": "WEDNESDAY", "Thu": "THURSDAY",
  "Fri": "FRIDAY", "Sat": "SATURDAY", "Sun": "SUNDAY"
};
const DAY_MAP_API_TO_DISPLAY: { [key: string]: string } = Object.fromEntries(
  Object.entries(DAY_MAP_DISPLAY_TO_API).map(([key, value]) => [value, key])
);

interface ScheduleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (schedule: Omit<NamedEVChargerSchedule, 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  existingSchedule: NamedEVChargerSchedule | null;
  evChargerId: string | null; // Added evChargerId for context if needed, though not directly used in this version for save logic
}

export const ScheduleDialog: React.FC<ScheduleDialogProps> = ({ isOpen, onClose, onSave, existingSchedule, evChargerId }) => {
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('06:00');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [isEveryday, setIsEveryday] = useState(false);
  const [isLocallyActive, setIsLocallyActive] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) { // Reset form when dialog opens, based on existingSchedule
      if (existingSchedule) {
        setName(existingSchedule.name);
        setIsLocallyActive(existingSchedule.isLocallyActive);
        if (existingSchedule.rules && existingSchedule.rules.length > 0) {
          const rule = existingSchedule.rules[0]; // Assuming one rule per named schedule for now
          setStartTime(rule.start_time);
          setEndTime(rule.end_time);
          
          const displayDays = rule.days.map(apiDay => DAY_MAP_API_TO_DISPLAY[apiDay.toUpperCase()] || apiDay).filter(Boolean);
          
          // Check if all API equivalent days are present for "Everyday"
          const isAllApiDaysPresent = ALL_DAYS_DISPLAY_FORMAT.every(displayDay => {
            const apiDayEquivalent = DAY_MAP_DISPLAY_TO_API[displayDay];
            return rule.days.map(d => d.toUpperCase()).includes(apiDayEquivalent);
          });

          if (isAllApiDaysPresent || rule.days.map(d => d.toUpperCase()).includes("EVERYDAY")) {
            setIsEveryday(true);
            setSelectedDays(ALL_DAYS_DISPLAY_FORMAT);
          } else {
            setIsEveryday(false);
            setSelectedDays(displayDays);
          }
        } else {
          // Default for existing schedule with no rules (should ideally not happen)
          setStartTime('00:00');
          setEndTime('06:00');
          setSelectedDays([]);
          setIsEveryday(false);
        }
      } else {
        // Reset form for new schedule
        setName('');
        setStartTime('00:00');
        setEndTime('06:00');
        setSelectedDays([]);
        setIsEveryday(false);
        setIsLocallyActive(true);
      }
    }
  }, [existingSchedule, isOpen]);

  const handleEverydayChange = (checked: boolean) => {
    setIsEveryday(checked);
    if (checked) {
      setSelectedDays(ALL_DAYS_DISPLAY_FORMAT);
    } else {
      setSelectedDays([]); // Clear individual days if "Everyday" is unchecked
    }
  };

  const handleDayChange = (day: string, checked: boolean) => {
    let newSelectedDays: string[];
    if (checked) {
      newSelectedDays = [...selectedDays, day];
    } else {
      newSelectedDays = selectedDays.filter(d => d !== day);
    }
    setSelectedDays(newSelectedDays);
    // Update "Everyday" checkbox if all days are selected/deselected individually
    setIsEveryday(newSelectedDays.length === ALL_DAYS_DISPLAY_FORMAT.length && ALL_DAYS_DISPLAY_FORMAT.every(d => newSelectedDays.includes(d)));
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Validation Error", description: "Schedule name is required." });
      return;
    }
    if (selectedDays.length === 0) {
      toast({ variant: "destructive", title: "Validation Error", description: "Please select at least one day." });
      return;
    }
    if (endTime <= startTime) {
      // Simple validation for same-day. More complex needed for overnight.
      // For now, GivEnergy API might handle overnight (e.g. 22:00 - 06:00) as two rules or specific format.
      // This basic check ensures end time is after start for a single day rule.
      toast({ variant: "destructive", title: "Validation Error", description: "End time must be after start time for a single day rule." });
      return;
    }

    const apiDays = selectedDays.map(day => DAY_MAP_DISPLAY_TO_API[day] || day.toUpperCase());

    const rule: EVChargerAPIRule = {
      start_time: startTime,
      end_time: endTime,
      days: apiDays, // API expects ["MONDAY", "TUESDAY"...]
    };
    
    const scheduleToSave: Omit<NamedEVChargerSchedule, 'createdAt' | 'updatedAt'> & { id?: string } = {
      id: existingSchedule?.id, // Will be undefined for new schedules
      name,
      rules: [rule], // Storing as an array of rules, even if UI supports one per named schedule
      isLocallyActive,
      // chargerId: evChargerId || undefined // Store chargerId if available, useful for future multi-charger support
    };
    
    // If it's a new schedule (no existingSchedule.id), the useLocalStorageSchedules hook will assign an ID.
    // Or we can explicitly add one here if onSave expects it for new items.
    // For consistency with update, if we're adding, we might want to pass the ID.
    // The hook structure suggests the hook handles ID generation for `addSchedule`.
    if(!existingSchedule?.id) { // This is a new schedule
        // The useLocalStorageSchedules hook expects Omit<..., 'id' | 'createdAt' | 'updatedAt'> for add
        // and it will generate the id and timestamps.
        // So, we don't need to pass id here for new schedules if onSave calls addSchedule.
    }


    onSave(scheduleToSave);
    onClose(); // Close dialog after saving
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{existingSchedule ? 'Edit Local Schedule' : 'Add New Local Schedule'}</DialogTitle>
          <DialogDescription>
            {existingSchedule ? 'Modify details for this locally stored schedule.' : 'Create a new schedule and save it to your local list.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="schedule-name" className="text-right">Name</Label>
            <Input id="schedule-name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" placeholder="e.g., Weekday Off-Peak" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="start-time" className="text-right">Start Time</Label>
            <Input id="start-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="end-time" className="text-right">End Time</Label>
            <Input id="end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="col-span-3" />
          </div>
          
          <div className="col-span-4 space-y-2">
            <Label>Select Days</Label>
            <div className="flex items-center space-x-2">
                <Checkbox id="schedule-everyday" checked={isEveryday} onCheckedChange={handleEverydayChange} />
                <Label htmlFor="schedule-everyday" className="font-normal">Everyday</Label>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                {ALL_DAYS_DISPLAY_FORMAT.map(day => (
                    <div key={day} className="flex items-center space-x-2">
                        <Checkbox
                            id={`schedule-day-${day}`}
                            checked={selectedDays.includes(day)}
                            onCheckedChange={(checked) => handleDayChange(day, !!checked)}
                            disabled={isEveryday && !selectedDays.includes(day)} // Disable if "Everyday" is checked and this day wasn't part of the initial "Everyday" set (edge case, usually all are selected)
                        />
                        <Label htmlFor={`schedule-day-${day}`} className="font-normal">{day}</Label>
                    </div>
                ))}
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
             <Label htmlFor="is-locally-active" className="text-right col-span-3">Enabled in my list</Label>
            {/* Tooltip or description can be added here for clarity */}
            <Switch id="is-locally-active" checked={isLocallyActive} onCheckedChange={setIsLocallyActive} className="justify-self-start"/>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>{existingSchedule ? 'Save Changes' : 'Add Schedule'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};



'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { NamedEVChargerSchedule, EVChargerAPIRule } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

const ALL_DAYS_DISPLAY_FORMAT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_MAP_DISPLAY_TO_API: { [key: string]: string } = {
  "Mon": "MONDAY", "Tue": "TUESDAY", "Wed": "WEDNESDAY", "Thu": "THURSDAY",
  "Fri": "FRIDAY", "Sat": "SATURDAY", "Sun": "SUNDAY"
};
const DAY_MAP_API_TO_DISPLAY: { [key: string]: string } = Object.fromEntries(
  Object.entries(DAY_MAP_DISPLAY_TO_API).map(([key, value]) => [value, key])
);

const CHARGE_LIMIT_OPTIONS = [6, 8.5, 10, 12, 16, 24, 32];
const DEFAULT_CHARGE_LIMIT = 32;

interface ScheduleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (schedule: Omit<NamedEVChargerSchedule, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  existingSchedule: NamedEVChargerSchedule | null;
  evChargerId: string | null; 
}

export const ScheduleDialog: React.FC<ScheduleDialogProps> = ({ isOpen, onClose, onSave, existingSchedule, evChargerId }) => {
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('06:00');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [isEveryday, setIsEveryday] = useState(false);
  const [chargeLimit, setChargeLimit] = useState<number>(DEFAULT_CHARGE_LIMIT);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) { 
      if (existingSchedule) {
        setName(existingSchedule.name);
        if (existingSchedule.rules && existingSchedule.rules.length > 0) {
          const rule = existingSchedule.rules[0]; 
          setStartTime(rule.start_time);
          setEndTime(rule.end_time);
          setChargeLimit(rule.limit ?? DEFAULT_CHARGE_LIMIT);
          
          const displayDays = rule.days.map(apiDay => DAY_MAP_API_TO_DISPLAY[apiDay.toUpperCase()] || apiDay).filter(Boolean);
          
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
          setStartTime('00:00');
          setEndTime('06:00');
          setSelectedDays([]);
          setIsEveryday(false);
          setChargeLimit(DEFAULT_CHARGE_LIMIT);
        }
      } else {
        setName('');
        setStartTime('00:00');
        setEndTime('06:00');
        setSelectedDays([]);
        setIsEveryday(false);
        setChargeLimit(DEFAULT_CHARGE_LIMIT);
      }
    }
  }, [existingSchedule, isOpen]);

  const handleEverydayChange = (checked: boolean) => {
    setIsEveryday(checked);
    if (checked) {
      setSelectedDays(ALL_DAYS_DISPLAY_FORMAT);
    } else {
      setSelectedDays([]); 
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
      toast({ variant: "destructive", title: "Validation Error", description: "End time must be after start time for a single day rule." });
      return;
    }

    const apiDays = selectedDays.map(day => DAY_MAP_DISPLAY_TO_API[day] || day.toUpperCase());

    const rule: EVChargerAPIRule = {
      start_time: startTime,
      end_time: endTime,
      days: apiDays,
      limit: chargeLimit,
    };
    
    const scheduleToSave: Omit<NamedEVChargerSchedule, 'id' | 'createdAt' | 'updatedAt'> & { id?: string } = {
      id: existingSchedule?.id, 
      name,
      rules: [rule], 
    };

    onSave(scheduleToSave);
    onClose(); 
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{existingSchedule ? 'Edit Schedule' : 'Add New Schedule'}</DialogTitle>
          <DialogDescription>
            {existingSchedule ? 'Modify details for this schedule.' : 'Create a new schedule to save to your local list.'}
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
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="charge-limit" className="text-right">Max Current</Label>
            <Select value={String(chargeLimit)} onValueChange={(value) => setChargeLimit(Number(value))} >
              <SelectTrigger id="charge-limit" className="col-span-3">
                <SelectValue placeholder="Select charge limit" />
              </SelectTrigger>
              <SelectContent>
                {CHARGE_LIMIT_OPTIONS.map(limit => (
                  <SelectItem key={limit} value={String(limit)}>{limit}A</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                            disabled={isEveryday && !selectedDays.includes(day)} 
                        />
                        <Label htmlFor={`schedule-day-${day}`} className="font-normal">{day}</Label>
                    </div>
                ))}
            </div>
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

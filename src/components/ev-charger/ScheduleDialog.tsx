
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import type { EVChargerFirebaseSchedule, EVChargerScheduleRule } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleToEdit?: EVChargerFirebaseSchedule | null;
  onSave: (scheduleData: Omit<EVChargerFirebaseSchedule, 'id' | 'chargerId' | 'createdAt' | 'updatedAt'>, scheduleId?: string) => Promise<void>;
  chargerId: string;
}

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const ScheduleDialog: React.FC<ScheduleDialogProps> = ({
  open,
  onOpenChange,
  scheduleToEdit,
  onSave,
  chargerId,
}) => {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('06:00');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [isEveryday, setIsEveryday] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (scheduleToEdit) {
      setName(scheduleToEdit.name || '');
      setIsActive(scheduleToEdit.active);
      if (scheduleToEdit.rules && scheduleToEdit.rules.length > 0) {
        const rule = scheduleToEdit.rules[0];
        setStartTime(rule.startTime);
        setEndTime(rule.endTime);
        if (rule.days.includes('Everyday') || rule.days.length === ALL_DAYS.length) {
          setIsEveryday(true);
          setSelectedDays(ALL_DAYS);
        } else {
          setIsEveryday(false);
          setSelectedDays(rule.days);
        }
      } else {
        // Default for new or malformed rule
        setStartTime('00:00');
        setEndTime('06:00');
        setSelectedDays([]);
        setIsEveryday(false);
      }
    } else {
      // Defaults for new schedule
      setName('');
      setStartTime('00:00');
      setEndTime('06:00');
      setSelectedDays([]);
      setIsEveryday(false);
      setIsActive(true);
    }
    setError(null); // Reset error when dialog opens or schedule changes
  }, [scheduleToEdit, open]);

  const handleEverydayChange = (checked: boolean) => {
    setIsEveryday(checked);
    if (checked) {
      setSelectedDays(ALL_DAYS);
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
    setIsEveryday(newSelectedDays.length === ALL_DAYS.length);
  };
  
  const effectiveSelectedDays = useMemo(() => {
    if (isEveryday) return ["Everyday"]; // Store as "Everyday" if that's the intent
    return selectedDays.length > 0 ? selectedDays : []; // Return individual days or empty if none
  }, [isEveryday, selectedDays]);


  const handleSubmit = async () => {
    setError(null);
    // Validation
    if (!chargerId) {
      setError("Charger ID is missing. Cannot save schedule.");
      return;
    }
    if (selectedDays.length === 0 && !isEveryday) {
      setError('Please select at least one day or "Everyday".');
      return;
    }
    if (!startTime || !endTime) {
        setError('Please set a start and end time.');
        return;
    }
    if (endTime <= startTime) {
      setError('End time must be after start time.');
      return;
    }

    setIsLoading(true);
    const scheduleData: Omit<EVChargerFirebaseSchedule, 'id' | 'chargerId' | 'createdAt' | 'updatedAt'> = {
      name: name.trim() === '' ? `Charge ${startTime}-${endTime}` : name.trim(),
      rules: [{ startTime, endTime, days: effectiveSelectedDays }],
      active: isActive,
    };

    try {
      await onSave(scheduleData, scheduleToEdit?.id);
      toast({
        title: scheduleToEdit ? 'Schedule Updated' : 'Schedule Added',
        description: `Schedule "${scheduleData.name}" has been successfully saved.`,
      });
      onOpenChange(false); // Close dialog on success
    } catch (e: any) {
      console.error("Error saving schedule:", e);
      setError(e.message || 'Failed to save schedule.');
      toast({
        title: 'Save Failed',
        description: e.message || 'Could not save the schedule.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{scheduleToEdit ? 'Edit Schedule' : 'Add New Schedule'}</DialogTitle>
          <DialogDescription>
            {scheduleToEdit ? 'Modify the details of your EV charging schedule.' : 'Create a new schedule for your EV charger.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right whitespace-nowrap col-span-1">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              placeholder="e.g., Night Charge (Optional)"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="startTime" className="text-right col-span-1">
              Start Time
            </Label>
            <Input
              id="startTime"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="endTime" className="text-right col-span-1">
              End Time
            </Label>
            <Input
              id="endTime"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="col-span-3"
            />
          </div>
          
          <div className="space-y-3">
            <Label className="font-medium">Select Days</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="everyday"
                checked={isEveryday}
                onCheckedChange={handleEverydayChange}
              />
              <Label htmlFor="everyday" className="font-normal">Everyday</Label>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-2">
              {ALL_DAYS.map((day) => (
                <div key={day} className="flex items-center space-x-2">
                  <Checkbox
                    id={`day-${day}`}
                    checked={selectedDays.includes(day)}
                    onCheckedChange={(checked) => handleDayChange(day, !!checked)}
                    disabled={isEveryday}
                  />
                  <Label htmlFor={`day-${day}`} className="font-normal">{day}</Label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Label htmlFor="active-mode" className="font-medium">
              Active
            </Label>
            <Switch
              id="active-mode"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isLoading}>Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {scheduleToEdit ? 'Save Changes' : 'Add Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

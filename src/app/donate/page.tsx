
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { createCheckoutSession } from './actions';
import { ArrowLeft, CreditCard, Gift, Heart, Loader2 } from 'lucide-react';
import Link from 'next/link';

const donationAmounts = [5, 10, 20, 50]; // In GBP

export default function DonatePage() {
    const [customAmount, setCustomAmount] = React.useState('');
    const [selectedAmount, setSelectedAmount] = React.useState<number | null>(10);
    const [isLoading, setIsLoading] = React.useState(false);
    const { toast } = useToast();

    const handleAmountSelect = (amount: number) => {
        setSelectedAmount(amount);
        setCustomAmount('');
    };

    const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setCustomAmount(value);
        if (value && !isNaN(Number(value))) {
            setSelectedAmount(null);
        } else if (!value) {
            setSelectedAmount(10); // Default back if custom is cleared
        }
    };

    const formAction = async (formData: FormData) => {
        setIsLoading(true);

        const amountInPounds = selectedAmount !== null ? selectedAmount : parseFloat(customAmount);

        if (isNaN(amountInPounds) || amountInPounds < 1) {
            toast({
                variant: 'destructive',
                title: 'Invalid Amount',
                description: 'Please enter a donation amount of at least £1.',
            });
            setIsLoading(false);
            return;
        }

        const amountInPence = Math.round(amountInPounds * 100);

        try {
            await createCheckoutSession({
                amount: amountInPence,
                name: `Donation to Helios Control`,
                description: `A one-time donation of £${amountInPounds.toFixed(2)} to support the development of Helios Control.`,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            toast({
                variant: 'destructive',
                title: 'Donation Failed',
                description: errorMessage,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full space-y-6">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-3xl font-bold flex items-center">
                    <Gift className="mr-3 h-8 w-8 text-primary" />
                    Make a Donation
                </h1>
                <Button variant="default" asChild>
                    <Link href="/">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Dashboard
                    </Link>
                </Button>
            </div>
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle className="flex items-center text-2xl">
                        <Heart className="mr-3 h-6 w-6 text-primary" />
                        Support Helios Control
                    </CardTitle>
                    <CardDescription>
                        Your generous support helps cover development and server costs, allowing us to keep improving Helios Control. Thank you!
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={formAction} className="space-y-6">
                        <div className="space-y-2">
                            <Label>Select an amount (£)</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {donationAmounts.map((amount) => (
                                    <Button
                                        key={amount}
                                        type="button"
                                        variant={selectedAmount === amount ? 'default' : 'outline'}
                                        onClick={() => handleAmountSelect(amount)}
                                    >
                                        £{amount}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="custom-amount">Or enter a custom amount (£)</Label>
                            <Input
                                id="custom-amount"
                                type="number"
                                placeholder="e.g., 25"
                                value={customAmount}
                                onChange={handleCustomAmountChange}
                                min="1"
                                step="any"
                            />
                        </div>

                        <Button type="submit" disabled={isLoading} className="w-full h-12 text-lg">
                            {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CreditCard className="mr-2 h-5 w-5" />}
                            Donate with Stripe
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}

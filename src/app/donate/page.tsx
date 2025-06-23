'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CreditCard, Gift, Heart } from 'lucide-react';
import Link from 'next/link';

export default function DonatePage() {
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
                    <CardDescription className="space-y-4">
  <p>
    You're not just donating—you’re <strong>supercharging solar smarts</strong>! Your contribution helps us keep Helios Control glowing with new features, smoother UX, and integrations like <strong>GivEnergy</strong> that make managing your energy feel like a walk in the sun.
  </p>

  <p>
    From effortless battery scheduling to intuitive dashboards and tariff-aware insights, every pound you give helps us build tools that are as bright as the energy they manage.
  </p>

  <div className="space-y-1">
    <p>💡 Got a bug to squash?</p>
    <p>🌱 A feature idea to grow?</p>
    <p>📬 Or just want to say hi?</p>
  </div>

  <p>
    Drop us a line at <a href="mailto:heliosheggie@gmail.com" className="underline text-primary">heliosheggie@gmail.com</a> — we love hearing from fellow solar adventurers.
  </p>
</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                         <p className="text-center text-muted-foreground pt-4">Click below to make a £5 donation and help us keep the lights (and insights) on.</p>
                        <Button asChild className="w-full h-12 text-lg">
                            <a href="https://buy.stripe.com/14A7sK8fK21l8x38Z94wM00" target="_blank" rel="noopener noreferrer">
                                <CreditCard className="mr-2 h-5 w-5" />
                                Donate £5 with Stripe
                            </a>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

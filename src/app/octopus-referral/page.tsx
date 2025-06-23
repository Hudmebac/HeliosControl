
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { OctopusEnergyLogo } from '@/components/logos/OctopusEnergyLogo';
import { ArrowLeft, Copy, Facebook, Mail, MessageCircle, Twitter } from 'lucide-react';

export default function OctopusReferralPage() {
  const { toast } = useToast();
  const referralLink = 'https://share.octopus.energy/new-grove-296';
  const shareText = "I've been using Octopus Energy and I think you'd like them too. You get £50 credit if you switch using this link!";

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink).then(() => {
      toast({
        title: "Link Copied!",
        description: "The referral link has been copied to your clipboard.",
      });
    }, (err) => {
      toast({
        variant: "destructive",
        title: "Copy Failed",
        description: "Could not copy the link. Please try again.",
      });
      console.error('Could not copy text: ', err);
    });
  };

  return (
    <div className="flex justify-center items-start pt-8">
        <Card className="max-w-2xl w-full">
            <CardHeader className="text-center">
              <OctopusEnergyLogo className="h-24 w-auto mx-auto mb-4" />
              <CardTitle className="text-2xl">Let's Share £100</CardTitle>
              <CardDescription className="text-lg">
                If you sign up with Octopus via my link, you will get £50 credit.
                <p className="text-sm mt-1">(And I'll get a little something too!)</p> 
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <Button variant="default" asChild className="w-full h-12 text-lg">
                    <a href={referralLink} target="_blank" rel="noopener noreferrer">
                        Switch to Octopus & Get £50
                    </a>
                </Button>
              <p className="text-center text-muted-foreground text-sm px-4">            
                Share the link below with your friends. When they switch their gas and/or electricity to Octopus Energy, they'll get £50 credit, and so will I. It's that simple!
              </p>
              <div className="flex items-center space-x-2">
                <Input readOnly value={referralLink} className="flex-grow" />
                <Button onClick={copyToClipboard} size="icon" aria-label="Copy link">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col items-center space-y-4">
              <p className="text-sm font-medium">Share the referral link on social media:</p>
              <div className="flex space-x-4">
                <Button asChild variant="outline" size="icon">
                  <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(referralLink)}`} target="_blank" rel="noopener noreferrer" aria-label="Share on Twitter">
                    <Twitter className="h-5 w-5" />
                  </a>
                </Button>
                <Button asChild variant="outline" size="icon">
                  <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`} target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook">
                    <Facebook className="h-5 w-5" />
                  </a>
                </Button>
                <Button asChild variant="outline" size="icon">
                  <a href={`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + referralLink)}`} target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp">
                    <MessageCircle className="h-5 w-5" />
                  </a>
                </Button>
                <Button asChild variant="outline" size="icon">
                  <a href={`mailto:?subject=Octopus Energy Referral&body=${encodeURIComponent(shareText + '\n\n' + referralLink)}`} aria-label="Share via Email">
                    <Mail className="h-5 w-5" />
                  </a>
                </Button>
              </div>
                 <Button variant="link" asChild className="mt-6">
                    <Link href="/">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Dashboard
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    </div>
  );
}

'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Copy, Share2, Twitter, Facebook, MessageCircle, Mail } from 'lucide-react';
import Link from 'next/link';

const OctopusReferralPage: React.FC = () => {
  const referralLink = 'https://share.octopus.energy/new-grove-296';
  const { toast } = useToast();

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink).then(() => {
      toast({
        title: 'Copied to Clipboard',
        description: 'Your referral link has been copied.',
      });
    }, (err) => {
      toast({
        variant: 'destructive',
        title: 'Copy Failed',
        description: 'Could not copy the link. Please try again.',
      });
      console.error('Could not copy text: ', err);
    });
  };

  const shareText = "I'm using Octopus Energy, and they're giving us £100 to share when you switch! You get £50, I get £50. It's a win-win!";

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold flex items-center">
          <Share2 className="mr-3 h-8 w-8 text-primary" />
          Octopus Energy Referral
        </h1>
        <Button variant="default" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="text-center">
          <img src="https://logolook.net/wp-content/uploads/2023/05/Octopus-Energy-Logo.png" alt="Octopus Energy Logo" className="h-16 w-auto mx-auto mb-4" />
          <CardTitle className="text-2xl">Refer your friends</CardTitle>
          <CardDescription className="text-lg">
            Split £100 with every friend who signs up with this link
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-center text-muted-foreground">
            Share the link below. When your friend switches their gas and/or electricity to Octopus Energy, you'll both receive a £50 credit on your account. It's that simple!
          </p>
          <div className="flex items-center space-x-2">
            <Input readOnly value={referralLink} className="flex-grow" />
            <Button onClick={copyToClipboard} size="icon" aria-label="Copy link">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-4">
          <p className="text-sm font-medium">Share referral link on your favourite social media using the buttons below:</p>
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
        </CardFooter>
      </Card>
    </div>
  );
};

export default OctopusReferralPage;

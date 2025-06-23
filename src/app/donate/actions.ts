
'use server';

import Stripe from 'stripe';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

// Stripe instance is now created inside the function to avoid startup errors.

interface CreateCheckoutSessionArgs {
  amount: number; // Amount in smallest currency unit (e.g., pence)
  currency?: string;
  name: string;
  description: string;
}

export async function createCheckoutSession(args: CreateCheckoutSessionArgs) {
  const { amount, currency = 'gbp', name, description } = args;

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    throw new Error('Stripe secret key is not configured on the server.');
  }

  const stripe = new Stripe(stripeSecretKey);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency,
            product_data: {
              name: name,
              description: description,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${appUrl}/donate?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/donate?status=cancelled`,
    });
  } catch (error) {
    console.error('Stripe session creation failed:', error);
    if (error instanceof Error) {
        throw new Error(`Stripe Error: ${error.message}`);
    }
    throw new Error('An unknown error occurred while creating the Stripe session.');
  }

  if (!session.url) {
      throw new Error('Failed to create Stripe session URL.');
  }

  redirect(session.url);
}

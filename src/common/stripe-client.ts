// Stripe client
declare global {
  interface Window {
    Stripe: any;
  }
}

type Stripe = any;
type StripeElements = any;

export async function initializeStripe(): Promise<any | null> {
  const publishableKey = (process.env as any).REACT_APP_STRIPE_PUBLISHABLE_KEY;

  if (!publishableKey) {
    console.error('Stripe publishable key not found in environment variables');
    return null;
  }

  if (!window.Stripe) {
    await loadStripeScript();
  }

  const stripe = (window as any).Stripe(publishableKey);

  if (!stripe) {
    console.error('Failed to initialize Stripe');
    return null;
  }

  return stripe;
}

async function loadStripeScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src="https://js.stripe.com/v3/"]')) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Stripe.js'));
    document.head.appendChild(script);
  });
}

interface CreatePaymentIntentRequest {
  certificateId: string;
  paymentType: 'self_disclosure' | 'assured';
  savePaymentMethod?: boolean;
  billingDetails?: {
    name?: string;
    email?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
}

interface PaymentIntentResponse {
  success: boolean;
  data: {
    id: string;
    client_secret: string;
    amount: number;
    currency: string;
    status: string;
    customer_id?: string;
    created: string;
  };
}

export async function createPaymentIntent(
  certificateId: string,
  paymentType: 'self_disclosure' | 'assured',
  authToken: string,
  billingDetails?: CreatePaymentIntentRequest['billingDetails'],
): Promise<PaymentIntentResponse> {
  const response = await fetch('/payments/stripe/create-intent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      certificate_id: certificateId,
      payment_type: paymentType,
      save_payment_method: false,
      billing_details: billingDetails,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create payment intent');
  }

  return response.json();
}

interface PaymentFormConfig {
  stripe: Stripe;
  elements: StripeElements;
  cardElement: any;
}

export async function setupPaymentForm(
  stripe: Stripe,
  containerId: string,
): Promise<PaymentFormConfig> {
  const elements = stripe.elements();

  const cardElement = elements.create('card', {
    style: {
      base: {
        fontSize: '16px',
        color: '#32325d',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#fa755a',
      },
    },
  });

  cardElement.mount(`#${containerId}`);

  cardElement.addEventListener('change', (event: any) => {
    const displayError = document.getElementById('card-errors');
    if (displayError) {
      if (event.error) {
        displayError.textContent = event.error.message;
      } else {
        displayError.textContent = '';
      }
    }
  });

  return { stripe, elements, cardElement };
}

interface ConfirmPaymentIntentRequest {
  paymentMethodId: string;
  offSession?: boolean;
}

interface ConfirmPaymentResponse {
  success: boolean;
  data: {
    id: string;
    status: string;
    client_secret: string;
  };
}

export async function confirmPaymentWithCard(
  stripe: Stripe,
  clientSecret: string,
  cardElement: any,
  billingName: string,
): Promise<any> {
  try {
    const { paymentIntent, error } = await stripe.confirmCardPayment(
      clientSecret,
      {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: billingName,
          },
        },
      },
    );

    if (error) {
      console.error('Payment failed:', error.message);
      throw new Error(error.message);
    }

    if (!paymentIntent) {
      throw new Error('Payment intent not returned');
    }

    return paymentIntent;
  } catch (error) {
    console.error('Confirmation error:', error);
    throw error;
  }
}

export async function confirmPaymentAutomatic(
  stripe: Stripe,
  clientSecret: string,
  cardElement: any,
): Promise<any> {
  try {
    const { paymentIntent, error } = await stripe.confirmCardPayment(
      clientSecret,
      {
        payment_method: {
          card: cardElement,
        },
      },
    );

    if (error) {
      if (error.type === 'card_error') {
        console.error('Card Error:', error.message);
      } else if (error.type === 'validation_error') {
        console.error('Validation Error:', error.message);
      } else {
        console.error('Unexpected error:', error.message);
      }
      throw error;
    }

    return paymentIntent;
  } catch (error) {
    console.error('Payment confirmation failed:', error);
    throw error;
  }
}

export async function confirmPaymentWithBackend(
  paymentIntentId: string,
  paymentMethodId: string,
  paymentId: string,
  authToken: string,
): Promise<ConfirmPaymentResponse> {
  const response = await fetch(`/payments/${paymentId}/stripe/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      payment_method_id: paymentMethodId,
      off_session: false,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to confirm payment');
  }

  return response.json();
}

interface PaymentStatusResponse {
  success: boolean;
  data: {
    id: string;
    status:
      | 'requires_payment_method'
      | 'succeeded'
      | 'requires_action'
      | string;
    amount: number;
    currency: string;
  };
}

export async function getPaymentStatus(
  paymentId: string,
  authToken: string,
): Promise<PaymentStatusResponse> {
  const response = await fetch(`/payments/${paymentId}/stripe/status`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get payment status');
  }

  return response.json();
}

export async function waitForPaymentConfirmation(
  paymentId: string,
  authToken: string,
  maxWaitMs: number = 30000,
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const status = await getPaymentStatus(paymentId, authToken);

      if (status.data.status === 'succeeded') {
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('Error checking payment status:', error);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  return false;
}

interface PaymentFlowOptions {
  certificateId: string;
  paymentType: 'self_disclosure' | 'assured';
  billingName: string;
  billingEmail?: string;
  authToken: string;
  onProgress?: (step: string) => void;
  onSuccess?: (paymentIntent: any) => void;
  onError?: (error: Error) => void;
}

export async function processPayment(
  stripe: Stripe,
  cardElement: any,
  options: PaymentFlowOptions,
): Promise<void> {
  const { onProgress, onSuccess, onError, authToken } = options;

  try {
    onProgress?.('Creating payment intent...');
    const intentResponse = await createPaymentIntent(
      options.certificateId,
      options.paymentType,
      authToken,
      {
        name: options.billingName,
        email: options.billingEmail,
      },
    );

    const clientSecret = intentResponse.data.client_secret;
    const paymentIntentId = intentResponse.data.id;

    onProgress?.('Processing payment...');
    const paymentIntent = await confirmPaymentWithCard(
      stripe,
      clientSecret,
      cardElement,
      options.billingName,
    );

    onProgress?.('Confirming with backend...');
    await confirmPaymentWithBackend(
      paymentIntentId,
      paymentIntent.payment_method,
      intentResponse.data.id,
      authToken,
    );

    onProgress?.('Finalizing payment...');
    const confirmed = await waitForPaymentConfirmation(
      intentResponse.data.id,
      authToken,
    );

    if (confirmed) {
      onProgress?.('Payment successful!');
      onSuccess?.(paymentIntent);
    } else {
      throw new Error('Payment confirmation timeout');
    }
  } catch (error) {
    console.error('Payment processing error:', error);
    onError?.(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function requestRefund(
  paymentId: string,
  authToken: string,
  amount?: number,
): Promise<any> {
  const response = await fetch(`/payments/${paymentId}/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      amount: amount,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to request refund');
  }

  return response.json();
}

export type StripeErrorType =
  | 'card_error'
  | 'validation_error'
  | 'rate_limit_error'
  | 'authentication_error'
  | 'api_error'
  | 'unknown_error';

export interface FormattedStripeError {
  type: StripeErrorType;
  message: string;
  code?: string;
  userMessage: string;
}

export function formatStripeError(error: any): FormattedStripeError {
  const type = error.type as StripeErrorType;

  const userMessages: Record<StripeErrorType, string> = {
    card_error: 'Your card was declined. Please try a different card.',
    validation_error: 'Please check your card information.',
    rate_limit_error: 'Too many attempts. Please wait a moment and try again.',
    authentication_error: 'Payment gateway error. Please contact support.',
    api_error: 'Payment processing failed. Please try again.',
    unknown_error: 'An unexpected error occurred. Please try again.',
  };

  return {
    type,
    message: error.message || 'Unknown error',
    code: error.code,
    userMessage: userMessages[type] || userMessages.unknown_error,
  };
}

export default {
  initializeStripe,
  createPaymentIntent,
  setupPaymentForm,
  confirmPaymentWithCard,
  confirmPaymentWithBackend,
  getPaymentStatus,
  waitForPaymentConfirmation,
  processPayment,
  requestRefund,
  formatStripeError,
};

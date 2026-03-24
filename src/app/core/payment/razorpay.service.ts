import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class RazorpayService {
  private razorpayKey = '';

  constructor() {}

  setRazorpayKey(key: string) {
    this.razorpayKey = key;
  }

  // Load Razorpay Script
  loadRazorpayScript(): Promise<boolean> {
    return new Promise(resolve => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  /**
   * Open Razorpay Checkout modal
   * Note: In production, create order from backend first
   */
  async openCheckout(options: {
    amount: number;
    description: string;
    prefill?: {
      name?: string;
      email?: string;
      contact?: string;
    };
    onSuccess: (response: any) => void;
    onError: (error: any) => void;
  }): Promise<void> {
    const scriptLoaded = await this.loadRazorpayScript();
    if (!scriptLoaded) {
      throw new Error('Failed to load Razorpay script');
    }

    const razorpayOptions = {
      key: this.razorpayKey,
      amount: options.amount * 100, // Convert to paise
      currency: 'INR',
      name: 'LibraryPro',
      description: options.description,
      prefill: options.prefill || {},
      theme: {
        color: '#3399cc'
      },
      handler: options.onSuccess,
      error: options.onError
    };

    const razorpay = new (window as any).Razorpay(razorpayOptions);
    razorpay.open();
  }

  /**
   * Verify payment signature (should be done on backend)
   */
  verifySignature(
    orderId: string,
    paymentId: string,
    signature: string
  ): boolean {
    // This is a client-side check only
    // Always verify on backend using HMAC SHA256
    return !!(orderId && paymentId && signature);
  }
}

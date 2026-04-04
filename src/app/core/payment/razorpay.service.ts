import { Injectable } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/compat/functions';

@Injectable({
  providedIn: 'root'
})
export class RazorpayService {
  private razorpayKey = '';

  constructor(private functions: AngularFireFunctions) {}

  setRazorpayKey(key: string) {
    this.razorpayKey = key;
  }

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

    // Create the order from the backend — amount is authoritative on server side.
    let orderId: string | undefined;
    try {
      const createOrder = this.functions.httpsCallable<
        { amount: number; receipt: string },
        { orderId: string; amount: number; currency: string }
      >('createRazorpayOrder');
      const result = await createOrder({
        amount: Math.round(options.amount * 100), // paise
        receipt: `rcpt_${Date.now()}`
      }).toPromise();
      orderId = result?.orderId;
    } catch (e) {
      // Graceful fallback: if backend isn't configured yet, proceed without order_id.
      console.warn('[RazorpayService] Could not create backend order:', e);
    }

    const razorpayOptions: any = {
      key: this.razorpayKey,
      amount: options.amount * 100,
      currency: 'INR',
      name: 'LibraryPro',
      description: options.description,
      prefill: options.prefill || {},
      theme: { color: '#3399cc' },
      handler: options.onSuccess,
      modal: { ondismiss: () => options.onError({ description: 'Payment cancelled' }) }
    };

    // Attach the order_id when available — enables Razorpay signature verification.
    if (orderId) razorpayOptions.order_id = orderId;

    const razorpay = new (window as any).Razorpay(razorpayOptions);
    razorpay.open();
  }

  /**
   * Always verify payment signatures on the server.
   * This client-side check is only a basic presence guard.
   */
  verifySignature(orderId: string, paymentId: string, signature: string): boolean {
    return !!(orderId && paymentId && signature);
  }
}

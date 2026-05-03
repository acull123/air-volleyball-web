"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: {
        createOrder: () => Promise<string>;
        onApprove: (data: { orderID?: string }) => Promise<void>;
        onError: (error: unknown) => void;
        onCancel?: () => void;
        style?: {
          shape?: "pill" | "rect";
          layout?: "vertical" | "horizontal";
          color?: "gold" | "blue" | "silver" | "white" | "black";
          label?: "paypal" | "checkout" | "pay" | "buynow";
          height?: number;
        };
      }) => {
        isEligible: () => boolean;
        render: (container: HTMLElement) => Promise<void>;
        close?: () => void;
      };
    };
  }
}

type RegistrationPayload = {
  eventId: string;
  playerId: string;
  isNewPlayer: boolean;
  athleteFirstName: string;
  athleteLastName: string;
  birthDate: string;
  position: string;
  parentName: string;
};

type PayPalCheckoutProps = {
  clientId: string;
  eventId: string;
  registration: RegistrationPayload;
  onSuccess: () => void;
  onError: (message: string) => void;
};

function getScriptSrc(clientId: string) {
  const params = new URLSearchParams({
    "client-id": clientId,
    currency: "USD",
    intent: "capture",
    components: "buttons",
  });

  return `https://www.paypal.com/sdk/js?${params.toString()}`;
}

async function loadPayPalSdk(clientId: string) {
  if (window.paypal) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-paypal-sdk="true"]');

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Unable to load payment button.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = getScriptSrc(clientId);
    script.async = true;
    script.dataset.paypalSdk = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load payment button."));
    document.body.appendChild(script);
  });
}

export default function PayPalCheckout({
  clientId,
  eventId,
  registration,
  onSuccess,
  onError,
}: PayPalCheckoutProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function mountButtons() {
      try {
        setLoading(true);
        await loadPayPalSdk(clientId);

        if (cancelled || !containerRef.current || !window.paypal) {
          return;
        }

        containerRef.current.innerHTML = "";

        const buttons = window.paypal.Buttons({
          style: {
            shape: "pill",
            layout: "vertical",
            color: "blue",
            label: "pay",
            height: 46,
          },
          createOrder: async () => {
            const response = await fetch("/api/paypal/create-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ eventId }),
            });

            const payload = (await response.json()) as { orderId?: string; error?: string };

            if (!response.ok || !payload.orderId) {
              throw new Error(payload.error || "Unable to start payment.");
            }

            return payload.orderId;
          },
          onApprove: async (data) => {
            const orderId = data.orderID;

            if (!orderId) {
              throw new Error("Missing payment order.");
            }

            const response = await fetch("/api/paypal/capture-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId,
                registration,
              }),
            });

            const payload = (await response.json()) as { error?: string };

            if (!response.ok) {
              throw new Error(payload.error || "Unable to complete payment.");
            }

            onSuccess();
          },
          onCancel: () => {
            onError("Payment was cancelled.");
          },
          onError: (error) => {
            onError(error instanceof Error ? error.message : "Unable to complete payment.");
          },
        });

        if (!buttons.isEligible()) {
          throw new Error("This payment option is not available on this device.");
        }

        await buttons.render(containerRef.current);

        if (!cancelled) {
          setLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          setLoading(false);
          onError(error instanceof Error ? error.message : "Unable to load payment button.");
        }
      }
    }

    void mountButtons();

    return () => {
      cancelled = true;
    };
  }, [clientId, eventId, onError, onSuccess, registration]);

  return (
    <div className="rounded-[1.5rem] border border-[color:var(--line)] bg-[color:var(--paper)] px-4 py-4">
      <p className="text-sm font-semibold text-[color:var(--ink)]">Complete payment</p>
      <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
        Finish payment below to complete registration.
      </p>
      {loading && (
        <p className="mt-4 text-sm text-[color:var(--muted)]">Loading payment button...</p>
      )}
      <div ref={containerRef} className="mt-4 min-h-[46px]" />
    </div>
  );
}

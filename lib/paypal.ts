type PayPalAccessTokenResponse = {
  access_token: string;
};

function getPayPalBaseUrl() {
  return process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function getPayPalClientId() {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? process.env.PAYPAL_CLIENT_ID;

  if (!clientId) {
    throw new Error("Missing PayPal client ID.");
  }

  return clientId;
}

function getPayPalClientSecret() {
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientSecret) {
    throw new Error("Missing PayPal client secret.");
  }

  return clientSecret;
}

export function getPublicPayPalClientId() {
  return process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "";
}

export async function getPayPalAccessToken() {
  const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${getPayPalClientId()}:${getPayPalClientSecret()}`,
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error("Unable to authenticate payment request.");
  }

  const payload = (await response.json()) as PayPalAccessTokenResponse;
  return payload.access_token;
}

export async function createPayPalOrder(params: {
  eventId: string;
  eventTitle: string;
  amount: number;
  currencyCode?: string;
}) {
  const accessToken = await getPayPalAccessToken();
  const currencyCode = params.currencyCode ?? "USD";

  const response = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: params.eventId,
          description: params.eventTitle,
          amount: {
            currency_code: currencyCode,
            value: params.amount.toFixed(2),
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error("Unable to create payment order.");
  }

  return (await response.json()) as { id: string; status: string };
}

export async function capturePayPalOrder(orderId: string) {
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Unable to capture payment.");
  }

  return (await response.json()) as {
    id: string;
    status: string;
    purchase_units?: Array<{
      custom_id?: string;
      payments?: {
        captures?: Array<{
          id: string;
          status: string;
          amount?: { value?: string; currency_code?: string };
        }>;
      };
    }>;
  };
}

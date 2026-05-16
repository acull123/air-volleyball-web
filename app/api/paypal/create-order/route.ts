import { NextResponse } from "next/server";
import { getEventByIdServer } from "@/lib/firebase/server";
import { createPayPalOrder } from "@/lib/paypal";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { eventId?: string };
    const eventId = body.eventId?.trim();

    if (!eventId) {
      return NextResponse.json({ error: "Event is required." }, { status: 400 });
    }

    const event = await getEventByIdServer(eventId);

    if (!event || event.active === false || (event.type !== "camp" && event.type !== "tryout")) {
      return NextResponse.json({ error: "This event is not available for registration." }, { status: 400 });
    }

    if (!Number.isFinite(event.price) || !event.price || event.price <= 0) {
      return NextResponse.json({ error: "This event does not require payment." }, { status: 400 });
    }

    const order = await createPayPalOrder({
      eventId: event.id,
      eventTitle: event.title,
      amount: event.price,
    });

    return NextResponse.json({ orderId: order.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start payment." },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import {
  createRegistrationServer,
  getEventByIdServer,
  getRegistrationByPayPalOrderIdServer,
} from "@/lib/firebase/server";
import { capturePayPalOrder } from "@/lib/paypal";

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

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      orderId?: string;
      registration?: RegistrationPayload;
    };
    const orderId = body.orderId?.trim();
    const registration = body.registration;

    if (!orderId || !registration) {
      return NextResponse.json({ error: "Payment details are required." }, { status: 400 });
    }

    const event = await getEventByIdServer(registration.eventId);

    if (!event || event.active === false || (event.type !== "camp" && event.type !== "tryout")) {
      return NextResponse.json({ error: "This event is not available for registration." }, { status: 400 });
    }

    if (!Number.isFinite(event.price) || !event.price || event.price <= 0) {
      return NextResponse.json({ error: "This event does not require payment." }, { status: 400 });
    }

    const existingRegistration = await getRegistrationByPayPalOrderIdServer(orderId);

    if (existingRegistration) {
      return NextResponse.json({
        registrationId: existingRegistration.id,
        captureId: existingRegistration.paymentCaptureId,
      });
    }

    const capture = await capturePayPalOrder(orderId);
    const captureRecord = capture.purchase_units?.[0]?.payments?.captures?.[0];
    const captureAmount = Number(captureRecord?.amount?.value ?? "0");
    const captureCurrency = captureRecord?.amount?.currency_code ?? "";
    const customEventId = capture.purchase_units?.[0]?.custom_id ?? "";

    if (capture.status !== "COMPLETED" || captureRecord?.status !== "COMPLETED") {
      return NextResponse.json({ error: "Payment was not completed." }, { status: 400 });
    }

    if (customEventId && customEventId !== event.id) {
      return NextResponse.json({ error: "Payment did not match the selected event." }, { status: 400 });
    }

    if (Math.abs(captureAmount - (event.price ?? 0)) > 0.01) {
      return NextResponse.json({ error: "Payment amount did not match the event fee." }, { status: 400 });
    }

    if (captureCurrency !== "USD") {
      return NextResponse.json({ error: "Payment currency did not match the event fee." }, { status: 400 });
    }

    const registrationId = await createRegistrationServer({
      eventId: event.id,
      eventTitle: event.title,
      eventType: event.type,
      eventPrice: event.price ?? 0,
      playerId: registration.playerId?.trim() ?? "",
      isNewPlayer: registration.isNewPlayer,
      athleteFirstName: registration.athleteFirstName.trim(),
      athleteLastName: registration.athleteLastName.trim(),
      birthDate: registration.birthDate,
      position: registration.position.trim(),
      parentName: registration.parentName.trim(),
      paymentProvider: "paypal",
      paymentOrderId: orderId,
      paymentCaptureId: captureRecord?.id ?? "",
      status: "submitted",
      paymentStatus: "paid",
    });

    return NextResponse.json({
      registrationId,
      captureId: captureRecord?.id ?? "",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to complete payment." },
      { status: 500 },
    );
  }
}

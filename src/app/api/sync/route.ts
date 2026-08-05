import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { SyncPayload } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sincronización del perfil entre dispositivos.
 *
 * No hay login: el cliente genera un UUID aleatorio (`device`) que funciona como
 * credencial. La tabla tiene RLS prendido y sin políticas, así que la clave
 * publicable no puede tocarla: el único camino es este endpoint, que corre en el
 * servidor con la secret key.
 */

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tope de tamaño: un perfil normal pesa unos pocos KB. */
const MAX_BYTES = 512 * 1024;

function client() {
  if (!URL_ || !SECRET) return null;
  return createClient(URL_, SECRET, { auth: { persistSession: false } });
}

export async function GET(request: Request) {
  const device = new URL(request.url).searchParams.get("device");
  if (!device || !UUID.test(device)) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  const db = client();
  // Sin credenciales configuradas la app sigue andando solo con localStorage.
  if (!db) return NextResponse.json({ ok: true, data: null });

  const { data, error } = await db
    .from("profiles")
    .select("data, updated_at")
    .eq("device_id", device)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, reason: "db" }, { status: 502 });

  return NextResponse.json({
    ok: true,
    data: (data?.data as SyncPayload | undefined) ?? null,
  });
}

export async function POST(request: Request) {
  let device: string;
  let payload: SyncPayload;

  try {
    const body = (await request.json()) as { device?: string; data?: SyncPayload };
    if (!body.device || !UUID.test(body.device)) throw new Error("device");
    if (!body.data || typeof body.data.updatedAt !== "number") throw new Error("data");

    if (JSON.stringify(body.data).length > MAX_BYTES) throw new Error("size");

    device = body.device;
    payload = body.data;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  const db = client();
  if (!db) return NextResponse.json({ ok: true });

  const { error } = await db.from("profiles").upsert(
    {
      device_id: device,
      data: payload,
      updated_at: new Date(payload.updatedAt).toISOString(),
    },
    { onConflict: "device_id" },
  );

  if (error) return NextResponse.json({ ok: false, reason: "db" }, { status: 502 });

  return NextResponse.json({ ok: true });
}

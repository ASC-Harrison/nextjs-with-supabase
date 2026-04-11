import { NextResponse } from "next/server";
import { Resend } from "resend";
 
const resend = new Resend(process.env.RESEND_API_KEY);
 
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
 
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
 
export async function POST(req: Request) {
  try {
    const { subject, html } = await req.json();
 
    const { data, error } = await resend.emails.send({
      from: "Baxter ASC Monitor <onboarding@resend.dev>",
      to: ["hogstud800@gmail.com"],
      subject,
      html,
    });
 
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400, headers: corsHeaders }
      );
    }
 
    return NextResponse.json({ ok: true, id: data?.id }, { headers: corsHeaders });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}

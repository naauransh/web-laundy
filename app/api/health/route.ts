import { NextResponse } from "next/server";
import { isGoogleSheetsConfigured, getServices, getSettings } from "@/lib/sheets";

export async function GET() {
  const isConfigured = isGoogleSheetsConfigured();
  let sheetsStatus = "simulated_mock";
  let serviceCount = 0;
  let businessName = "";
  let errorMsg = null;

  try {
    const services = await getServices();
    const settings = await getSettings();
    serviceCount = services.length;
    businessName = settings.business_name;
    sheetsStatus = isConfigured ? "connected_to_google_sheets" : "running_in_mock_mode";
  } catch (err) {
    sheetsStatus = "error";
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    timezone: process.env.TZ || "Asia/Jakarta",
    googleSheets: {
      isConfigured,
      status: sheetsStatus,
      businessName,
      serviceCount,
      error: errorMsg,
    },
  });
}

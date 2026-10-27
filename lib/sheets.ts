import { google } from "googleapis";

// --- Types & Interfaces ---

export interface Order {
  order_id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: "Tunai" | "Transfer" | "QRIS";
  payment_status: "Lunas" | "Belum Lunas";
  order_status: "Diterima" | "Diproses" | "Selesai" | "Diambil" | "Dibatalkan";
  estimated_done: string;
  notes: string;
  updated_at: string;
  done_at?: string;
  done_by?: "admin" | "kasir";
  picked_up_at?: string;
  picked_up_by?: "admin" | "kasir";
}

export interface OrderItem {
  order_id: string;
  service_name: string;
  unit: "kg" | "pcs" | "pasang";
  quantity: number;
  unit_price: number;
  line_total: number;
  item_description?: string;
  piece_count?: number;
  item_notes?: string;
}

export interface Service {
  service_id: string;
  name: string;
  unit: "kg" | "pcs" | "pasang";
  price: number;
  duration_hours: number;
  active: boolean;
}

export interface SettingItem {
  key: string;
  value: string;
}

export interface AppSettings {
  business_name: string;
  business_address: string;
  business_phone: string;
  receipt_footer: string;
  pickup_warning_days: number;
  price_rounding: number;
  note_presets?: string;
}

// Default settings
export const DEFAULT_SETTINGS: AppSettings = {
  business_name: "Harum Wangi Laundry",
  business_address: "Jl. Melati No. 12, Kebayoran Baru, Jakarta Selatan",
  business_phone: "081234567890",
  receipt_footer: "Terima kasih atas kepercayaan Anda!",
  pickup_warning_days: 3,
  price_rounding: 100,
  note_presets: "Pisahkan baju putih,Jangan digabung,Jangan disetrika,Ada noda mohon dicek,Pewangi ekstra",
};

// Initial Sample Services
export const DEFAULT_SERVICES: Service[] = [
  {
    service_id: "SVC-001",
    name: "Cuci Kering Setrika Reguler",
    unit: "kg",
    price: 8000,
    duration_hours: 48,
    active: true,
  },
  {
    service_id: "SVC-002",
    name: "Cuci Kering Saja",
    unit: "kg",
    price: 6000,
    duration_hours: 24,
    active: true,
  },
  {
    service_id: "SVC-003",
    name: "Setrika Saja",
    unit: "kg",
    price: 5000,
    duration_hours: 24,
    active: true,
  },
  {
    service_id: "SVC-004",
    name: "Cuci Express 1 Jam",
    unit: "kg",
    price: 15000,
    duration_hours: 1,
    active: true,
  },
  {
    service_id: "SVC-005",
    name: "Bed Cover Besar",
    unit: "pcs",
    price: 35000,
    duration_hours: 48,
    active: true,
  },
  {
    service_id: "SVC-006",
    name: "Cuci Sepatu Deep Clean",
    unit: "pasang",
    price: 30000,
    duration_hours: 48,
    active: true,
  },
];

// --- Sanitization & Formula Protection ---
export function sanitizeCellValue(val: unknown): string | number | boolean {
  if (val === null || val === undefined) return "";
  if (typeof val === "number" || typeof val === "boolean") return val;
  const str = String(val);
  // Hindari formula injection di Google Sheets
  if (str.startsWith("=") || str.startsWith("+") || str.startsWith("-") || str.startsWith("@")) {
    return `'${str}`;
  }
  return str;
}

export function desanitizeCellValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.startsWith("'=") || str.startsWith("'+") || str.startsWith("'-") || str.startsWith("'@")) {
    return str.slice(1);
  }
  return str;
}

// --- In-Memory Caching ---
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 30 * 1000; // 30 detik

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.data as T;
  }
  return null;
}

export function setCached<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export function clearCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    cache.clear();
    return;
  }
  for (const k of cache.keys()) {
    if (k.startsWith(keyPrefix)) cache.delete(k);
  }
}

import fs from "fs";
import path from "path";

// --- Google Sheets Client Setup ---

export function isGoogleSheetsConfigured(): boolean {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  const configured = Boolean(sheetId && email && key && sheetId.trim() !== "" && email.trim() !== "");

  // PRD & Requirement: Di production, kalau kredensial Google kosong, aplikasi menolak jalan dengan pesan error jelas
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error(
      "Kredensial Google Sheets (GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY) belum dikonfigurasi. Di lingkungan production, semua data wajib disimpan di Google Sheets dan mode simulasi dev-data.json dilarang."
    );
  }

  return configured;
}

function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new Error("Kredensial Service Account Google Sheets belum lengkap.");
  }
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

// --- File-based Simulation Store: data/dev-data.json (Hanya di Development) ---

const DEV_DATA_FILE = path.join(process.cwd(), "data", "dev-data.json");

interface DevDataFile {
  settings: AppSettings;
  services: Service[];
  orders: Order[];
  orderItems: OrderItem[];
}

function readDevData(): DevDataFile {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Mode simulasi file dev-data.json tidak diizinkan di lingkungan production. Wajib menggunakan Google Sheets."
    );
  }
  try {
    if (fs.existsSync(DEV_DATA_FILE)) {
      const raw = fs.readFileSync(DEV_DATA_FILE, "utf-8");
      return JSON.parse(raw) as DevDataFile;
    }
  } catch (err) {
    console.error("Error membaca data/dev-data.json:", err);
  }
  return {
    settings: { ...DEFAULT_SETTINGS },
    services: [...DEFAULT_SERVICES.slice(0, 3)],
    orders: [],
    orderItems: [],
  };
}

function writeDevData(data: DevDataFile): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Penyimpanan ke file dev-data.json tidak diizinkan di lingkungan production. Wajib menggunakan Google Sheets."
    );
  }
  try {
    const dir = path.dirname(DEV_DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DEV_DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error menulis ke data/dev-data.json:", err);
  }
}


// --- Helper Parser Header Baris 1 ---

function parseRowsWithHeaders<T>(rows: unknown[][]): { items: T[]; headers: string[] } {
  if (!rows || rows.length < 1) return { items: [], headers: [] };
  const rawHeaders = rows[0] as string[];
  const headers = rawHeaders.map((h) => String(h || "").trim());

  const items: T[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const obj: Record<string, unknown> = {};
    let hasValue = false;
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      if (!header) continue;
      const rawVal = row[c];
      if (rawVal !== undefined && rawVal !== "") hasValue = true;
      obj[header] = desanitizeCellValue(rawVal);
    }
    if (hasValue) {
      items.push(obj as unknown as T);
    }
  }
  return { items, headers };
}

// --- Data Access Functions ---

// 1. SERVICES
export async function getServices(): Promise<Service[]> {
  const cacheKey = "services";
  const cached = getCached<Service[]>(cacheKey);
  if (cached) return cached;

  if (!isGoogleSheetsConfigured()) {
    const data = readDevData();
    setCached(cacheKey, data.services);
    return data.services;
  }

  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Services!A1:F",
  });

  const { items } = parseRowsWithHeaders<Record<string, unknown>>(res.data.values || []);
  const services: Service[] = items.map((item) => ({
    service_id: String(item.service_id || ""),
    name: String(item.name || ""),
    unit: (item.unit as "kg" | "pcs" | "pasang") || "kg",
    price: Number(item.price) || 0,
    duration_hours: Number(item.duration_hours) || 24,
    active: String(item.active).toUpperCase() === "TRUE",
  }));

  setCached(cacheKey, services);
  return services;
}

export async function saveService(service: Service, isNew = false): Promise<void> {
  clearCache("services");

  if (!isGoogleSheetsConfigured()) {
    const data = readDevData();
    if (isNew) {
      data.services.push(service);
    } else {
      const idx = data.services.findIndex((s) => s.service_id === service.service_id);
      if (idx !== -1) data.services[idx] = service;
      else data.services.push(service);
    }
    writeDevData(data);
    return;
  }

  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;

  if (isNew) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Services!A1:F",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            sanitizeCellValue(service.service_id),
            sanitizeCellValue(service.name),
            sanitizeCellValue(service.unit),
            service.price,
            service.duration_hours,
            service.active ? "TRUE" : "FALSE",
          ],
        ],
      },
    });
  } else {
    // Find row index
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Services!A1:A",
    });
    const rows = res.data.values || [];
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === service.service_id) {
        rowIndex = i + 1; // 1-indexed
        break;
      }
    }
    if (rowIndex === -1) {
      throw new Error(`Layanan ${service.service_id} tidak ditemukan di Google Sheets.`);
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Services!A${rowIndex}:F${rowIndex}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            sanitizeCellValue(service.service_id),
            sanitizeCellValue(service.name),
            sanitizeCellValue(service.unit),
            service.price,
            service.duration_hours,
            service.active ? "TRUE" : "FALSE",
          ],
        ],
      },
    });
  }
}

// 2. SETTINGS
export async function getSettings(): Promise<AppSettings> {
  const cacheKey = "settings";
  const cached = getCached<AppSettings>(cacheKey);
  if (cached) return cached;

  if (!isGoogleSheetsConfigured()) {
    const data = readDevData();
    setCached(cacheKey, data.settings);
    return data.settings;
  }

  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Settings!A1:B",
  });

  const rows = res.data.values || [];
  const settings: AppSettings = { ...DEFAULT_SETTINGS };

  for (let i = 1; i < rows.length; i++) {
    const key = String(rows[i][0] || "").trim();
    const val = desanitizeCellValue(rows[i][1]);
    if (!key) continue;

    if (key === "business_name") settings.business_name = val;
    if (key === "business_address") settings.business_address = val;
    if (key === "business_phone") settings.business_phone = val;
    if (key === "receipt_footer") settings.receipt_footer = val;
    if (key === "pickup_warning_days") settings.pickup_warning_days = Number(val) || 3;
    if (key === "price_rounding") settings.price_rounding = Number(val) || 100;
    if (key === "note_presets") settings.note_presets = val;
  }

  setCached(cacheKey, settings);
  return settings;
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  clearCache("settings");

  if (!isGoogleSheetsConfigured()) {
    const data = readDevData();
    data.settings = { ...data.settings, ...settings };
    writeDevData(data);
    return;
  }

  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Settings!A1:B",
  });

  const rows = res.data.values || [["key", "value"]];
  const existingKeys = new Map<string, number>();
  for (let i = 1; i < rows.length; i++) {
    const k = String(rows[i][0] || "").trim();
    if (k) existingKeys.set(k, i + 1);
  }

  const updates: { key: string; value: string | number }[] = [];
  for (const [k, v] of Object.entries(settings)) {
    if (v !== undefined) {
      updates.push({ key: k, value: v });
    }
  }

  for (const item of updates) {
    const rowNum = existingKeys.get(item.key);
    if (rowNum) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Settings!B${rowNum}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[sanitizeCellValue(item.value)]] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Settings!A1:B",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[sanitizeCellValue(item.key), sanitizeCellValue(item.value)]] },
      });
    }
  }
}

// 3. ORDERS & ITEMS BATCH READ
export async function getOrdersAndItems(): Promise<{ orders: Order[]; items: OrderItem[] }> {
  const cacheKey = "orders_and_items";
  const cached = getCached<{ orders: Order[]; items: OrderItem[] }>(cacheKey);
  if (cached) return cached;

  if (!isGoogleSheetsConfigured()) {
    const data = readDevData();
    const result = { orders: [...data.orders], items: [...data.orderItems] };
    setCached(cacheKey, result);
    return result;
  }

  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;

  // Gunakan batchGet untuk efisiensi kuota
  const batchRes = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: ["Orders!A1:R", "OrderItems!A1:I"],
  });

  const valueRanges = batchRes.data.valueRanges || [];
  const ordersRaw = valueRanges[0]?.values || [];
  const itemsRaw = valueRanges[1]?.values || [];

  const { items: ordersData } = parseRowsWithHeaders<Record<string, unknown>>(ordersRaw);
  const { items: itemsData } = parseRowsWithHeaders<Record<string, unknown>>(itemsRaw);

  const orders: Order[] = ordersData.map((o) => ({
    order_id: String(o.order_id || ""),
    created_at: String(o.created_at || ""),
    customer_name: String(o.customer_name || ""),
    customer_phone: String(o.customer_phone || ""),
    customer_address: String(o.customer_address || ""),
    subtotal: Number(o.subtotal) || 0,
    discount: Number(o.discount) || 0,
    total: Number(o.total) || 0,
    payment_method: (o.payment_method as "Tunai" | "Transfer" | "QRIS") || "Tunai",
    payment_status: (o.payment_status as "Lunas" | "Belum Lunas") || "Belum Lunas",
    order_status: (o.order_status as Order["order_status"]) || "Diterima",
    estimated_done: String(o.estimated_done || ""),
    notes: String(o.notes || ""),
    updated_at: String(o.updated_at || ""),
    done_at: o.done_at ? String(o.done_at) : undefined,
    done_by: (o.done_by as "admin" | "kasir") || undefined,
    picked_up_at: o.picked_up_at ? String(o.picked_up_at) : undefined,
    picked_up_by: (o.picked_up_by as "admin" | "kasir") || undefined,
  }));

  const items: OrderItem[] = itemsData.map((it) => ({
    order_id: String(it.order_id || ""),
    service_name: String(it.service_name || ""),
    unit: (it.unit as "kg" | "pcs" | "pasang") || "kg",
    quantity: Number(it.quantity) || 0,
    unit_price: Number(it.unit_price) || 0,
    line_total: Number(it.line_total) || 0,
    item_description: it.item_description ? String(it.item_description) : undefined,
    piece_count: it.piece_count ? Number(it.piece_count) : undefined,
    item_notes: it.item_notes ? String(it.item_notes) : undefined,
  }));

  const result = { orders, items };
  setCached(cacheKey, result);
  return result;
}

// 4. CREATE NEW ORDER (Header + Items)
export async function createOrder(order: Order, items: OrderItem[]): Promise<void> {
  clearCache("orders_and_items");

  if (!isGoogleSheetsConfigured()) {
    const data = readDevData();
    data.orders.unshift(order);
    data.orderItems.push(...items);
    writeDevData(data);
    return;
  }

  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;

  // 1. Append Order
  const orderRow = [
    sanitizeCellValue(order.order_id),
    sanitizeCellValue(order.created_at),
    sanitizeCellValue(order.customer_name),
    sanitizeCellValue(order.customer_phone),
    sanitizeCellValue(order.customer_address),
    order.subtotal,
    order.discount,
    order.total,
    sanitizeCellValue(order.payment_method),
    sanitizeCellValue(order.payment_status),
    sanitizeCellValue(order.order_status),
    sanitizeCellValue(order.estimated_done),
    sanitizeCellValue(order.notes),
    sanitizeCellValue(order.updated_at),
    sanitizeCellValue(order.done_at || ""),
    sanitizeCellValue(order.done_by || ""),
    sanitizeCellValue(order.picked_up_at || ""),
    sanitizeCellValue(order.picked_up_by || ""),
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Orders!A1:R",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [orderRow] },
  });

  // 2. Append OrderItems
  if (items.length > 0) {
    const itemRows = items.map((it) => [
      sanitizeCellValue(it.order_id),
      sanitizeCellValue(it.service_name),
      sanitizeCellValue(it.unit),
      it.quantity,
      it.unit_price,
      it.line_total,
      sanitizeCellValue(it.item_description || ""),
      it.piece_count || "",
      sanitizeCellValue(it.item_notes || ""),
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "OrderItems!A1:I",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: itemRows },
    });
  }
}

// 5. UPDATE ORDER
export async function updateOrder(orderId: string, updates: Partial<Order>): Promise<void> {
  clearCache("orders_and_items");

  if (!isGoogleSheetsConfigured()) {
    const data = readDevData();
    const idx = data.orders.findIndex((o) => o.order_id === orderId);
    if (idx !== -1) {
      data.orders[idx] = { ...data.orders[idx], ...updates, updated_at: new Date().toISOString() };
      writeDevData(data);
    }
    return;
  }

  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Orders!A1:R",
  });

  const rows = res.data.values || [];
  if (rows.length < 1) throw new Error("Sheet Orders kosong.");

  const headers = (rows[0] as string[]).map((h) => String(h || "").trim());
  let targetRowIndex = -1;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === orderId) {
      targetRowIndex = i + 1; // 1-indexed
      break;
    }
  }

  if (targetRowIndex === -1) {
    throw new Error(`Pesanan dengan ID ${orderId} tidak ditemukan.`);
  }

  const currentRow = rows[targetRowIndex - 1] || [];
  const updatedRow = [...currentRow];

  // Pastikan panjang array cukup untuk semua header
  while (updatedRow.length < headers.length) {
    updatedRow.push("");
  }

  const merged = { ...updates, updated_at: new Date().toISOString() };

  for (const [key, val] of Object.entries(merged)) {
    const colIdx = headers.indexOf(key);
    if (colIdx !== -1) {
      updatedRow[colIdx] = sanitizeCellValue(val);
    }
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Orders!A${targetRowIndex}:R${targetRowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [updatedRow] },
  });
}

// 6. CHECK IF SERVICE IS USED IN ORDERS
export async function isServiceUsedInOrders(serviceName: string): Promise<boolean> {
  const { items } = await getOrdersAndItems();
  return items.some((it) => it.service_name.trim().toLowerCase() === serviceName.trim().toLowerCase());
}

// 7. GENERATE NEXT ORDER ID (LDR-YYMMDD-NNN)
export async function generateNextOrderId(): Promise<string> {
  const { orders } = await getOrdersAndItems();
  
  // Format tanggal hari ini di zona waktu Asia/Jakarta: YYMMDD
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Jakarta",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  };
  const parts = new Intl.DateTimeFormat("en-US", options).formatToParts(now);
  const yy = parts.find((p) => p.type === "year")?.value || "26";
  const mm = parts.find((p) => p.type === "month")?.value || "10";
  const dd = parts.find((p) => p.type === "day")?.value || "27";
  const todayPrefix = `LDR-${yy}${mm}${dd}-`;

  // Cari nomor urut tertinggi untuk hari ini
  let maxSeq = 0;
  for (const o of orders) {
    if (o.order_id && o.order_id.startsWith(todayPrefix)) {
      const seqStr = o.order_id.slice(todayPrefix.length);
      const seqNum = parseInt(seqStr, 10);
      if (!isNaN(seqNum) && seqNum > maxSeq) {
        maxSeq = seqNum;
      }
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(3, "0");
  return `${todayPrefix}${nextSeq}`;
}

// 8. UPDATE ORDER ITEMS (Catatan / Isi Cucian)
export async function updateOrderItems(orderId: string, updatedItems: OrderItem[]): Promise<void> {
  clearCache("orders_and_items");

  if (!isGoogleSheetsConfigured()) {
    const data = readDevData();
    data.orderItems = data.orderItems.filter((it) => it.order_id !== orderId);
    data.orderItems.push(...updatedItems);
    writeDevData(data);
    return;
  }

  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "OrderItems!A1:I",
  });

  const rows = res.data.values || [];
  if (rows.length < 1) return;

  const headers = (rows[0] as string[]).map((h) => String(h || "").trim());

  // Cari baris-baris milik orderId dan update baris tersebut
  let itemIdx = 0;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === orderId && itemIdx < updatedItems.length) {
      const it = updatedItems[itemIdx];
      const rowNum = i + 1;
      const updatedRow = [
        sanitizeCellValue(it.order_id),
        sanitizeCellValue(it.service_name),
        sanitizeCellValue(it.unit),
        it.quantity,
        it.unit_price,
        it.line_total,
        sanitizeCellValue(it.item_description || ""),
        it.piece_count || "",
        sanitizeCellValue(it.item_notes || ""),
      ];
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `OrderItems!A${rowNum}:I${rowNum}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [updatedRow] },
      });
      itemIdx++;
    }
  }
}


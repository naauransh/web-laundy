
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrdersAndItems } from "@/lib/sheets";
import { formatRupiah, formatReceiptDate } from "@/lib/receipt";

export const dynamic = "force-dynamic";

interface OrderDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function OrderDetailPage({
  params,
}: OrderDetailPageProps) {
  const { id } = await params;

  const { orders, items } = await getOrdersAndItems();

  const order = orders.find((o) => o.order_id === id);

  if (!order) {
    notFound();
  }

  const orderItems = items.filter(
    (item) => item.order_id === order.order_id
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/orders"
            className="text-sm font-medium text-sky-600 hover:text-sky-700"
          >
            ← Kembali ke Daftar Pesanan
          </Link>

          <h1 className="mt-3 text-2xl font-bold text-slate-900">
            Detail Pesanan
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Nomor Pesanan: {order.order_id}
          </p>
        </div>

        <Link
          href={`/orders/${order.order_id}/receipt`}
          className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
        >
          Lihat Struk
        </Link>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-bold text-slate-900">
            Informasi Pelanggan
          </h2>

          <div className="space-y-3 text-sm">
            <p><strong>Nama:</strong> {order.customer_name}</p>
            <p><strong>No. WhatsApp:</strong> {order.customer_phone}</p>
            <p><strong>Alamat:</strong> {order.customer_address || "-"}</p>
            <p>
              <strong>Tanggal Masuk:</strong>{" "}
              {formatReceiptDate(order.created_at)}
            </p>
            <p>
              <strong>Estimasi Selesai:</strong>{" "}
              {order.estimated_done
                ? formatReceiptDate(order.estimated_done)
                : "-"}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-bold text-slate-900">
            Status Pesanan
          </h2>

          <div className="space-y-3 text-sm">
            <p><strong>Status Cucian:</strong> {order.order_status}</p>
            <p><strong>Status Pembayaran:</strong> {order.payment_status}</p>
            <p><strong>Metode Pembayaran:</strong> {order.payment_method}</p>
            <p><strong>Catatan:</strong> {order.notes || "-"}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 font-bold text-slate-900">
          Rincian Layanan
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-3 pr-4">Layanan</th>
                <th className="py-3 pr-4">Jumlah</th>
                <th className="py-3 pr-4">Harga Satuan</th>
                <th className="py-3 text-right">Subtotal</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {orderItems.map((item, index) => (
                <tr key={index}>
                  <td className="py-3 pr-4">
                    <p className="font-medium text-slate-900">
                      {item.service_name}
                    </p>
                    {item.item_description && (
                      <p className="text-xs text-slate-500">
                        {item.item_description}
                      </p>
                    )}
                    {item.item_notes && (
                      <p className="text-xs text-slate-500">
                        Catatan: {item.item_notes}
                      </p>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="py-3 pr-4">
                    {formatRupiah(item.unit_price)}
                  </td>
                  <td className="py-3 text-right">
                    {formatRupiah(item.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span>{formatRupiah(order.subtotal)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500">Diskon</span>
            <span>{formatRupiah(order.discount)}</span>
          </div>

          <div className="flex justify-between text-lg font-bold text-slate-900">
            <span>Total</span>
            <span>{formatRupiah(order.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

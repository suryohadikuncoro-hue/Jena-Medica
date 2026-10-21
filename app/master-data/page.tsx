"use client";
import { useEffect, useState } from "react";
import { SupplierManager } from "@/app/components/supplier-manager";
import { ReferenceManager } from "@/app/components/reference-manager";
import { CustomerPriceManager } from "@/app/components/customer-price-manager";
import { AccountReference } from "@/app/components/account-reference";
type Tab = "Pelanggan" | "Supplier" | "Barang" | "Harga per Pelanggan" | "Daftar Akun";
export default function MasterDataPage() {
  const [tab, setTab] = useState<Tab>("Pelanggan");
  useEffect(() => {
    const sync = () => {
      const map: Record<string, Tab> = { customers: "Pelanggan", suppliers: "Supplier", products: "Barang", prices: "Harga per Pelanggan", accounts: "Daftar Akun" };
      const next = map[window.location.hash.slice(1)];
      if (next) window.requestAnimationFrame(() => setTab(next));
    };
    sync(); window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  if (tab === "Supplier") return <SupplierManager />;
  if (tab === "Pelanggan") return <ReferenceManager mode="customers" />;
  if (tab === "Barang") return <ReferenceManager mode="products" />;
  if (tab === "Harga per Pelanggan") return <CustomerPriceManager />;
  return <AccountReference />;
}

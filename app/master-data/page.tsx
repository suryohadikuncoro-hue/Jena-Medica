"use client";
import { useEffect, useState } from "react";
import { SupplierManager } from "@/app/components/supplier-manager";
import { ReferenceManager } from "@/app/components/reference-manager";
import { CustomerPriceManager } from "@/app/components/customer-price-manager";
import { AccountReference } from "@/app/components/account-reference";
type Tab = "Pelanggan" | "Supplier" | "Barang" | "Harga per Pelanggan" | "Daftar Akun";
const HASH_BY_TAB: Record<Tab, string> = { Pelanggan: "customers", Supplier: "suppliers", Barang: "products", "Harga per Pelanggan": "prices", "Daftar Akun": "accounts" };
const TABS: Tab[] = ["Pelanggan", "Supplier", "Barang", "Harga per Pelanggan", "Daftar Akun"];
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
  function selectTab(next: Tab) {
    setTab(next);
    const slug = HASH_BY_TAB[next];
    window.history.replaceState(null, "", `${window.location.pathname}#${slug}`);
  }
  return (
    <>
      <nav className="mx-auto flex max-w-6xl flex-wrap gap-2 px-6 pt-6" role="tablist" aria-label="Navigasi Master Data">
        {TABS.map(item => (
          <button
            key={item}
            type="button"
            role="tab"
            className="tab-button"
            aria-selected={tab === item}
            onClick={() => selectTab(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      {tab === "Supplier" && <SupplierManager />}
      {tab === "Pelanggan" && <ReferenceManager mode="customers" />}
      {tab === "Barang" && <ReferenceManager mode="products" />}
      {tab === "Harga per Pelanggan" && <CustomerPriceManager />}
      {tab === "Daftar Akun" && <AccountReference />}
    </>
  );
}

import type { ReactNode } from "react";

function Icon({ children }: { children: ReactNode }) {
  return <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

export const IconDashboard = () => <Icon><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></Icon>;
export const IconPesanan = () => <Icon><rect x="5" y="4" width="14" height="17" rx="3" /><path d="M9 4h6v3H9zM9 12h6M9 16h4" /></Icon>;
export const IconOrder = () => <Icon><path d="M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zM14 3v5h5M9 13h6M9 17h6" /></Icon>;
export const IconMasterData = () => <Icon><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5a3 3 0 010 6M18 14c2 .6 3 2.4 3 5" /></Icon>;
export const IconInvoice = () => <Icon><path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" /></Icon>;
export const IconPembayaran = () => <Icon><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M16 12.5h2M3 10h18" /></Icon>;
export const IconKeuangan = () => <Icon><path d="M5 20V10M12 20V4M19 20v-7" /></Icon>;
export const IconLainnya = () => <Icon><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></Icon>;
export const IconSearch = () => <Icon><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></Icon>;
export const IconMoon = () => <Icon><path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" /></Icon>;
export const IconSun = () => <Icon><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" /></Icon>;
export const IconUser = () => <Icon><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" /></Icon>;
export const IconChevron = () => <Icon><path d="M9 5l7 7-7 7" /></Icon>;

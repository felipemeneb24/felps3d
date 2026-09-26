import {
  IconDashboard,
  IconSpool,
  IconPackage,
  IconCalculator,
  IconUsers,
  IconGrid,
  IconShoppingBag,
} from "@/components/icons";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof IconDashboard;
  comingSoon?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Painel", icon: IconDashboard },
  { href: "/filamentos", label: "Filamentos", icon: IconSpool },
  { href: "/orcamentos", label: "Orçamentos", icon: IconCalculator },
  { href: "/pedidos", label: "Pedidos", icon: IconPackage },
  { href: "/shopee", label: "Shopee", icon: IconShoppingBag },
  { href: "/estoque", label: "Estoque", icon: IconGrid },
  { href: "/clientes", label: "Clientes", icon: IconUsers },
];

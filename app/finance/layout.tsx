import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Financial Control Center",
  description: "Live wedding, debt, budget and savings planner",
};

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return children;
}

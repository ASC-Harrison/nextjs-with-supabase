# Financial Control Center

Live household finance dashboard at `/finance`.

Features:
- wedding expense tracker and funding pace
- debt balances, APRs, minimums and extra-payment allocation
- recurring income and monthly bills
- savings goals and progress
- automatic safe-to-spend calculation
- household sharing with authenticated invite code
- Supabase Realtime refresh across household devices
- responsive mobile/tablet/desktop UI modeled after the inventory dashboard

Security:
- finance data is stored only in `finance_*` tables
- all finance tables use RLS
- rows are scoped to authenticated household membership
- inventory tables are not modified by the finance UI

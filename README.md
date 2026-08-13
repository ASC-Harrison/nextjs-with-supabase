# ASC Harrison Operations & Inventory App

Internal operations and inventory application built with Next.js and Supabase.

## What this application does

The application includes workflows for inventory management, inventory history, cases, barcodes and labels, locations/areas, alerts, administrative users, and related operational tools.

## Technology

- Next.js / React / TypeScript
- Supabase
- Tailwind CSS
- Radix UI / shadcn-style components
- Barcode scanning and generation
- Email and push-notification integrations

## Development

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Environment variables

Copy `.env.example` to `.env.local` for local development and provide the required values there. Do not commit real credentials or service-role keys to the repository.

## Safety

Operational records and inventory quantities are stored outside this repository in the configured backend/database. Code changes should be reviewed and tested before deployment, particularly changes involving database writes, authentication, permissions, or inventory calculations.

## Deployment

The application is currently structured for deployment on Vercel with Supabase as its backend.

# Eber ERP

Eber ERP is a French-language construction project management web application.
It combines project dashboards, bills of quantities (BPU), progress tracking,
planning, expenses, labor, procurement, invoicing, treasury, HR, documents,
attachments, and an audit trail in a React single-page application.

> This is an early-stage application. Review the security model, database
> policies, accounting behavior, and AI data handling before production use.

## Architecture

- **Frontend:** React 19 and Vite 8, with Tailwind CSS utilities.
- **Data and authentication:** Supabase JavaScript client. The schema evolves
  through the SQL migration files in the repository.
- **Documents:** Supabase Storage through the `documents` bucket.
- **AI (optional):** Google Gemini via `@google/generative-ai`. The current
  implementation calls Gemini directly from the browser and uses
  `gemini-2.5-flash` for BPU extraction, planning suggestions, executive
  summaries, and contextual chat.
- **Exports:** jsPDF and SheetJS (`xlsx`).

The application is JavaScript/JSX, not TypeScript, so there is no TypeScript
type-check command. ESLint and the production build are the available static
checks. No automated test suite is currently included.

## Setup

Requirements: Node.js 20.19+ or 22.12+ (required by Vite 8), npm, and a Supabase
project. Gemini is optional unless AI features are used.

```sh
npm ci
cp .env.example .env
npm run dev
```

Configure these values in `.env`:

- `VITE_SUPABASE_URL`: Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`: browser-safe Supabase anonymous key.
- `VITE_GEMINI_API_KEY`: optional Gemini key. Because Vite embeds `VITE_*`
  values in browser code, restrict this key by API, allowed origin, and quota.
- `DATABASE_URL`: privileged PostgreSQL URL used only by local migration tools.

Never commit `.env`. The example contains placeholders only.

## Database setup

The SQL files are historical, incremental migrations rather than a consolidated
schema. Review them and apply only the migrations appropriate for your database.
Several retained migration runners read `DATABASE_URL` from `.env`; they are
administrative tools and should not be shipped in a browser deployment.

Supabase Row Level Security and Storage policies are part of the deployment's
security boundary. Audit the supplied policies against your tenancy model before
loading real data. Uploaded construction documents and data sent to Gemini may
contain confidential information.

## Checks

```sh
npm run lint
npm run build
npm run check
npm audit
git diff --check
```

There are currently no automated unit, integration, or end-to-end tests.

## Limitations

- Gemini requests and selected project data are sent from the user's browser to
  Google's API; there is no server-side key isolation or redaction layer.
- The AI output is probabilistic and should not be treated as engineering,
  accounting, legal, or safety advice.
- Browser-side PDF and spreadsheet parsing is bounded by client memory.
- Database migrations are incremental and need manual review and sequencing.
- Production readiness, accessibility, localization, and multi-tenant isolation
  have not been independently verified.

## License

Released under the [MIT License](LICENSE). See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for dependency notices.

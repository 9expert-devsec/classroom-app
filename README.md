This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## External API

Partner sites in the 9Expert group can read the class schedule catalogue — classes,
instructor identity and instructor signatures — through a read-only, API-key-protected
API mounted at `/api/ext/v1`.

- **Production base URL:** `https://register.9expert.app/api/ext/v1`
- **Auth:** `x-api-key` header (or `Authorization: Bearer`), scope `classes.read`
- **Endpoints:** `/health`, `/classes`, `/classes/{idOrName}`, `/signature/{token}`
- **Never exposed:** student, check-in, food or document-receipt data of any kind

Docs and tooling:

- [External API Integration Guide](docs/EXTERNAL_API_INTEGRATION_GUIDE.md) — endpoints,
  query parameters, full response schema, Node/Python/PHP samples, error codes, and the
  current data caveats partners must design around
- [Postman collection](docs/postman/9expert-classroom-api.postman_collection.json) —
  import, paste your key into the `apiKey` variable, and send

Keys are issued by a Super Admin under **API Keys** in the admin console. A key is shown
exactly once at creation; only its hash is stored.

Required environment variables are documented in [.env.example](.env.example).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

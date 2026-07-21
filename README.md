# Seizure Tracker

A Next.js app for tracking seizures per patient. Data is stored in DynamoDB and authentication is handled by Clerk.

## Local development

The local dev setup runs a local DynamoDB inside Docker and starts the Next.js app.

1. Copy the example environment file:

   ```bash
   cp .env.example .env.local
   ```

2. Start the local DynamoDB and Next.js server:

   ```bash
   npm run dev
   ```

   This will:

   - Start the `dynamodb-local` container via Docker Compose.
   - Wait for the database to be ready.
   - Create the required tables (idempotent).
   - Start the Next.js dev server with Turbopack.

3. Seed the database with a sample patient and some seizures:

   ```bash
   npm run db:seed
   ```

   The seeded patient is owned by the `LOCAL_AUTH_USER_ID` value in `.env.local`.

4. Open [http://localhost:3000](http://localhost:3000).

### Other useful scripts

- `npm run dev:app` — start Next.js without starting the local database.
- `npm run dev:down` — stop the local database container.
- `npm run dev:reset` — remove the local database volume and recreate the tables.
- `npm run db:seed` — insert sample data into the local database.

## Clerk-less local mode

Set `LOCAL_AUTH_USER_ID` in `.env.local` to bypass Clerk entirely:

```bash
LOCAL_AUTH_USER_ID=local-user
```

When this variable is set:

- The app treats the local user as signed in.
- Clerk keys, `ClerkProvider`, `SignIn`, `SignUp`, and the middleware allowlist checks are skipped.
- `/sign-in` and `/sign-up` redirect to `/settings`.
- `SignOutButton` becomes a no-op button.

Remove or unset `LOCAL_AUTH_USER_ID` to use normal Clerk authentication.

## Production / real AWS

For production or shared AWS environments, set the real AWS credentials and remove `DYNAMODB_ENDPOINT` and `LOCAL_AUTH_USER_ID`:

```bash
AWS_REGION=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
# DYNAMODB_ENDPOINT=...  # leave unset to use AWS
# LOCAL_AUTH_USER_ID=... # leave unset to use Clerk

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
```

## Testing and checks

```bash
npm test
npm run lint
npm run build
```

## Deployment

This is a standard Next.js application. Deploy on the platform of your choice (e.g. Vercel) with the production environment variables above.

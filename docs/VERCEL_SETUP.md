# Quick Vercel Setup Checklist

## Environment Variables to Add in Vercel

Add these in **Project Settings → Environment Variables** (or during initial setup):

| Variable Name | Where to Find It | Example Value |
|---------------|------------------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon public key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `NEXT_PUBLIC_SITE_URL` | Your Vercel deployment URL (after first deploy) | `https://whiteboard-xxxxx.vercel.app` |

**Important**: Select all three environments (Production, Preview, Development) for each variable.

## After First Deployment

1. Copy your Vercel deployment URL
2. Update `NEXT_PUBLIC_SITE_URL` in Vercel environment variables
3. Update Supabase redirect URLs (see below)

## Supabase Redirect URLs

After deployment, add these in **Supabase Dashboard → Authentication → URL Configuration**:

- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs**:
  - `https://your-app.vercel.app/auth/callback`
  - `https://your-app-*.vercel.app/auth/callback` (for preview deployments)

# Deployment Guide

This guide covers deploying the Whiteboard app to Vercel.

## Prerequisites

- ✅ Code pushed to a GitHub repository
- ✅ Vercel account (sign up at [vercel.com](https://vercel.com))
- ✅ Supabase project set up (see [README.md](./README.md))
- ✅ Environment variables ready from your Supabase project

## Step 1: Create Vercel Project

1. **Go to Vercel Dashboard**
   - Visit [vercel.com/dashboard](https://vercel.com/dashboard)
   - Sign in with your GitHub account (recommended) or email

2. **Import your repository**
   - Click **Add New...** → **Project**
   - You'll see a list of your GitHub repositories
   - Find your `whiteboard` repository and click **Import**

3. **Configure project settings**
   - **Framework Preset**: Vercel should auto-detect "Next.js" ✅
   - **Root Directory**: Leave as `./` (default)
   - **Build Command**: `npm run build` (auto-filled)
   - **Output Directory**: `.next` (auto-filled)
   - **Install Command**: `npm install` (auto-filled)
   - **DO NOT** click Deploy yet! Add environment variables first.

## Step 2: Add Environment Variables

Before deploying, add your environment variables in Vercel:

1. **In the project setup page**, scroll down to **Environment Variables**

2. **Add these three variables**:

   | Variable Name | Value | Environments |
   |---------------|-------|--------------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Production, Preview, Development |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key | Production, Preview, Development |
   | `NEXT_PUBLIC_SITE_URL` | Your Vercel URL (see note below) | Production, Preview, Development |

   **Where to find Supabase values**:
   - Go to your Supabase project → **Settings** → **API**
   - Copy **Project URL** → use for `NEXT_PUBLIC_SUPABASE_URL`
   - Copy **anon public** key → use for `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   **About `NEXT_PUBLIC_SITE_URL`**:
   - You'll get your Vercel URL after the first deployment (e.g., `https://whiteboard-xyz.vercel.app`)
   - For now, you can use a placeholder like `https://your-app.vercel.app`
   - You can update it after deployment in **Project Settings** → **Environment Variables**

3. **Important**: Select **all three environments** (Production, Preview, Development) for each variable using the checkboxes.

## Step 3: Deploy

1. **Click "Deploy"** at the bottom of the project setup page

2. **Wait for deployment** (usually 2-3 minutes)
   - You can watch the build logs in real-time
   - The build will fail if environment variables are missing

3. **Once deployed**, you'll see:
   - Your production URL (e.g., `https://whiteboard-xyz.vercel.app`)
   - A success message
   - Option to visit your site

## Step 4: Update Supabase Redirect URLs

After deployment, update your Supabase authentication settings:

1. **Go to Supabase Dashboard**
   - Navigate to **Authentication** → **URL Configuration**

2. **Update redirect URLs**:
   - **Site URL**: `https://your-app.vercel.app` (replace with your actual Vercel URL)
   - **Redirect URLs**: Add these (one per line):
     ```
     https://your-app.vercel.app/auth/callback
     https://your-app-*.vercel.app/auth/callback
     ```
     The second URL with `*` is optional and supports preview deployments for pull requests.

3. **Click "Save"**

4. **Update `NEXT_PUBLIC_SITE_URL` in Vercel** (if you used a placeholder):
   - Go to your Vercel project → **Settings** → **Environment Variables**
   - Find `NEXT_PUBLIC_SITE_URL` and click the edit icon
   - Update with your actual Vercel URL
   - Click **Save**
   - Vercel will automatically trigger a new deployment

## Step 5: Test Your Deployment

1. **Visit your Vercel URL** (e.g., `https://whiteboard-xyz.vercel.app`)

2. **Test authentication**:
   - Click "Login" and enter your email
   - Check your email for the magic link
   - Click the link and verify you're redirected correctly

3. **Test board functionality**:
   - Create a new board
   - Draw something on the canvas
   - Wait 5 seconds and verify the "Saved" indicator appears
   - Refresh the page and verify your drawing persists

## Continuous Deployment

Vercel automatically deploys when you push to GitHub:

- **Push to `main` branch** → Production deployment
- **Push to other branches** → Preview deployment with unique URL
- **Open a Pull Request** → Preview deployment for the PR

## Support

If you encounter issues:
1. Check Vercel deployment logs for build errors
2. Check Supabase logs (Dashboard → Logs)
3. Verify all environment variables are set correctly
4. Ensure database schema is set up (see [README.md](./README.md))

# Deployment Guide

This guide will walk you through deploying the Whiteboard app to Vercel.

## Prerequisites

- ✅ GitHub account (logged in)
- ✅ Vercel account (logged in)
- ✅ Supabase project set up
- ✅ Environment variables ready

## Step 1: Create GitHub Repository

1. **Go to GitHub** and create a new repository:
   - Visit [github.com/new](https://github.com/new)
   - Repository name: `whiteboard` (or your preferred name)
   - Description: "Collaborative whiteboard app"
   - Choose **Public** or **Private**
   - **Do NOT** initialize with README, .gitignore, or license (we already have these)
   - Click **Create repository**

2. **Copy the repository URL** (you'll need it in the next step)

## Step 2: Push Code to GitHub

Run these commands in your terminal (from the project root):

```bash
# Add the GitHub remote (replace YOUR_USERNAME and REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git

# Verify the remote was added
git remote -v

# Push your code to GitHub
git branch -M main
git push -u origin main
```

**Note**: If you get an authentication error, you may need to:
- Use a Personal Access Token instead of password
- Or set up SSH keys for GitHub

## Step 3: Deploy to Vercel

### Option A: Import from GitHub (Recommended)

1. **Go to Vercel Dashboard**
   - Visit [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click **Add New...** → **Project**

2. **Import your GitHub repository**
   - You should see your `whiteboard` repository in the list
   - Click **Import** next to it

3. **Configure Project**
   - **Framework Preset**: Vercel should auto-detect "Next.js"
   - **Root Directory**: Leave as `./` (default)
   - **Build Command**: `npm run build` (auto-filled)
   - **Output Directory**: `.next` (auto-filled)
   - **Install Command**: `npm install` (auto-filled)

4. **Environment Variables**
   - **DO NOT** click Deploy yet!
   - First, add your environment variables (see Step 4 below)

### Option B: Vercel CLI (Alternative)

If you prefer using the CLI:

```bash
# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (follow prompts)
vercel

# For production deployment
vercel --prod
```

## Step 4: Configure Environment Variables

**Before deploying**, you must add your environment variables in Vercel:

1. **In the Vercel project setup page**, scroll down to **Environment Variables**

2. **Add the following variables**:

   | Name | Value | Environment |
   |------|-------|-------------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | Production, Preview, Development |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-anon-key` | Production, Preview, Development |
   | `NEXT_PUBLIC_SITE_URL` | `https://your-app.vercel.app` | Production, Preview, Development |

   **Important Notes**:
   - For `NEXT_PUBLIC_SITE_URL`, you can use your Vercel deployment URL (e.g., `https://whiteboard-xyz.vercel.app`)
   - You'll get the exact URL after the first deployment
   - You can update it later in Project Settings → Environment Variables
   - Make sure to select **all three environments** (Production, Preview, Development) for each variable

3. **Where to find your Supabase credentials**:
   - Go to your Supabase project dashboard
   - Navigate to **Settings** → **API**
   - Copy **Project URL** → use for `NEXT_PUBLIC_SUPABASE_URL`
   - Copy **anon/public key** → use for `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Step 5: Update Supabase Redirect URLs

1. **Go to Supabase Dashboard**
   - Navigate to **Authentication** → **URL Configuration**

2. **Add Redirect URLs**:
   - **Site URL**: `https://your-app.vercel.app`
   - **Redirect URLs**: Add these:
     - `https://your-app.vercel.app/auth/callback`
     - `https://your-app-*.vercel.app/auth/callback` (for preview deployments)

3. **Save changes**

## Step 6: Deploy

1. **Click "Deploy"** in the Vercel project setup page

2. **Wait for deployment** (usually 2-3 minutes)

3. **Once deployed**, you'll see:
   - Your production URL (e.g., `https://whiteboard-xyz.vercel.app`)
   - Deployment status and logs

## Step 7: Update Environment Variables (If Needed)

If you used a placeholder for `NEXT_PUBLIC_SITE_URL`:

1. Go to **Project Settings** → **Environment Variables**
2. Update `NEXT_PUBLIC_SITE_URL` with your actual Vercel URL
3. **Redeploy** (Vercel will automatically redeploy, or trigger manually)

## Step 8: Test Your Deployment

1. **Visit your Vercel URL**
2. **Test authentication**:
   - Try logging in with a magic link
   - Check your email for the magic link
   - Click the link and verify you're redirected correctly
3. **Test board creation**:
   - Create a new board
   - Draw something on the canvas
   - Verify auto-save works

## Troubleshooting

### Build Fails

- **Check build logs** in Vercel dashboard
- **Common issues**:
  - Missing environment variables
  - TypeScript errors
  - Missing dependencies

### Authentication Not Working

- **Verify redirect URLs** in Supabase match your Vercel URL
- **Check environment variables** are set correctly
- **Verify** `NEXT_PUBLIC_SITE_URL` matches your production URL

### Database Connection Issues

- **Verify** `NEXT_PUBLIC_SUPABASE_URL` is correct
- **Check** RLS policies are set up correctly
- **Verify** your Supabase project is active

## Continuous Deployment

Vercel automatically deploys when you push to GitHub:

- **Push to `main` branch** → Production deployment
- **Push to other branches** → Preview deployment
- **Pull requests** → Preview deployment with unique URL

## Next Steps

- Set up a custom domain (optional)
- Configure analytics (optional)
- Set up monitoring and error tracking (optional)

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check Supabase logs
3. Review environment variables
4. Verify database schema is set up correctly

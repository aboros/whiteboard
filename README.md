# Whiteboard App

A collaborative whiteboard application built with Next.js, Excalidraw, and Supabase. 

To keep things very tidy:  
- Users can only be added via the Supabase UI.  
- All users can see and edit all boards  

## Features

- 🔐 Magic link authentication (passwordless)
- 📝 Create and manage multiple whiteboards
- 🎨 Real-time collaborative drawing with Excalidraw
- 💾 Auto-save functionality
- 👥 Multi-user presence tracking

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Canvas**: Excalidraw
- **Backend**: Supabase (Auth, PostgreSQL, Realtime)
- **Styling**: Tailwind CSS
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase account (free tier works)
- Git

### Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-username/whiteboard.git
cd whiteboard

# Install dependencies
npm install
```

### Step 2: Set Up Supabase Project

1. **Create a Supabase account and project**
   - Go to [supabase.com](https://supabase.com) and sign up (or sign in)
   - Click **New Project**
   - Choose an organization (or create one)
   - Fill in project details:
     - **Name**: `whiteboard` (or your preferred name)
     - **Database Password**: Create a strong password (save it securely)
     - **Region**: Choose the closest region to you
   - Click **Create new project**
   - Wait 2-3 minutes for the project to be provisioned

2. **Get your Supabase credentials**
   - Once your project is ready, go to **Settings** → **API**
   - Copy the **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - Copy the **anon public** key (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

3. **Set up the database schema**
   - In your Supabase dashboard, go to **SQL Editor**
   - Click **New query**
   - Copy and paste the SQL from the [Database Schema](#database-schema) section below
   - Click **Run** (or press `Cmd/Ctrl + Enter`)
   - You should see "Success. No rows returned"

4. **Configure redirect URLs**
   - Go to **Authentication** → **URL Configuration**
   - Under **Redirect URLs**, add:
     - `http://localhost:3000/auth/callback`
   - Click **Save**

5. **Add a test user** (optional, for testing)
   - Go to **Authentication** → **Users**
   - Click **Add user** → **Create new user**
   - Enter an email address (use your own for testing)
   - Leave password empty (we're using magic links)
   - Click **Create user**

### Step 3: Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
# Copy your values from Supabase Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Replace the placeholder values with your actual Supabase credentials from Step 2.

### Step 4: Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Step 5: Test the Application

1. **Login**: Enter the email address you added in Supabase (Step 2.6)
2. **Check your email**: You should receive a magic link
3. **Click the magic link**: You'll be redirected back to the app and logged in
4. **Create a board**: Click "New Board" and give it a name
5. **Draw something**: Use the Excalidraw tools to draw on the canvas
6. **Verify auto-save**: Wait 5 seconds and check the save indicator (top-left)

## Database Schema

Run this SQL in your Supabase SQL Editor:

```sql
-- Create boards table
CREATE TABLE IF NOT EXISTS boards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  elements JSONB DEFAULT '[]'::jsonb,
  app_state JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on slug for fast lookups
CREATE INDEX IF NOT EXISTS idx_boards_slug ON boards(slug);

-- Create index on created_by for user's boards
CREATE INDEX IF NOT EXISTS idx_boards_created_by ON boards(created_by);

-- Enable Row Level Security
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all boards
CREATE POLICY "Users can view all boards"
  ON boards FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Users can create boards
CREATE POLICY "Users can create boards"
  ON boards FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Users can update their own boards
CREATE POLICY "Users can update their own boards"
  ON boards FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Policy: Users can delete their own boards
CREATE POLICY "Users can delete their own boards"
  ON boards FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_boards_updated_at
  BEFORE UPDATE ON boards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Deployment

For deploying to Vercel, see [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## Project Structure

```
app/
├── layout.tsx              # Root layout
├── page.tsx                # Dashboard (board list)
├── login/page.tsx          # Login page
├── auth/callback/route.ts  # Magic link callback
└── board/[slug]/page.tsx   # Dynamic board route

components/
├── auth/                   # Authentication components
├── boards/                 # Board management
├── canvas/                 # Excalidraw wrapper
└── ui/                     # Shared UI components

lib/
├── supabase/               # Supabase clients
├── actions/                # Server actions
└── utils/                  # Utilities
```

## License

MIT

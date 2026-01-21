# Whiteboard App

A collaborative whiteboard application built with Next.js, Excalidraw, and Supabase. 

To keep things very tidy:  
- Users can only be added via the Supabase UI.  
- Boards are private by default and only visible to their owners
- Board owners can share boards with other users by email
- Boards can be made public for read-only access by anyone  

## Features

- 🔐 Magic link authentication (passwordless)
- 📝 Create and manage multiple whiteboards
- 🔒 Private boards by default (only visible to owners)
- 👥 Share boards with other users by email
- 🌐 Make boards public for read-only access
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
  is_public BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_boards_slug ON boards(slug);
CREATE INDEX IF NOT EXISTS idx_boards_created_by ON boards(created_by);
CREATE INDEX IF NOT EXISTS idx_boards_is_public ON boards(is_public) WHERE is_public = TRUE;

-- Create board_shares table for sharing functionality
CREATE TABLE IF NOT EXISTS board_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Prevent duplicate shares
  UNIQUE(board_id, shared_with_user_id)
);

-- Create indexes for board_shares
CREATE INDEX IF NOT EXISTS idx_board_shares_board_id ON board_shares(board_id);
CREATE INDEX IF NOT EXISTS idx_board_shares_shared_with_user_id ON board_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_board_shares_shared_by_user_id ON board_shares(shared_by_user_id);

-- Enable Row Level Security
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_shares ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for boards
-- ============================================

-- Policy: Authenticated users can view boards they own, are shared with them, or are public
CREATE POLICY "Authenticated users can view owned or shared boards"
  ON boards FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM board_shares
      WHERE board_shares.board_id = boards.id
      AND board_shares.shared_with_user_id = auth.uid()
    )
    OR
    is_public = TRUE
  );

-- Policy: Anonymous users can view public boards (read-only)
CREATE POLICY "Anonymous users can view public boards"
  ON boards FOR SELECT
  TO anon
  USING (is_public = TRUE);

-- Policy: Authenticated users can create boards
CREATE POLICY "Authenticated users can insert boards"
  ON boards FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Users can update boards they own or are shared with them
CREATE POLICY "Users can update owned or shared boards"
  ON boards FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM board_shares
      WHERE board_shares.board_id = boards.id
      AND board_shares.shared_with_user_id = auth.uid()
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM board_shares
      WHERE board_shares.board_id = boards.id
      AND board_shares.shared_with_user_id = auth.uid()
    )
  );

-- Policy: Only board owners can delete boards
CREATE POLICY "Authenticated users can delete their own boards"
  ON boards FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- ============================================
-- RLS Policies for board_shares
-- ============================================

-- Policy: Users can view shares where they are the recipient or creator
CREATE POLICY "Users can view their shares"
  ON board_shares FOR SELECT
  TO authenticated
  USING (
    shared_with_user_id = auth.uid()
    OR
    shared_by_user_id = auth.uid()
  );

-- Policy: Users can create shares for boards they own
CREATE POLICY "Users can create shares they own"
  ON board_shares FOR INSERT
  TO authenticated
  WITH CHECK (
    shared_by_user_id = auth.uid()
    AND check_board_ownership(board_id, auth.uid())
  );

-- Policy: Users can delete shares they created
CREATE POLICY "Users can delete shares they created"
  ON board_shares FOR DELETE
  TO authenticated
  USING (shared_by_user_id = auth.uid());

-- ============================================
-- Helper Functions
-- ============================================

-- Function to check if user owns a board (bypasses RLS to avoid recursion)
CREATE OR REPLACE FUNCTION check_board_ownership(board_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.boards
    WHERE id = board_uuid
    AND created_by = user_uuid
  );
END;
$$;

-- Function to get user by email (for sharing functionality)
CREATE OR REPLACE FUNCTION get_user_by_email(user_email TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id::UUID,
    au.email::TEXT
  FROM auth.users au
  WHERE au.email = user_email;
END;
$$;

-- Function to get shared users for a board with their emails
CREATE OR REPLACE FUNCTION get_board_shared_users(board_uuid UUID)
RETURNS TABLE (
  user_id UUID,
  user_email TEXT,
  shared_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bs.shared_with_user_id::UUID,
    au.email::TEXT,
    bs.created_at::TIMESTAMPTZ
  FROM public.board_shares bs
  JOIN auth.users au ON au.id = bs.shared_with_user_id
  WHERE bs.board_id = board_uuid
  ORDER BY bs.created_at DESC;
END;
$$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create trigger to automatically update updated_at
CREATE TRIGGER boards_updated_at
  BEFORE UPDATE ON boards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
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

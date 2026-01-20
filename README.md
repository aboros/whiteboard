# Whiteboard App

A collaborative whiteboard application built with Next.js, Excalidraw, and Supabase.

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
- A Supabase account and project
- (For deployment) GitHub and Vercel accounts

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd whiteboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

4. **Set up Supabase**
   - Create a new project at [supabase.com](https://supabase.com)
   - Run the database migration (see Database Schema section)
   - Enable Magic Link authentication in Authentication → Providers → Email
   - Configure redirect URL: `http://localhost:3000/auth/callback`
   - Add users manually via Authentication → Users

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

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

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

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

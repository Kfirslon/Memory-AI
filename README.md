# Memory Tap

A premium AI-powered memory capture and organization app built with Next.js 14+, Supabase, and Groq AI.

## 🚀 Features

- **Voice Recording**: Tap to record your thoughts, ideas, tasks, and reminders
- **AI Transcription**: Powered by Groq Whisper large-v3 for accurate speech-to-text
- **Smart Intelligence**: Groq Llama 3 automatically categorizes and summarizes your memories
- **Focus View**: AI-generated daily briefing and priority task recommendations
- **Analytics**: Productivity score and habit analysis from your memory patterns
- **Supabase Backend**: Secure authentication, database, and cloud storage
- **Premium UI**: Modern, smooth animations with Framer Motion and TailwindCSS

## 📋 Prerequisites

Before you begin, ensure you have:

- Node.js 18+ installed
- A Supabase account and project
- A Groq API account (free tier available)
- (Optional) Google Cloud OAuth credentials for Google sign-in

## 🛠️ Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` and add your credentials:

- **GROQ_API_KEY**: Get from [console.groq.com](https://console.groq.com)
- Supabase credentials are already provided

### 3. Set Up Supabase Database

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Run the SQL script from `supabase/schema.sql`

### 4. Configure Supabase Storage

1. In Supabase Dashboard, go to **Storage**
2. Create a new bucket named `memories` (make it private)
3. Apply the storage policies from `supabase/schema.sql`

### 5. Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app!

## 📖 Complete Setup Guide

For detailed setup instructions including:
- How to get a Groq API key
- Google OAuth configuration
- Troubleshooting tips

See **[SETUP_GUIDE.md](./SETUP_GUIDE.md)**

## 🏗️ Tech Stack

- **Framework**: Next.js 14+ (App Router, TypeScript)
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **AI**: Groq (Whisper large-v3, Llama 3.3-70b)
- **Styling**: TailwindCSS
- **Animations**: Framer Motion
- **Icons**: Lucide React

## 📁 Project Structure

```
memory-tap/
├── src/
│   ├── app/                    # Next.js pages
│   │   ├── auth/callback/      # OAuth callback
│   │   ├── layout.tsx
│   │   └── page.tsx            # Main dashboard
│   ├── components/             # React components
│   │   ├── AuthScreen.tsx
│   │   ├── RecordButton.tsx
│   │   ├── MemoryCard.tsx
│   │   ├── AudioPlayer.tsx
│   │   ├── FocusView.tsx
│   │   └── AnalyticsView.tsx
│   └── lib/                    # Services and utilities
│       ├── groq/client.ts      # Groq AI integration
│       ├── supabase/           # Supabase clients
│       └── types.ts            # TypeScript definitions
├── supabase/
│   └── schema.sql              # Database schema
└── public/
```

## 🎯 Usage

1. **Sign Up/Login**: Create an account or sign in with Google
2. **Record**: Tap the record button and speak your thought
3. **AI Processing**: Your recording is transcribed and categorized automatically
4. **View Memories**: Browse, search, and filter your memories
5. **Focus View**: See AI-generated priorities and daily briefing
6. **Analytics**: Track your productivity and habit patterns

## 🔒 Privacy & Security

- All data is stored securely in your Supabase database
- Row Level Security (RLS) ensures users can only access their own data
- Audio files are stored in private Supabase Storage buckets
- Authentication handled by Supabase Auth

## 🚀 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please open an issue or submit a PR.

## 💬 Support

For issues or questions, see the [SETUP_GUIDE.md](./SETUP_GUIDE.md) or open an issue on GitHub.
# Updated environment configuration

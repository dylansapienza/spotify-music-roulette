# Music Roulette 🎵

A multiplayer music guessing game powered by Spotify. Connect with friends and guess whose top songs are playing!

## How to Play

1. **Create or Join a Game**: One player creates a game and shares the 4-letter code with friends
2. **Connect Spotify**: All players authenticate with their Spotify accounts
3. **Guess the Owner**: Listen to 30-second song previews and guess which player has that song in their top 20
4. **Score Points**: Earn 100 points for each correct guess
5. **Win**: The player with the most points after all rounds wins!

## Features

- Real-time multiplayer using Pusher
- Spotify integration for top tracks (last 6 months)
- Beautiful, mobile-first design
- Animated UI with Framer Motion
- Smart duplicate handling (song goes to player with higher ranking)

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + Framer Motion
- **Auth**: NextAuth.js with Spotify OAuth
- **Real-time**: Pusher Channels
- **State**: Zustand

## Setup

### Prerequisites

- Node.js 18+
- Spotify Developer account
- Pusher account

### 1. Clone and Install

```bash
git clone <your-repo>
cd spotify-seamus
npm install
```

### 2. Create Spotify App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add redirect URI: `http://localhost:3000/api/auth/callback/spotify`
4. Copy the Client ID and Client Secret

### 3. Create Pusher App

1. Go to [Pusher Dashboard](https://dashboard.pusher.com)
2. Create a new Channels app
3. Copy the App ID, Key, Secret, and Cluster

### 4. Configure Environment Variables

Copy `.env.local` and fill in your values:

```bash
# Spotify
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# NextAuth
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
NEXTAUTH_URL=http://localhost:3000

# Pusher
PUSHER_APP_ID=your_pusher_app_id
PUSHER_KEY=your_pusher_key
PUSHER_SECRET=your_pusher_secret
PUSHER_CLUSTER=your_cluster

# Public Pusher keys
NEXT_PUBLIC_PUSHER_KEY=your_pusher_key
NEXT_PUBLIC_PUSHER_CLUSTER=your_cluster
```

Generate a NextAuth secret:
```bash
openssl rand -base64 32
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the project in Vercel
3. Add all environment variables
4. Update `NEXTAUTH_URL` to your production URL
5. Add production redirect URI in Spotify Dashboard

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  Player Phones  │────▶│    Next.js      │
│  (React Client) │     │    (Vercel)     │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │  WebSocket           │  REST API
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│     Pusher      │     │   Spotify API   │
│   (Real-time)   │     │  (OAuth + Data) │
└─────────────────┘     └─────────────────┘
```

## Game Flow

1. **Lobby**: Players join and wait for host to start
2. **Rounds**: 10 rounds of guessing (or fewer if limited songs)
3. **Each Round**:
   - 30-second preview plays
   - Players guess whose song it is
   - Results revealed after all guess
   - Next round starts after 5 seconds
4. **Results**: Final scoreboard with rankings

## Contributing

Pull requests are welcome! For major changes, please open an issue first.

## License

MIT

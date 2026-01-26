import { NextRequest, NextResponse } from 'next/server';
import { getSpotifyUserById, extractSpotifyUserId } from '@/lib/spotify';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { input } = body;

    if (!input || typeof input !== 'string') {
      return NextResponse.json(
        { error: 'Username or profile URL is required' },
        { status: 400 }
      );
    }

    // Extract the user ID from the input (handles URLs and direct usernames)
    const userId = extractSpotifyUserId(input);

    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid username or profile URL' },
        { status: 400 }
      );
    }

    try {
      const user = await getSpotifyUserById(userId);
      return NextResponse.json({ user });
    } catch (err) {
      console.error('User lookup failed:', err);
      return NextResponse.json(
        { error: 'User not found. Please check the username and try again.' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Lookup user error:', error);
    return NextResponse.json(
      { error: 'Failed to lookup user' },
      { status: 500 }
    );
  }
}

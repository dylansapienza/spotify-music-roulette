import { NextRequest, NextResponse } from 'next/server';
import { getPusher } from '@/lib/pusher/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const socketId = formData.get('socket_id') as string;
    const channel = formData.get('channel_name') as string;
    
    // Get user info from query params or form data
    const userId = formData.get('user_id') as string || 'anonymous';
    const userName = formData.get('user_name') as string || 'Anonymous';

    if (!socketId || !channel) {
      return NextResponse.json(
        { error: 'Missing socket_id or channel_name' },
        { status: 400 }
      );
    }

    const pusher = getPusher();

    // For presence channels, we need to provide user info
    if (channel.startsWith('presence-')) {
      const presenceData = {
        user_id: userId,
        user_info: {
          name: userName,
        },
      };

      const auth = pusher.authorizeChannel(socketId, channel, presenceData);
      return NextResponse.json(auth);
    }

    // For private channels
    const auth = pusher.authorizeChannel(socketId, channel);
    return NextResponse.json(auth);
  } catch (error) {
    console.error('Pusher auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

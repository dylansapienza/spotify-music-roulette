import { customAlphabet } from 'nanoid';

// Generate a 4-character uppercase game code
const generateCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 4);

export function createGameCode(): string {
  return generateCode();
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatArtists(artists: { name: string }[]): string {
  return artists.map((a) => a.name).join(', ');
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

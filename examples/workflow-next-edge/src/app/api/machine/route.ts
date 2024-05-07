import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const runtime = 'edge'; // 'nodejs' is the default

export function GET(request: NextRequest) {
  return NextResponse.json(
    {
      body: request.cookies.get('next-state'),
      path: request.nextUrl.pathname,
      query: request.nextUrl.search,
      cookies: request.cookies.get('next-state')
    },
    {
      status: 200
    }
  );
}

export function POST(request: NextRequest) {
  request.cookies.set('next-state', 'next-state-cookie');
  console.log('set ');
  return NextResponse.json(
    {
      body: request.body,
      path: request.nextUrl.pathname,
      query: request.nextUrl.search,
      cookies: request.cookies.get('next-state')
    },
    {
      status: 200
    }
  );
}

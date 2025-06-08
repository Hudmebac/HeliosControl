
import { type NextRequest, NextResponse } from 'next/server';

const GIVENERGY_API_TARGET_BASE = 'https://api.givenergy.cloud/v1';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  const slugPath = params.slug.join('/');
  const requestUrl = new URL(request.url);
  const searchParams = requestUrl.search; // Includes '?' if params exist

  const targetUrl = `${GIVENERGY_API_TARGET_BASE}/${slugPath}${searchParams}`;

  const authToken = request.headers.get('Authorization');

  if (!authToken) {
    return NextResponse.json({ error: 'Authorization header missing' }, { status: 401 });
  }

  try {
    const apiResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Authorization': authToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      // IMPORTANT: Do not pass the original request's body for GET requests.
      // If you need to support POST/PUT etc. in the future, handle body appropriately.
    });

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      // Forward the error status and body from GivEnergy API
      return NextResponse.json(data || { error: `GivEnergy API error: ${apiResponse.status}` }, { status: apiResponse.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in GivEnergy proxy:', error);
    return NextResponse.json({ error: 'Proxy request failed', details: error.message }, { status: 500 });
  }
}

// If you need to support other methods like POST, you'd add them here:
// export async function POST(request: NextRequest, { params }: { params: { slug: string[] } }) { ... }


import { type NextRequest, NextResponse } from 'next/server';

const GIVENERGY_API_TARGET_BASE = 'https://api.givenergy.cloud/v1';

async function handleGivEnergyResponse(apiResponse: Response, targetUrl: string) {
  if (!apiResponse.ok) {
    let errorPayload: { error?: string; message?: string; details?: any } = {};
    try {
      errorPayload = await apiResponse.json();
    } catch (parseError) {
      errorPayload = {
        error: `GivEnergy API error: ${apiResponse.status} ${apiResponse.statusText}.`,
        details: `Target response status: ${apiResponse.status}. Response body was not valid JSON or was empty. URL: ${targetUrl}`
      };
    }
    if (typeof errorPayload !== 'object' || errorPayload === null) {
      errorPayload = { error: String(errorPayload) };
    }
    if (!errorPayload.error && !errorPayload.message) {
      errorPayload.error = `GivEnergy API request failed with status ${apiResponse.status} for URL: ${targetUrl}.`;
    }
    return NextResponse.json(errorPayload, { status: apiResponse.status });
  }

  if (apiResponse.status === 204) {
    return NextResponse.json({ success: true, message: 'Command accepted by GivEnergy (204 No Content).', originalStatus: apiResponse.statusText }, { status: 204 });
  }

  const contentType = apiResponse.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      const successData = await apiResponse.json();
      return NextResponse.json(successData, { status: apiResponse.status });
    } catch (jsonError) {
      console.error('Error parsing JSON from successful GivEnergy response:', jsonError, 'URL:', targetUrl);
      return NextResponse.json({ success: true, message: 'Command accepted, but response parsing failed (e.g. empty JSON).', originalStatus: apiResponse.statusText }, { status: apiResponse.status });
    }
  } else {
    // For non-JSON success responses (e.g., plain text or other types if any)
    const textData = await apiResponse.text();
    return NextResponse.json({ success: true, message: 'Command accepted by GivEnergy (non-JSON response).', data: textData, originalStatus: apiResponse.statusText }, { status: apiResponse.status });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  const slugPath = params.slug.join('/');
  const requestUrl = new URL(request.url);
  const searchParams = requestUrl.search;

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
    });
    return await handleGivEnergyResponse(apiResponse, targetUrl);
  } catch (error: any) {
    console.error('Error in GivEnergy GET proxy:', error, 'URL:', targetUrl);
    return NextResponse.json({ error: 'Proxy GET request failed', details: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  const slugPath = params.slug.join('/');
  const requestUrl = new URL(request.url);
  const searchParams = requestUrl.search; // Include query params if any

  const targetUrl = `${GIVENERGY_API_TARGET_BASE}/${slugPath}${searchParams}`;
  const authToken = request.headers.get('Authorization');
  const contentType = request.headers.get('Content-Type');

  if (!authToken) {
    return NextResponse.json({ error: 'Authorization header missing' }, { status: 401 });
  }

  if (!contentType || !contentType.includes('application/json')) {
    return NextResponse.json({ error: 'Invalid Content-Type. Must be application/json for POST.' }, { status: 415 });
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const apiResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': authToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    return await handleGivEnergyResponse(apiResponse, targetUrl);
  } catch (error: any) {
    console.error('Error in GivEnergy POST proxy:', error, 'URL:', targetUrl);
    return NextResponse.json({ error: 'Proxy POST request failed', details: error.message }, { status: 500 });
  }
}

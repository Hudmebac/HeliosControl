
import { type NextRequest, NextResponse } from 'next/server';

const GIVENERGY_API_TARGET_BASE = 'https://api.givenergy.cloud/v1';

async function handleGivEnergyResponse(apiResponse: Response, targetUrl: string) {
  if (!apiResponse.ok) { // This covers 4xx and 5xx errors from GivEnergy
    let errorPayload: { error?: string; message?: string; details?: any } = {};
    try {
      errorPayload = await apiResponse.json();
    } catch (parseError) {
      // If parsing fails, construct a generic error but still use the original status
      errorPayload = {
        error: `GivEnergy API error: ${apiResponse.status} ${apiResponse.statusText}.`,
        details: `Target response status: ${apiResponse.status}. Response body was not valid JSON or was empty. URL: ${targetUrl}`
      };
    }
    // Ensure errorPayload is an object and has a primary error message
    if (typeof errorPayload !== 'object' || errorPayload === null) {
      errorPayload = { error: String(errorPayload) }; // Convert non-objects to a string error
    }
    if (!errorPayload.error && !errorPayload.message) { // If after parsing, no specific error/message field
      errorPayload.error = `GivEnergy API request failed with status ${apiResponse.status} for URL: ${targetUrl}.`;
    }
    return NextResponse.json(errorPayload, { status: apiResponse.status });
  }

  // Handle successful responses (2xx)
  if (apiResponse.status === 204) { // Explicitly handle 204 No Content
    // For 204, return a success JSON as the body will be empty
    return NextResponse.json({ success: true, message: 'Command accepted by GivEnergy (204 No Content).', originalStatus: apiResponse.statusText }, { status: 204 });
  }

  const contentType = apiResponse.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      const successData = await apiResponse.json();
      return NextResponse.json(successData, { status: apiResponse.status });
    } catch (jsonError) {
      console.error('Error parsing JSON from successful GivEnergy response:', jsonError, 'URL:', targetUrl);
      // If JSON parsing fails despite correct content-type, return a success status but indicate parsing issue.
      // This could happen if GivEnergy returns 200 OK with empty body and application/json header.
      return NextResponse.json({ success: true, message: 'Command accepted, but response parsing failed (e.g. empty JSON).', originalStatus: apiResponse.statusText }, { status: apiResponse.status });
    }
  } else {
    // Handle successful non-JSON responses (e.g., empty body for some 200 OK control commands if Content-Type is not JSON)
    // This indicates success, but the actual GivEnergy API didn't return JSON content.
    return NextResponse.json({ success: true, message: 'Command accepted by GivEnergy (non-JSON response).', originalStatus: apiResponse.statusText }, { status: apiResponse.status });
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
  const searchParams = requestUrl.search; // Keep query params if any for POST
  const targetUrl = `${GIVENERGY_API_TARGET_BASE}/${slugPath}${searchParams}`;
  const authToken = request.headers.get('Authorization');

  if (!authToken) {
    return NextResponse.json({ error: 'Authorization header missing' }, { status: 401 });
  }

  const contentType = request.headers.get('Content-Type');
  let requestBody: any;

  if (contentType && contentType.toLowerCase().startsWith('application/json')) {
    try {
      requestBody = await request.json();
    } catch (error: any) {
      console.error('Error parsing JSON request body for POST proxy:', error, 'URL:', targetUrl);
      return NextResponse.json({ error: 'Invalid JSON in request body.', details: error.message }, { status: 400 });
    }
  } else {
    // GivEnergy POST commands typically require a JSON body.
    // If Content-Type is not application/json, it's an unsupported media type for this proxy's POST handling.
    console.warn(`POST request to ${targetUrl} received with Content-Type: '${contentType || 'Not specified'}'. Expected 'application/json'.`);
    return NextResponse.json(
        { error: "Content-Type must be 'application/json' for POST requests.",
          details: `Received Content-Type: ${contentType || 'Not specified'}` },
        { status: 415 } // 415 Unsupported Media Type
    );
  }

  try {
    const apiResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': authToken,
        'Content-Type': 'application/json', // GivEnergy API generally expects JSON for POST
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody), // requestBody should be populated if we reached here
    });
    return await handleGivEnergyResponse(apiResponse, targetUrl);
  } catch (error: any) {
    // This catch is for network errors during the fetch to GivEnergy, or if handleGivEnergyResponse throws
    console.error('Error in GivEnergy POST proxy during fetch or response handling:', error, 'URL:', targetUrl);
    return NextResponse.json({ error: 'Proxy POST request to GivEnergy failed', details: error.message }, { status: 502 }); // 502 Bad Gateway
  }
}

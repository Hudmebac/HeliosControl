
import { type NextRequest, NextResponse } from 'next/server';

const GIVENERGY_API_TARGET_BASE = 'https://api.givenergy.cloud/v1';

// Helper function to handle responses from GivEnergy API
async function handleGivEnergyResponse(apiResponse: Response, targetUrl: string): Promise<NextResponse> {
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
      errorPayload = { error: String(errorPayload) }; // Convert non-object to string error
    }
    if (!errorPayload.error && !errorPayload.message) {
      errorPayload.error = `GivEnergy API request failed with status ${apiResponse.status} for URL: ${targetUrl}.`;
    }
    return NextResponse.json(errorPayload, { status: apiResponse.status });
  }

  // Handle 204 No Content success (common for POST commands)
  if (apiResponse.status === 204) {
    return NextResponse.json({ success: true, message: 'Command accepted by GivEnergy (204 No Content).', originalStatus: apiResponse.statusText }, { status: 200 }); // Return 200 from proxy for 204 from GivEnergy
  }

  const contentType = apiResponse.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      const successData = await apiResponse.json();
      return NextResponse.json(successData, { status: apiResponse.status });
    } catch (jsonError) {
      console.error('Error parsing JSON from successful GivEnergy response:', jsonError, 'URL:', targetUrl);
      // If parsing fails but status was ok (e.g. 200 with empty/malformed JSON), treat as success with message
      return NextResponse.json({ success: true, message: 'Command accepted, but response parsing failed (e.g. empty or malformed JSON).', originalStatus: apiResponse.statusText }, { status: apiResponse.status });
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
): Promise<NextResponse> {
  const slugPath = params.slug.join('/');
  const requestUrl = new URL(request.url);
  const searchParams = requestUrl.search; // Keep query parameters

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
    console.error(`[PROXY GET /${slugPath}] Exception:`, error);
    return NextResponse.json({ error: 'Proxy GET request failed', details: error.message, path: `/${slugPath}` }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
): Promise<NextResponse> {
  const slugPath = params.slug.join('/');
  const targetUrl = `${GIVENERGY_API_TARGET_BASE}/${slugPath}`;
  const authToken = request.headers.get('Authorization');

  if (!authToken) {
    return NextResponse.json({ error: 'Authorization header missing' }, { status: 401 });
  }

  const contentType = request.headers.get('Content-Type');
  let requestBody: any = null;

  if (contentType && contentType.includes('application/json')) {
    try {
      requestBody = await request.json();
    } catch (error) {
      console.error(`[PROXY POST /${slugPath}] Error parsing JSON body:`, error, 'URL:', targetUrl);
      return NextResponse.json({ error: 'Invalid JSON body provided', path: `/${slugPath}` }, { status: 400 });
    }
  } else if (request.body && (!contentType || !contentType.includes('application/json'))) {
    // If a body is present, Content-Type must be application/json.
    // request.body is a stream, checking its presence is enough to know if a body was sent.
    console.warn(`[PROXY POST /${slugPath}] POST request to ${targetUrl} received with body but Content-Type is not application/json. Actual: ${contentType}`);
    return NextResponse.json({ error: 'Invalid Content-Type for POST request with body. Expected application/json.', path: `/${slugPath}` }, { status: 415 });
  }
  // If no body is sent (e.g. requestBody is null because request.json() wasn't called or because it's a GET-like POST),
  // and Content-Type wasn't application/json, it might be a command that doesn't require a body.
  // The GivEnergy API will ultimately decide if the request is valid.

  try {
    const apiResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': authToken,
        // Ensure Content-Type is set if a body is present, default to application/json.
        // If no body, Content-Type might not be strictly necessary for some simple GivEnergy commands,
        // but it's safer to include it if the original request had it.
        'Content-Type': contentType || (requestBody ? 'application/json' : ''),
        'Accept': 'application/json',
      },
      body: requestBody ? JSON.stringify(requestBody) : null, // Ensure body is stringified
    });
    return await handleGivEnergyResponse(apiResponse, targetUrl);
  } catch (error: any) {
    // Enhanced logging for the main catch block in POST
    console.error(`[PROXY POST /${slugPath}] Exception during processing:`, error);
    if (error.name) console.error(`[PROXY POST /${slugPath}] Error Name: ${error.name}`);
    if (error.message) console.error(`[PROXY POST /${slugPath}] Error Message: ${error.message}`);
    // Stack trace can be very verbose, log it if needed for deep debugging
    // if (error.stack) console.error(`[PROXY POST /${slugPath}] Error Stack: ${error.stack}`);

    const errorMessageDetail = (error.message && (error.message.toLowerCase().startsWith('fetch failed') || error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED'))) ?
      `Proxy POST request failed to connect to target API at ${targetUrl}. Detail: ${error.message}` :
      `Proxy POST request to ${targetUrl} failed due to an unexpected error. Detail: ${error.message}`;
    
    return NextResponse.json({ error: 'Proxy POST request failed', details: errorMessageDetail, path: `/${slugPath}` }, { status: 500 });
  }
}

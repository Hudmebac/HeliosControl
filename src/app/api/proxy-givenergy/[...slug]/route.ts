
import { type NextRequest, NextResponse } from 'next/server';

const GIVENERGY_API_TARGET_BASE = 'https://api.givenergy.cloud/v1';

// Helper function to handle responses from GivEnergy API
async function handleGivEnergyResponse(apiResponse: Response, targetUrl: string): Promise<NextResponse> {
  if (!apiResponse.ok) {
    let errorPayload: { error?: string; message?: string; details?: any } = {};
    try {
      errorPayload = await apiResponse.json();
    } catch (parseError) {
      // If JSON parsing fails, construct error payload from status
      errorPayload = {
        error: `GivEnergy API error: ${apiResponse.status} ${apiResponse.statusText}.`,
        details: `Target response status: ${apiResponse.status}. Response body was not valid JSON or was empty. URL: ${targetUrl}`
      };
    }
    // Ensure errorPayload is an object and has a message/error
    if (typeof errorPayload !== 'object' || errorPayload === null) {
      errorPayload = { error: String(errorPayload) }; // Convert non-object to string error
    }
    if (!errorPayload.error && !errorPayload.message) {
      errorPayload.error = `GivEnergy API request failed with status ${apiResponse.status} for URL: ${targetUrl}.`;
    }
    // If the original error from GivEnergy was within a "data" object (e.g. for POST commands)
    if (errorPayload.data && (errorPayload.data.error || errorPayload.data.message)) {
        errorPayload = { ...errorPayload.data, originalStatus: apiResponse.status };
    }


    return NextResponse.json(errorPayload, { status: apiResponse.status });
  }

  // Handle 204 No Content success (common for POST commands like settings writes)
  if (apiResponse.status === 204) {
    return NextResponse.json({ success: true, message: 'Command accepted by GivEnergy (204 No Content).', originalStatus: apiResponse.statusText }, { status: 200 });
  }

  const contentType = apiResponse.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      const successData = await apiResponse.json();
      // For POST commands, GivEnergy might wrap success in `data: {success: true, message: "..."}`
      // For GETs, it's usually `data: {...actual_data...}`
      // The proxy should just return the whole JSON structure.
      return NextResponse.json(successData, { status: apiResponse.status });
    } catch (jsonError) {
      console.error('Error parsing JSON from successful GivEnergy response:', jsonError, 'URL:', targetUrl);
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

  // GivEnergy POST commands usually expect 'Content-Type: application/json'.
  // Some commands (like start-charge, stop-charge from new docs) might not send a body client-side.
  // The proxy should still set Content-Type: application/json when forwarding to GivEnergy
  // if that's what GivEnergy's examples imply for the POST /commands/ endpoint.
  if (contentType && contentType.includes('application/json')) {
    try {
      // Only attempt to parse body if Content-Type is application/json and body exists
      if (request.body) {
        const rawBodyText = await request.text(); // Read as text first to check if empty
        if (rawBodyText.trim() !== "") {
            requestBody = JSON.parse(rawBodyText); // Then parse if not empty
        } else {
            requestBody = null; // Body was empty or whitespace
        }
      }
    } catch (error) {
      console.error(`[PROXY POST /${slugPath}] Error parsing JSON body:`, error, 'URL:', targetUrl);
      return NextResponse.json({ error: 'Invalid JSON body provided', path: `/${slugPath}` }, { status: 400 });
    }
  } else if (request.body && (!contentType || !contentType.includes('application/json'))) {
    // If a body is present but Content-Type is wrong/missing for POST.
    // However, if client sends no body, this check might be too strict if GivEnergy allows bodyless POSTs with just Content-Type header.
    // The key is what Content-Type to *send* to GivEnergy. The docs imply Content-Type: application/json for /commands POST.
    console.warn(`[PROXY POST /${slugPath}] POST request to ${targetUrl} received with body but Content-Type is not 'application/json'. Actual: ${contentType}`);
    // For now, let's proceed but be mindful. The fetch to GivEnergy will set Content-Type: application/json.
  }


  try {
    const apiResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': authToken,
        // Always send Content-Type: application/json for POST to /commands/* endpoints as per GivEnergy docs
        // even if the client-sent body was null (for start/stop charge).
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: requestBody ? JSON.stringify(requestBody) : null,
    });
    return await handleGivEnergyResponse(apiResponse, targetUrl);
  } catch (error: any) {
    console.error(`[PROXY POST /${slugPath}] Exception during processing:`, error);
    if (error.name) console.error(`[PROXY POST /${slugPath}] Error Name: ${error.name}`);
    if (error.message) console.error(`[PROXY POST /${slugPath}] Error Message: ${error.message}`);
    
    const errorMessageDetail = (error.message && (error.message.toLowerCase().startsWith('fetch failed') || error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED'))) ?
      `Proxy POST request failed to connect to target API at ${targetUrl}. Detail: ${error.message}` :
      `Proxy POST request to ${targetUrl} failed due to an unexpected error. Detail: ${error.message}`;
    
    return NextResponse.json({ error: 'Proxy POST request failed', details: errorMessageDetail, path: `/${slugPath}` }, { status: 500 });
  }
}

    
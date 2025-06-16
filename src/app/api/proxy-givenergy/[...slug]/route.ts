
import { type NextRequest, NextResponse } from 'next/server';

const GIVENERGY_API_TARGET_BASE = 'https://api.givenergy.cloud/v1';

// Helper function to handle responses from GivEnergy API
async function handleGivEnergyResponse(apiResponse: Response, targetUrl: string): Promise<NextResponse> {
  if (!apiResponse.ok) {
    let errorPayload: { error?: string; message?: string; details?: any } = {};
    try {
      errorPayload = await apiResponse.json();
    } catch (parseError) {
      // If parsing fails, construct a basic error payload
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
    console.error('Error in GivEnergy GET proxy:', error, 'URL:', targetUrl);
    return NextResponse.json({ error: 'Proxy GET request failed', details: error.message }, { status: 500 });
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

  // GivEnergy POST commands typically expect a JSON body, even if it's just `{"value": ...}` or sometimes empty for simple triggers.
  // We should ensure Content-Type is application/json if a body is present or expected.
  // Some commands might not have a body (e.g. a simple trigger), others require specific JSON.
  // The client-side code is responsible for sending the correct body structure.
  if (contentType && contentType.includes('application/json')) {
    try {
      requestBody = await request.json();
    } catch (error) {
      console.error('Error parsing JSON body for POST request:', error, 'URL:', targetUrl);
      return NextResponse.json({ error: 'Invalid JSON body provided' }, { status: 400 });
    }
  } else if (request.body) {
    // If there's a body but Content-Type isn't JSON, this might be an issue depending on the specific GivEnergy endpoint.
    // For commands, GivEnergy usually expects JSON.
    // We could return 415 Unsupported Media Type, but for now, let's try to forward if body exists
    // Or, if it's a known command that needs JSON, we can be stricter.
    // For now, if a body exists and is not JSON, this might be an error.
    // However, some POSTs might truly be empty. Let's assume client sends correct Content-Type.
    // If content-type is not application/json and there's a body, it's likely problematic.
    // For simplicity, the GivEnergy commands we're proxying usually require JSON, so if content-type is specified and not JSON,
    // it's best to reject. If content-type is NOT specified but a body is sent, it's ambiguous.
    // The client is sending `Content-Type: application/json`, so this path is less likely.
  }


  try {
    const apiResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': authToken,
        'Content-Type': contentType || 'application/json', // Default to application/json if not set
        'Accept': 'application/json',
      },
      body: requestBody ? JSON.stringify(requestBody) : null, // Ensure body is stringified
    });
    return await handleGivEnergyResponse(apiResponse, targetUrl);
  } catch (error: any) {
    console.error('Error in GivEnergy POST proxy:', error, 'URL:', targetUrl);
    return NextResponse.json({ error: 'Proxy POST request failed', details: error.message }, { status: 500 });
  }
}

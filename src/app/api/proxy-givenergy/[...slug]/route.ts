
import { type NextRequest, NextResponse } from 'next/server';

const GIVENERGY_API_TARGET_BASE = 'https://api.givenergy.cloud/v1';

// Helper function to handle responses from GivEnergy API
// This function remains as it's used by the GET handler and was refined.
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
      // If parsing fails but status was ok (e.g. 200 with empty body), treat as success with message
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

// Simplified POST handler for diagnostic purposes
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
): Promise<NextResponse> {
  const slugPath = params.slug.join('/');
  console.log(`Diagnostic POST request received for path: /api/proxy-givenergy/${slugPath}`);
  
  // Immediately return a success response to check if the handler is even reached
  return NextResponse.json({ diagnostic_message: "POST request reached the simplified handler", path: slugPath }, { status: 200 });
}

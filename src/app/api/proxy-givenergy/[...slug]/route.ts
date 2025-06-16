
import { type NextRequest, NextResponse } from 'next/server';

const GIVENERGY_API_TARGET_BASE = 'https://api.givenergy.cloud/v1';

async function handleGivEnergyResponse(apiResponse: Response, targetUrl: string) {
  if (!apiResponse.ok) {
    let errorPayload;
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

  // For successful responses from GivEnergy
  const contentType = apiResponse.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      const successData = await apiResponse.json();
      return NextResponse.json(successData, { status: apiResponse.status });
    } catch (jsonError) {
      console.error('Error parsing JSON from successful GivEnergy response:', jsonError, 'URL:', targetUrl);
      // If JSON parsing fails despite correct content-type, return a success status but indicate parsing issue.
      return NextResponse.json({ success: true, message: 'Command accepted, but response parsing failed.', originalStatus: apiResponse.statusText }, { status: apiResponse.status });
    }
  } else {
    // Handle successful non-JSON responses (e.g., empty body for control commands)
    return NextResponse.json({ success: true, message: 'Command accepted by GivEnergy.', originalStatus: apiResponse.statusText }, { status: apiResponse.status });
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
  const searchParams = requestUrl.search;
  const targetUrl = `${GIVENERGY_API_TARGET_BASE}/${slugPath}${searchParams}`;
  const authToken = request.headers.get('Authorization');

  if (!authToken) {
    return NextResponse.json({ error: 'Authorization header missing' }, { status: 401 });
  }

  let requestBody;
  const contentType = request.headers.get('Content-Type');

  if (contentType && contentType.includes('application/json')) {
    try {
      requestBody = await request.json();
    } catch (error: any) {
      console.error('Error parsing JSON request body for POST proxy:', error, 'URL:', targetUrl);
      return NextResponse.json({ error: 'Invalid JSON in request body.', details: error.message }, { status: 400 });
    }
  } else {
    // GivEnergy control commands typically require a JSON body.
    // If the command doesn't need a body, this is fine. If it does, GivEnergy API will likely error out.
    // For stricter handling, one might return a 400 error here if a body is always expected.
    console.warn(`POST request to ${targetUrl} received without 'application/json' Content-Type or with an empty body. Proceeding, but GivEnergy API might reject if body is required.`);
    requestBody = undefined; // Or attempt to read as text if other content types are possible for some commands
  }

  try {
    const apiResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': authToken,
        'Content-Type': 'application/json', // GivEnergy API generally expects JSON for POST
        'Accept': 'application/json',
      },
      body: requestBody ? JSON.stringify(requestBody) : undefined,
    });
    return await handleGivEnergyResponse(apiResponse, targetUrl);
  } catch (error: any) {
    console.error('Error in GivEnergy POST proxy during fetch or response handling:', error, 'URL:', targetUrl);
    // Use 502 Bad Gateway if the proxy successfully made a request but got an invalid response or network error to upstream
    return NextResponse.json({ error: 'Proxy POST request to GivEnergy failed', details: error.message }, { status: 502 });
  }
}

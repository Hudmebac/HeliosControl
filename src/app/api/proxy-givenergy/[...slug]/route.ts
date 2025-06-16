
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
      // This scenario should be rare.
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
  try {
    // Only attempt to parse body if Content-Type indicates JSON or if it's not explicitly empty
    const contentType = request.headers.get('Content-Type');
    if (contentType && contentType.includes('application/json')) {
        requestBody = await request.json();
    } else {
        // For other content types or no content type, pass undefined or handle as needed.
        // GivEnergy commands often expect JSON, so this path might be less common for typical command payloads.
        // If an empty body is expected, ensure it's handled.
        const textBody = await request.text(); // Check if there's any text body at all
        if (textBody) {
            try {
                requestBody = JSON.parse(textBody); // Attempt to parse if not empty, for flexibility
            } catch (e) {
                 console.warn(`POST request to ${targetUrl} had non-JSON body: ${textBody.substring(0,100)}...`);
                 // If it's not JSON and not empty, it might be an issue or an intended non-JSON payload.
                 // For GivEnergy, typically bodies are JSON. If it was meant to be empty, request.json() would fail.
                 // This path handles cases where content might exist but isn't application/json.
                 // If the intent was an empty body, JSON.stringify(undefined) below results in no body.
            }
        }
    }
  } catch (error) {
    console.error('Error parsing request body for POST proxy:', error, 'URL:', targetUrl);
    // If parsing fails but body might be optional or intended to be empty,
    // requestBody will remain undefined, which is fine for JSON.stringify(undefined)
  }

  try {
    const apiResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': authToken,
        'Content-Type': 'application/json', // GivEnergy API generally expects JSON for POST
        'Accept': 'application/json',
      },
      body: requestBody ? JSON.stringify(requestBody) : undefined, // Send body if it exists
    });
    return await handleGivEnergyResponse(apiResponse, targetUrl);
  } catch (error: any) {
    console.error('Error in GivEnergy POST proxy:', error, 'URL:', targetUrl);
    return NextResponse.json({ error: 'Proxy POST request failed', details: error.message }, { status: 500 });
  }
}

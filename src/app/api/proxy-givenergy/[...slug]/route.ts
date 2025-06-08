
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
    });

    if (!apiResponse.ok) {
      let errorPayload;
      try {
        // Attempt to parse the error body from GivEnergy if it's JSON
        errorPayload = await apiResponse.json();
      } catch (parseError) {
        // If GivEnergy returns a non-JSON error response or empty body
        errorPayload = { 
          error: `GivEnergy API error: ${apiResponse.status} ${apiResponse.statusText}.`,
          details: `Target response status: ${apiResponse.status}. Response body was not valid JSON or was empty.`
        };
      }
      // Ensure the payload is an object, if GivEnergy sent a primitive (e.g. just a string)
      if (typeof errorPayload !== 'object' || errorPayload === null) {
        errorPayload = { error: String(errorPayload) };
      }
      // Add a generic error message if one wasn't parsed or constructed
      if (!errorPayload.error && !errorPayload.message) {
        errorPayload.error = `GivEnergy API request failed with status ${apiResponse.status}.`;
      }
      return NextResponse.json(errorPayload, { status: apiResponse.status });
    }

    // For successful responses from GivEnergy
    const successData = await apiResponse.json();
    return NextResponse.json(successData);

  } catch (error: any) {
    console.error('Error in GivEnergy proxy:', error);
    // This catch is for network errors or unexpected issues in the proxy itself
    return NextResponse.json({ error: 'Proxy request failed', details: error.message }, { status: 500 });
  }
}

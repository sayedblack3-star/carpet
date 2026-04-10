type GeminiProxyRequest = {
  method?: string;
  body?: {
    prompt?: string;
    model?: string;
  };
};

type JsonResponder = {
  json: (body: unknown) => unknown;
};

type GeminiProxyResponse = {
  status: (statusCode: number) => JsonResponder;
};

export default async function handler(req: GeminiProxyRequest, res: GeminiProxyResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured on server' });
  }

  const { prompt, model = 'gemini-2.0-flash' } = req.body ?? {};

  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      },
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      return res.status(geminiRes.status).json({ error: err });
    }

    const data = await geminiRes.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error('Gemini proxy error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

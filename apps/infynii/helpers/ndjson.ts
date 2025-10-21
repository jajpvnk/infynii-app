export async function processNDJSONResponse<T>(
  response: Response,
  onData: (data: T) => void,
  onError: (error: string) => void,
  onComplete: () => void
) {
  if (!response.ok) {
    onError("Failed to process stream response.");
    return;
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = (await reader?.read()) ?? {
        done: true,
        value: null,
      };

      if (done) {
        if (buffer.trim().length) {
          try {
            const finalData = JSON.parse(buffer) as T;
            onData(finalData);
          } catch {}
        }
        onComplete();
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        try {
          const data = JSON.parse(trimmed) as T;
          onData(data);
        } catch {
          // Ignore malformed line; remainder stays in buffer
        }
      }
    }
  } catch (error) {
    onError("Failed to process response, please try again.");
  }
}



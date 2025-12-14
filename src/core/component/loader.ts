import { getCachedComponentSource, setCachedComponentSource } from "./cache";

export async function fetchComponentSource(
  path: string
): Promise<string | undefined> {
  if (!path) {
    throw new Error("Path cannot be null or empty");
  }

  // check cache for component source
  const cachedSource = getCachedComponentSource(path);
  if (cachedSource) return cachedSource;

  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch component from ${path}: ${response.statusText}`
      );
    }

    const text = await response.text();
    setCachedComponentSource(path, text);

    return text;
  } catch (error) {
    console.error(`Error fetching component from ${path}:`, error);
    return undefined;
  }
}

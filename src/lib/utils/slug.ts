export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export function generateUniquePatientId(
  name: string,
  existingIds: Set<string>,
): string {
  const base = slugify(name) || "patient";
  if (!existingIds.has(base)) {
    return base;
  }

  for (let i = 2; i <= 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!existingIds.has(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Unable to generate unique patient ID for name: ${name}`);
}

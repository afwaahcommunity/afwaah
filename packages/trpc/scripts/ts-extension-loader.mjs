const extensions = [".js", ".ts", "/index.js", "/index.ts"];

export async function resolve(specifier, context, defaultResolve) {
  try {
    return await defaultResolve(specifier, context, defaultResolve);
  } catch (error) {
    if (!shouldRetry(specifier, error)) {
      throw error;
    }

    for (const extension of extensions) {
      try {
        return await defaultResolve(
          `${specifier}${extension}`,
          context,
          defaultResolve,
        );
      } catch {
        // Try the next extension.
      }
    }

    throw error;
  }
}

function shouldRetry(specifier, error) {
  if (
    error?.code !== "ERR_MODULE_NOT_FOUND" &&
    error?.code !== "ERR_UNSUPPORTED_DIR_IMPORT"
  ) {
    return false;
  }
  if (specifier.startsWith(".") || specifier.startsWith("/")) return true;
  return specifier.startsWith("@campus-chat/");
}

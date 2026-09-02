/**
 * Node resolution hook for the build-time pipeline.
 *
 * The app's own sources under src/ use extensionless imports, because that is what
 * Metro and Jest expect. Node's native TypeScript support resolves ESM strictly and
 * will not guess an extension, so the tools register this hook and can then import
 * engine code — the validator especially — verbatim rather than re-implementing it.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CANDIDATES = ['.ts', '.tsx', '/index.ts', '/index.tsx', '.js', '.json'];

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
      throw error;
    }
    const base = new URL(specifier, context.parentURL);
    for (const suffix of CANDIDATES) {
      const candidate = new URL(base.href + suffix);
      if (existsSync(fileURLToPath(candidate))) {
        return { url: pathToFileURL(fileURLToPath(candidate)).href, shortCircuit: true };
      }
    }
    throw error;
  }
}

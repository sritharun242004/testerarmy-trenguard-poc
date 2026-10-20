import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

export interface TesterArmyPreflight {
  available: boolean;
  nodeVersion: string;
  requiredNode: string;
  e2eVersion: string | null;
  webEngineVersion: string | null;
  reason: string | null;
}

export async function inspectTesterArmyE2E(projectRoot = process.cwd()): Promise<TesterArmyPreflight> {
  const nodeVersion = process.versions.node;
  const requiredNode = '^22.22.3 || >=24.8.0';
  const e2eVersion = await readPackageVersion(projectRoot, 'e2e');
  const webEngineVersion = await readPackageVersion(projectRoot, '@e2e-dev/web');

  if (!supportsTesterArmyNode(nodeVersion)) {
    return { available: false, nodeVersion, requiredNode, e2eVersion, webEngineVersion, reason: `Node ${nodeVersion} is below the supported TesterArmy floor ${requiredNode}.` };
  }
  if (e2eVersion !== '0.21.2' || webEngineVersion !== '0.15.2') {
    return { available: false, nodeVersion, requiredNode, e2eVersion, webEngineVersion, reason: 'Pinned e2e@0.21.2 and @e2e-dev/web@0.15.2 are not both installed.' };
  }
  return { available: true, nodeVersion, requiredNode, e2eVersion, webEngineVersion, reason: null };
}

export async function runTesterArmyPreflight(projectRoot = process.cwd()): Promise<TesterArmyPreflight> {
  return inspectTesterArmyE2E(projectRoot);
}

async function readPackageVersion(projectRoot: string, packageName: string): Promise<string | null> {
  const packagePath = path.join(projectRoot, 'node_modules', packageName, 'package.json');
  try {
    await access(packagePath);
    const parsed: unknown = JSON.parse(await readFile(packagePath, 'utf8'));
    return parsed && typeof parsed === 'object' && 'version' in parsed && typeof parsed.version === 'string' ? parsed.version : null;
  } catch {
    return null;
  }
}

function supportsTesterArmyNode(version: string): boolean {
  const [major = 0, minor = 0, patch = 0] = version.split('.').map(Number);
  return major > 24 || (major === 24 && minor >= 8) || (major === 22 && (minor > 22 || (minor === 22 && patch >= 3)));
}

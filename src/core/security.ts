import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export type SecurityScope = 'read' | 'write' | 'admin';

export interface SecretRecord {
  name: string;
  value: string;
  version: number;
  rotated_at: string;
}

const SECRET_ENV = Object.fromEntries([
  ['anthropic_api_key', ['ANTHROPIC', 'API', 'KEY'].join('_')],
  ['openai_api_key', ['OPENAI', 'API', 'KEY'].join('_')],
  ['gbrain_auth_token', ['GBRAIN', 'AUTH', 'TOKEN'].join('_')],
  ['receipt_signature_key', ['RECEIPT', 'SIGNATURE', 'KEY'].join('_')],
  ['gorchestrator_auth_secret', ['GORCHESTRATOR', 'AUTH', 'SECRET'].join('_')],
  ['gorchestrator_mcp_token', ['GORCHESTRATOR', 'MCP', 'TOKEN'].join('_')],
  ['health_shutdown_token', ['GORCHESTRATOR', 'HEALTH', 'SHUTDOWN', 'TOKEN'].join('_')],
]) as Record<string, string>;

export class FileSecretManager {
  constructor(private rootDir = process.env.GORCHESTRATOR_SECRET_DIR || path.join(os.homedir(), '.gorchestrator', 'secrets')) {}

  get(name: string): string | undefined {
    const normalized = normalizeSecretName(name);
    const record = this.readRecord(normalized);
    if (record?.value) return record.value;
    const envName = SECRET_ENV[normalized];
    return envName ? process.env[envName] : undefined;
  }

  rotate(name: string, value?: string): SecretRecord {
    const normalized = normalizeSecretName(name);
    const previous = this.readRecord(normalized);
    const next: SecretRecord = {
      name: normalized,
      value: value || crypto.randomBytes(32).toString('base64url'),
      version: (previous?.version ?? 0) + 1,
      rotated_at: new Date().toISOString(),
    };
    fs.mkdirSync(this.rootDir, { recursive: true });
    fs.writeFileSync(this.recordPath(normalized), JSON.stringify(next, null, 2), { encoding: 'utf8', mode: 0o600 });
    return next;
  }

  list(): Array<Omit<SecretRecord, 'value'> & { source: 'file' | 'env' }> {
    const records = new Map<string, Omit<SecretRecord, 'value'> & { source: 'file' | 'env' }>();
    if (fs.existsSync(this.rootDir)) {
      for (const file of fs.readdirSync(this.rootDir)) {
        if (!file.endsWith('.json')) continue;
        const record = this.readRecord(path.basename(file, '.json'));
        if (record) {
          records.set(record.name, {
            name: record.name,
            version: record.version,
            rotated_at: record.rotated_at,
            source: 'file',
          });
        }
      }
    }
    for (const [name, envName] of Object.entries(SECRET_ENV)) {
      if (!records.has(name) && process.env[envName]) {
        records.set(name, {
          name,
          version: 0,
          rotated_at: 'env',
          source: 'env',
        });
      }
    }
    return [...records.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  pathFor(name: string): string {
    return this.recordPath(normalizeSecretName(name));
  }

  private readRecord(name: string): SecretRecord | undefined {
    const normalized = normalizeSecretName(name);
    try {
      const parsed = JSON.parse(fs.readFileSync(this.recordPath(normalized), 'utf8')) as SecretRecord;
      return parsed.name === normalized && typeof parsed.value === 'string' ? parsed : undefined;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
  }

  private recordPath(name: string): string {
    return path.join(this.rootDir, `${name}.json`);
  }
}

export class PermissionModel {
  constructor(private tokenScopes = new Map<string, SecurityScope[]>()) {}

  static loadDefault(): PermissionModel {
    const file = process.env.GORCHESTRATOR_PERMISSIONS_FILE;
    if (!file || !fs.existsSync(file)) return new PermissionModel();
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { tokens?: Record<string, SecurityScope[]> };
    return new PermissionModel(new Map(Object.entries(parsed.tokens ?? {})));
  }

  scopesForToken(token: string, fallback: SecurityScope[]): SecurityScope[] {
    const grant = this.tokenScopes.get(hashToken(token));
    if (!grant) return fallback;
    return fallback.filter(scope => grant.includes(scope));
  }
}

export function getDefaultSecretManager(): FileSecretManager {
  return new FileSecretManager();
}

export function normalizeSecretName(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  if (!/^[a-z][a-z0-9_]{2,63}$/.test(normalized)) {
    throw new Error(`Invalid secret name: ${name}`);
  }
  return normalized;
}

export function sanitizeCliString(value: unknown, field: string, maxLength = 10000): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  if (value.includes('\0')) throw new Error(`${field} contains invalid NUL byte`);
  if (value.length > maxLength) throw new Error(`${field} is too long (max ${maxLength} characters)`);
  if (/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)) {
    throw new Error(`${field} contains invalid control characters`);
  }
  return value;
}

export function sanitizeCliPath(value: unknown, field: string): string {
  const text = sanitizeCliString(value, field, 2048);
  if (/[<>|?*]/.test(text)) throw new Error(`${field} contains invalid path characters`);
  return text;
}

export function sanitizeCliInteger(value: unknown, field: string, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${field} must be between ${min} and ${max}`);
  }
  return parsed;
}

export function sanitizeCliUrl(value: unknown, field: string): string {
  const text = sanitizeCliString(value, field, 2048);
  const url = new URL(text);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${field} must be an http(s) URL`);
  }
  return url.toString().replace(/\/$/, '');
}

/**
 * Sanitize Docker image name to prevent malicious image references
 * Format: [registry/]repository[:tag]
 * Examples: node:20-alpine, ghcr.io/user/repo:latest
 */
export function sanitizeDockerImage(value: unknown, field: string): string {
  const text = sanitizeCliString(value, field, 512);
  // Docker image name regex (simplified but effective)
  // Allows: registry domains, repository names with slashes, tags with alphanumerics and common separators
  const imageRegex = /^[a-z0-9]+([._-][a-z0-9]+)*(\/[a-z0-9]+([._-][a-z0-9]+)*)*(:[a-z0-9]+([._-][a-z0-9]+)*)?$/i;
  if (!imageRegex.test(text)) {
    throw new Error(`${field} is not a valid Docker image name`);
  }
  // Prevent shell metacharacters
  if (/[\s;&|`$()<>]/.test(text)) {
    throw new Error(`${field} contains invalid characters`);
  }
  return text;
}

/**
 * Sanitize domain name for allowlist
 * Format: domain.tld or subdomain.domain.tld
 */
export function sanitizeDomainName(value: unknown, field: string): string {
  const text = sanitizeCliString(value, field, 253);
  // Domain name regex (RFC 1035 compliant)
  const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
  if (!domainRegex.test(text)) {
    throw new Error(`${field} is not a valid domain name`);
  }
  return text.toLowerCase();
}

/**
 * Sanitize container name (should be lowercase alphanumeric with hyphens)
 */
export function sanitizeContainerName(value: unknown, field: string): string {
  const text = sanitizeCliString(value, field, 128);
  // Container name regex (Docker naming rules)
  const nameRegex = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/;
  if (!nameRegex.test(text)) {
    throw new Error(`${field} is not a valid container name`);
  }
  return text;
}

/**
 * Sanitize resource limit value (CPU cores, memory, disk, time)
 */
export function sanitizeResourceLimit(value: unknown, field: string, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${field} must be between ${min} and ${max}`);
  }
  return parsed;
}

/**
 * Sanitize file path to prevent directory traversal attacks
 * Resolves the path to its absolute form and ensures it stays within allowed directories
 */
export function sanitizeFilePath(inputPath: unknown, field: string, allowedBaseDir?: string): string {
  const text = sanitizeCliString(inputPath, field, 4096);

  // Prevent null bytes
  if (text.includes('\0')) {
    throw new Error(`${field} contains invalid null byte`);
  }

  // Prevent obvious path traversal attempts
  if (text.includes('..') || text.includes('~')) {
    throw new Error(`${field} contains path traversal sequences`);
  }

  // Resolve to absolute path
  const resolved = path.resolve(text);

  // If a base directory is specified, ensure the resolved path is within it
  if (allowedBaseDir) {
    const resolvedBase = path.resolve(allowedBaseDir);
    const relative = path.relative(resolvedBase, resolved);

    // If the relative path starts with '..', it's outside the base directory
    if (relative.startsWith('..')) {
      throw new Error(`${field} is outside allowed directory`);
    }
  }

  return resolved;
}

/**
 * Sanitize file path for read operations (less restrictive than write)
 */
export function sanitizeReadPath(inputPath: unknown, field: string, allowedBaseDir?: string): string {
  return sanitizeFilePath(inputPath, field, allowedBaseDir);
}

/**
 * Sanitize file path for write operations (more restrictive)
 * Prevents overwriting sensitive files
 */
export function sanitizeWritePath(inputPath: unknown, field: string, allowedBaseDir: string): string {
  const resolved = sanitizeFilePath(inputPath, field, allowedBaseDir);

  // Additional safety checks for write operations
  const filename = path.basename(resolved);

  // Prevent writing to hidden files (starting with .)
  if (filename.startsWith('.')) {
    throw new Error(`${field} cannot write to hidden files`);
  }

  // Prevent writing to sensitive file extensions
  const sensitiveExtensions = ['.env', '.key', '.pem', '.p12', '.pfx', '.der', '.crt', '.cer'];
  const ext = path.extname(filename).toLowerCase();
  if (sensitiveExtensions.includes(ext)) {
    throw new Error(`${field} cannot write to files with extension ${ext}`);
  }

  return resolved;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const KEY_LENGTH = 32;
const IV_LENGTH = 12;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const MASTER_KEY_B64 = Deno.env.get('ENCRYPTION_MASTER_KEY');
const PROFESSIONAL_KEYS_TABLE = Deno.env.get('SUPABASE_TABLE_PROFESSIONAL_KEYS') ?? 'professional_keys';

if (!SUPABASE_URL) {
  throw new Error('SUPABASE_URL no está configurado.');
}

if (!SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY no está configurado.');
}

if (!MASTER_KEY_B64) {
  throw new Error('ENCRYPTION_MASTER_KEY no está configurado para las funciones Edge.');
}

const AUTH_HEADER_VALUE = `Bearer ${SERVICE_ROLE_KEY}`;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function encodeBase64(bytes: Uint8Array | ArrayBuffer): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let index = 0; index < view.length; index += 1) {
    binary += String.fromCharCode(view[index]);
  }
  return btoa(binary);
}

const masterKeyBytes = decodeBase64(MASTER_KEY_B64.trim());
if (masterKeyBytes.length !== KEY_LENGTH) {
  throw new Error('ENCRYPTION_MASTER_KEY debe contener 32 bytes codificados en base64.');
}

const masterKeyPromise = crypto.subtle.importKey('raw', masterKeyBytes, 'AES-GCM', false, ['encrypt', 'decrypt']);

const serviceClient: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export class UnauthorizedError extends Error {
  status = 401;

  constructor(message = 'No autorizado') {
    super(message);
  }
}

export interface ProfessionalKeyRow {
  professional_id: string;
  encrypted_key: string;
  key_iv: string;
  version: number;
  rotated_at: string;
  created_at: string;
  updated_at: string;
}

export interface ProfessionalKeyMetadata {
  professionalId: string;
  version: number;
  rotatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfessionalKeyResult {
  key: Uint8Array;
  metadata: ProfessionalKeyMetadata;
}

function toMetadata(row: ProfessionalKeyRow): ProfessionalKeyMetadata {
  return {
    professionalId: row.professional_id,
    version: row.version,
    rotatedAt: row.rotated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function requireServiceAuth(request: Request) {
  const header = request.headers.get('authorization');
  if (!header || header !== AUTH_HEADER_VALUE) {
    throw new UnauthorizedError();
  }
}

async function getMasterKey() {
  return masterKeyPromise;
}

async function encryptWithMasterKey(plaintext: Uint8Array) {
  const masterKey = await getMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, masterKey, plaintext);
  return {
    ciphertext: encodeBase64(encrypted),
    iv: encodeBase64(iv),
  };
}

async function decryptWithMasterKey(ciphertext: string, iv: string) {
  const masterKey = await getMasterKey();
  const encryptedBytes = decodeBase64(ciphertext);
  const ivBytes = decodeBase64(iv);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, masterKey, encryptedBytes);
  return new Uint8Array(decrypted);
}

async function fetchProfessionalKeyRow(professionalId: string): Promise<ProfessionalKeyRow | null> {
  const { data, error } = await serviceClient
    .from<ProfessionalKeyRow>(PROFESSIONAL_KEYS_TABLE)
    .select('professional_id, encrypted_key, key_iv, version, rotated_at, created_at, updated_at')
    .eq('professional_id', professionalId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function insertProfessionalKeyRow(professionalId: string, encrypted: { ciphertext: string; iv: string }) {
  const { data, error } = await serviceClient
    .from<ProfessionalKeyRow>(PROFESSIONAL_KEYS_TABLE)
    .insert({
      professional_id: professionalId,
      encrypted_key: encrypted.ciphertext,
      key_iv: encrypted.iv,
      version: 1,
    })
    .select('professional_id, encrypted_key, key_iv, version, rotated_at, created_at, updated_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function updateProfessionalKeyRow(
  professionalId: string,
  encrypted: { ciphertext: string; iv: string },
  version: number,
) {
  const { data, error } = await serviceClient
    .from<ProfessionalKeyRow>(PROFESSIONAL_KEYS_TABLE)
    .update({
      encrypted_key: encrypted.ciphertext,
      key_iv: encrypted.iv,
      version,
      rotated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('professional_id', professionalId)
    .select('professional_id, encrypted_key, key_iv, version, rotated_at, created_at, updated_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function ensureProfessionalKey(professionalId: string): Promise<ProfessionalKeyResult> {
  let row = await fetchProfessionalKeyRow(professionalId);
  let keyBytes: Uint8Array;

  if (!row) {
    const generated = crypto.getRandomValues(new Uint8Array(KEY_LENGTH));
    const encrypted = await encryptWithMasterKey(generated);
    row = await insertProfessionalKeyRow(professionalId, encrypted);
    keyBytes = generated;
  } else {
    const decrypted = await decryptWithMasterKey(row.encrypted_key, row.key_iv);
    if (decrypted.length !== KEY_LENGTH) {
      throw new Error('La clave almacenada tiene un tamaño inválido.');
    }
    keyBytes = decrypted;
  }

  return { key: keyBytes, metadata: toMetadata(row) };
}

export async function rotateProfessionalKey(professionalId: string): Promise<ProfessionalKeyMetadata> {
  const { metadata } = await ensureProfessionalKey(professionalId);
  const generated = crypto.getRandomValues(new Uint8Array(KEY_LENGTH));
  const encrypted = await encryptWithMasterKey(generated);
  const nextVersion = metadata.version + 1;
  const row = await updateProfessionalKeyRow(professionalId, encrypted, nextVersion);
  return toMetadata(row);
}

export async function encryptPayloadWithProfessionalKey(key: Uint8Array, payload: unknown) {
  const professionalKey = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const serialized =
    typeof payload === 'string' ? textEncoder.encode(payload) : textEncoder.encode(JSON.stringify(payload ?? null));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, professionalKey, serialized);
  return {
    ciphertext: encodeBase64(encrypted),
    iv: encodeBase64(iv),
  };
}

export async function decryptPayloadWithProfessionalKey<T = unknown>(
  key: Uint8Array,
  ciphertext: string,
  iv: string,
): Promise<T> {
  const professionalKey = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt', 'decrypt']);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decodeBase64(iv) },
    professionalKey,
    decodeBase64(ciphertext),
  );
  const text = textDecoder.decode(decrypted);
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

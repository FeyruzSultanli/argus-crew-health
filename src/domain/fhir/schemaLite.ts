// A tiny JSON-schema-like shape validator (doc 06 §5: "validate shape in tests with a minimal JSON schema, no
// external validator"). Supports the handful of keywords the FHIR export needs. Pure TypeScript.

export type Schema =
  | { type: 'string'; pattern?: RegExp; enum?: readonly string[]; const?: string }
  | { type: 'number' | 'integer'; min?: number; max?: number }
  | { type: 'boolean'; const?: boolean }
  | { type: 'array'; items?: Schema; minItems?: number; maxItems?: number }
  | { type: 'object'; required?: readonly string[]; properties?: Record<string, Schema> }
  | { anyOf: readonly Schema[] };

/** Returns a list of "path: problem" strings; empty = valid. */
export function validateShape(value: unknown, schema: Schema, path = '$'): string[] {
  if ('anyOf' in schema) {
    const results = schema.anyOf.map((s) => validateShape(value, s, path));
    return results.some((r) => r.length === 0) ? [] : [`${path}: matches none of ${schema.anyOf.length} shapes`];
  }
  switch (schema.type) {
    case 'string': {
      if (typeof value !== 'string') return [`${path}: expected string`];
      const errs: string[] = [];
      if (schema.const !== undefined && value !== schema.const) errs.push(`${path}: expected "${schema.const}"`);
      if (schema.enum && !schema.enum.includes(value)) errs.push(`${path}: "${value}" not in enum`);
      if (schema.pattern && !schema.pattern.test(value)) errs.push(`${path}: "${value}" does not match pattern`);
      return errs;
    }
    case 'number':
    case 'integer': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return [`${path}: expected number`];
      if (schema.type === 'integer' && !Number.isInteger(value)) return [`${path}: expected integer`];
      if (schema.min !== undefined && value < schema.min) return [`${path}: below ${schema.min}`];
      if (schema.max !== undefined && value > schema.max) return [`${path}: above ${schema.max}`];
      return [];
    }
    case 'boolean':
      if (typeof value !== 'boolean') return [`${path}: expected boolean`];
      return schema.const !== undefined && value !== schema.const ? [`${path}: expected ${schema.const}`] : [];
    case 'array': {
      if (!Array.isArray(value)) return [`${path}: expected array`];
      const errs: string[] = [];
      if (schema.minItems !== undefined && value.length < schema.minItems) errs.push(`${path}: fewer than ${schema.minItems} items`);
      if (schema.maxItems !== undefined && value.length > schema.maxItems) errs.push(`${path}: more than ${schema.maxItems} items`);
      const items = schema.items;
      if (items) value.forEach((v: unknown, i) => errs.push(...validateShape(v, items, `${path}[${i}]`)));
      return errs;
    }
    case 'object': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return [`${path}: expected object`];
      const obj = value as Record<string, unknown>;
      const errs: string[] = [];
      for (const k of schema.required ?? []) if (!(k in obj)) errs.push(`${path}.${k}: required`);
      for (const [k, s] of Object.entries(schema.properties ?? {})) {
        if (k in obj && obj[k] !== undefined) errs.push(...validateShape(obj[k], s, `${path}.${k}`));
      }
      return errs;
    }
  }
}

const str: Schema = { type: 'string' };
const FHIR_ID: Schema = { type: 'string', pattern: /^[A-Za-z0-9\-.]{1,64}$/ };
const ISO: Schema = { type: 'string', pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/ };
const coding: Schema = { type: 'object', required: ['system', 'code'], properties: { system: str, code: str, display: str } };
const concept: Schema = { type: 'object', properties: { coding: { type: 'array', items: coding }, text: str } };
const codedConcept: Schema = {
  type: 'object',
  required: ['coding'],
  properties: { coding: { type: 'array', items: coding, minItems: 1 }, text: str },
};
const quantity: Schema = {
  type: 'object',
  required: ['value', 'unit', 'system', 'code'],
  properties: {
    value: { type: 'number' },
    unit: str,
    system: { type: 'string', const: 'http://unitsofmeasure.org' },
    code: str,
  },
};
const extension: Schema = {
  type: 'object',
  required: ['url'],
  properties: { url: { type: 'string', pattern: /^https?:\/\// } },
};

export const PATIENT_SCHEMA: Schema = {
  type: 'object',
  required: ['resourceType', 'id', 'name', 'meta', 'extension'],
  properties: {
    resourceType: { type: 'string', const: 'Patient' },
    id: FHIR_ID,
    name: { type: 'array', minItems: 1, items: { type: 'object', required: ['text'], properties: { text: str } } },
    gender: { type: 'string', enum: ['female', 'male', 'other', 'unknown'] },
    extension: { type: 'array', minItems: 1, items: extension },
  },
};

export const OBSERVATION_SCHEMA: Schema = {
  type: 'object',
  required: ['resourceType', 'id', 'status', 'code', 'effectiveDateTime', 'extension'],
  properties: {
    resourceType: { type: 'string', const: 'Observation' },
    id: FHIR_ID,
    status: { type: 'string', enum: ['registered', 'preliminary', 'final', 'amended'] },
    code: codedConcept,
    subject: { type: 'object', required: ['reference'], properties: { reference: { type: 'string', pattern: /^Patient\/[A-Za-z0-9\-.]{1,64}$/ } } },
    effectiveDateTime: ISO,
    valueQuantity: quantity,
    component: {
      type: 'array',
      minItems: 1,
      items: { type: 'object', required: ['code', 'valueQuantity'], properties: { code: codedConcept, valueQuantity: quantity } },
    },
    method: concept,
    interpretation: { type: 'array', items: codedConcept },
    extension: { type: 'array', minItems: 1, items: extension },
  },
};

export const BUNDLE_SCHEMA: Schema = {
  type: 'object',
  required: ['resourceType', 'type', 'entry', 'timestamp'],
  properties: {
    resourceType: { type: 'string', const: 'Bundle' },
    type: { type: 'string', const: 'collection' },
    id: FHIR_ID,
    timestamp: ISO,
    entry: {
      type: 'array',
      items: {
        type: 'object',
        required: ['fullUrl', 'resource'],
        properties: { fullUrl: { type: 'string', pattern: /^https?:\/\// }, resource: { anyOf: [PATIENT_SCHEMA, OBSERVATION_SCHEMA] } },
      },
    },
  },
};

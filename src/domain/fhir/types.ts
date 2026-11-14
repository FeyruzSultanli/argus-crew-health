// Minimal FHIR R4 shapes used by the export (doc 06 §5). Only the elements ARGUS writes. Pure TypeScript.

export interface FhirCoding {
  system: string;
  code: string;
  display?: string;
}

export interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

export interface FhirQuantity {
  value: number;
  unit: string;
  system: string;
  code: string;
}

export interface FhirExtension {
  url: string;
  valueString?: string;
  valueCode?: string;
  valueBoolean?: boolean;
  valueDecimal?: number;
  valueInteger?: number;
  extension?: FhirExtension[];
}

export interface FhirMeta {
  lastUpdated?: string;
  tag?: FhirCoding[];
}

export interface FhirReference {
  reference?: string;
  display?: string;
}

export interface FhirPatient {
  resourceType: 'Patient';
  id: string;
  meta: FhirMeta;
  extension: FhirExtension[];
  active: boolean;
  name: Array<{ use: 'anonymous'; text: string }>;
  gender: 'female' | 'male';
}

export interface FhirObservationComponent {
  code: FhirCodeableConcept;
  valueQuantity: FhirQuantity;
}

export interface FhirObservation {
  resourceType: 'Observation';
  id: string;
  meta: FhirMeta;
  identifier: Array<{ system: string; value: string }>;
  status: 'final';
  code: FhirCodeableConcept;
  subject?: FhirReference;
  effectiveDateTime: string;
  valueQuantity?: FhirQuantity;
  component?: FhirObservationComponent[];
  method?: FhirCodeableConcept;
  device?: FhirReference;
  interpretation?: FhirCodeableConcept[];
  note?: Array<{ text: string }>;
  extension: FhirExtension[];
}

export type FhirResource = FhirPatient | FhirObservation;

export interface FhirBundleEntry<R extends FhirResource = FhirResource> {
  fullUrl: string;
  resource: R;
}

export interface FhirBundle {
  resourceType: 'Bundle';
  id: string;
  meta: FhirMeta;
  type: 'collection';
  timestamp: string;
  entry: FhirBundleEntry[];
}

// Raised for caller mistakes: bad JSON, missing fields, unsupported values.
// The HTTP layer maps these to 400; anything else becomes a 500.
export class SourceValidationError extends Error {}

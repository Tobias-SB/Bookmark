// src/features/metadata/index.ts
// Public API for the metadata feature.
// All inter-feature imports must go through this file.

export type { ImportedMetadata, MetadataResult } from './services/types';
export { searchGoogleBooks } from './services/googleBooksService';
export { fetchAo3Metadata } from './services/ao3Parser';
export type { UseImportMetadataResult } from './hooks/useImportMetadata';
export { useImportMetadata } from './hooks/useImportMetadata';

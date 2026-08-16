// Backwards-compatible facade over the source registry.
//
// The registry (registry.mjs) is now the single source of truth for source
// metadata and adapter wiring. This module keeps the historical named exports
// (SOURCE_DEFINITIONS, parseRssItems, provinceFromText, fetchGoogleNews,
// fetchDataGoTh) working for the orchestration pipeline and self-tests.

import { parseRssItems, provinceFromText, SOURCE_REGISTRY, buildSourceDefinitions } from './registry.mjs';

export { parseRssItems, provinceFromText };

export const SOURCE_DEFINITIONS = buildSourceDefinitions();

export const fetchGoogleNews = SOURCE_REGISTRY.find((source) => source.id === 'google-news-th').fetch;
export const fetchDataGoTh = SOURCE_REGISTRY.find((source) => source.id === 'data.go.th').fetch;

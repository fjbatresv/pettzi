# utils-dynamo

This library was generated with [Nx](https://nx.dev).

## Building

Run `nx build utils-dynamo` to build the library.

## Running unit tests

Run `nx test utils-dynamo` to execute the unit tests via [Jest](https://jestjs.io).

# @pettzi/utils-dynamo

## Purpose
Shared HTTP response helpers and Dynamo key utilities for Lambdas.

## Responsibilities
- Standard API responses (ok, badRequest, unauthorized, serverError, etc.)
- Low-level key helpers for Dynamo single-table patterns

## Key deps
- Minimal; exported for all API libs

## Tests
- `npx nx test utils-dynamo`

## Docs
- Docs: see `docs/reference/content/` for API usage and shared error-shape references

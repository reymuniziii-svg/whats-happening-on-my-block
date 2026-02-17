# Add a Dataset Module

This project uses a config-driven module pattern so the frontend can stay dumb and render one shared `ModuleCard` shape.

## Steps

1. Create a new module adapter in `src/lib/modules/<module-name>.ts`.
2. Implement the `ModuleBuilder` contract:
   - export `const <name>Module: ModuleBuilder = { id: "<module_id>", build: async (context) => Module }`
3. Use `moduleSources([...datasetIds])` and `moduleSkeleton(...)` from `src/lib/modules/helpers.ts`.
4. Add robust failure handling:
   - wrap fetch logic in `try/catch`
   - on failure return `unavailableModule(...)`
5. Register the module in `src/lib/brief/build-brief.ts`:
   - add import
   - add to `BUILDERS`
   - add ID to order in `src/config/modules.ts` if needed.
6. Ensure every module includes:
   - `headline`
   - 2-4 `stats`
   - up to 12 `items`
   - clear `methodology`
   - `sources` with dataset links
   - optional `warnings`/`coverage_note` when using fallback geometry

## Cache and query requirements

- Use `memoryCache.getOrSet(...)` for dataset calls.
- Include `$select`, `$where`, and `$limit` for all SODA requests.
- Keep row fetches tight and do server-side aggregation whenever possible.

## Testing

- Add at least one unit/integration test for module-specific ranking or parsing logic.
- Verify module renders gracefully during dataset failure.

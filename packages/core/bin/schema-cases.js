const { pathToFileURL } = require('node:url');

const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function projectModule(name, fail) {
  try {
    return require.resolve(name, { paths: [process.cwd()] });
  } catch (error) {
    if (
      error.code !== 'MODULE_NOT_FOUND' &&
      error.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED'
    )
      throw error;
    fail(
      'SCHEMA_GENERATORS_REQUIRED',
      'Install @xstate/test, Effect 4, and fast-check 4 in the working project to generate schema cases.',
      { missing: name }
    );
  }
}

async function generateCases(machine, schemas, options, fail) {
  if (!isRecord(options.generate)) {
    fail('INVALID_GENERATION', 'generate must be an object.');
  }
  const { seed = 0, samplesPerEvent = 3 } = options.generate;
  if (
    !Number.isInteger(seed) ||
    seed < -2147483648 ||
    seed > 2147483647 ||
    !Number.isInteger(samplesPerEvent) ||
    samplesPerEvent < 1 ||
    samplesPerEvent > 100
  ) {
    fail(
      'INVALID_GENERATION',
      'seed must be a signed 32-bit integer and samplesPerEvent must be between 1 and 100.'
    );
  }
  const manual = options.events === undefined ? {} : options.events;
  if (!isRecord(manual)) {
    fail(
      'INVALID_GENERATION',
      'Use an event case map to override generated cases, or omit generate to use an event array.'
    );
  }

  if (schemas?.events !== undefined && !isRecord(schemas.events)) {
    fail('SCHEMA_GENERATION_FAILED', 'Expected an event schema map.', {
      path: 'schemas.events'
    });
  }

  const { sample, constant, jsonValue } = require(
    projectModule('fast-check', fail)
  );
  const [generators, Schema, JsonSchema, Representation] = await Promise.all(
    [
      '@xstate/test/effect-schema',
      'effect/Schema',
      'effect/JsonSchema',
      'effect/SchemaRepresentation'
    ].map((name) => import(pathToFileURL(projectModule(name, fail)).href))
  );
  const isJson = Schema.is(Schema.Json);
  const override = (ast) => {
    if (
      ast._tag === 'Declaration' &&
      ast.annotations?.representation?.id === 'effect/schema/Json'
    ) {
      return jsonValue();
    }
    if (
      ast._tag === 'Objects' &&
      ast.propertySignatures.length === 0 &&
      ast.indexSignatures.length > 0 &&
      ast.indexSignatures.every((index) => index.type._tag === 'Never')
    ) {
      return constant({});
    }
  };

  function schemaArbitrary(schema, path) {
    if (!isRecord(schema)) {
      fail('SCHEMA_GENERATION_FAILED', 'Expected a JSON Schema object.', {
        path
      });
    }
    try {
      const document = schema.$schema?.endsWith('2020-12/schema')
        ? JsonSchema.fromSchemaDraft2020_12(schema)
        : JsonSchema.fromSchemaDraft07(schema);
      const runtimeSchema = Representation.fromJsonSchemaDocument(document);
      const isValid = Schema.is(runtimeSchema);
      return generators
        .fromEffectSchema(runtimeSchema, { override })
        .map((value) => {
          if (!isValid(value)) {
            throw new Error(
              'A generated value failed validation against the imported schema.'
            );
          }
          return value;
        });
    } catch (error) {
      fail('SCHEMA_GENERATION_FAILED', error.message, { path });
    }
  }

  function samples(arbitrary, count, path) {
    try {
      const values = sample(arbitrary, { seed, numRuns: count }).filter(isJson);
      if (values.length === 0)
        throw new Error('No JSON values were generated.');
      return Array.from(
        new Map(values.map((value) => [JSON.stringify(value), value])).values()
      );
    } catch (error) {
      fail('SCHEMA_GENERATION_FAILED', error.message, { path });
    }
  }

  const usesSchema = (type) =>
    !Object.hasOwn(manual, type) &&
    !type.startsWith('xstate.') &&
    !type.startsWith('@xstate.');
  const eventSchemas = Object.fromEntries(
    Object.entries(schemas?.events ?? {}).filter(([type]) => usesSchema(type))
  );
  // The existing generator reads the event descriptors and the schema map.
  const arbitraries = generators.eventsFromSchemas(
    {
      events: machine.events.filter(usesSchema),
      schemas: { events: eventSchemas }
    },
    {
      eventsWithoutSchema: 'skip',
      fallback: (schema, type) =>
        isRecord(schema) && Object.keys(schema).length === 0
          ? constant({})
          : schemaArbitrary(schema, `schemas.events.${type}`)
    }
  );
  const generated = Object.fromEntries(
    Object.entries(arbitraries).map(([type, arbitrary]) => [
      type,
      samples(arbitrary, samplesPerEvent, `schemas.events.${type}`)
    ])
  );
  const inputGenerated =
    options.input === undefined && schemas?.input !== undefined;
  let input = options.input;
  if (inputGenerated) {
    const path = 'schemas.input';
    [input] = samples(schemaArbitrary(schemas.input, path), 1, path);
  }
  return {
    events: { ...generated, ...manual },
    input,
    generation: {
      seed,
      samplesPerEvent,
      eventTypes: Object.keys(generated),
      inputGenerated
    }
  };
}

module.exports = generateCases;

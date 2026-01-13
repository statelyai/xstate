/**
 * Codemod to convert .send({ type: 'eventName', ...props }) to
 * .trigger.eventName({ ...props })
 *
 * Transforms:
 *
 * - Store.send({ type: 'inc' }) → store.trigger.inc()
 * - Store.send({ type: 'inc', by: 1 }) → store.trigger.inc({ by: 1 })
 * - ActorRef.send({ type: 'update', value: 5 }) → actorRef.trigger.update({
 *   value: 5 })
 *
 * Usage: jscodeshift -t scripts/convert-send-to-trigger.js
 * packages/xstate-store/test
 *
 * To preview changes without modifying files: jscodeshift -t
 * scripts/convert-send-to-trigger.js --dry packages/xstate-store/test
 *
 * The codemod automatically handles TypeScript and JSX syntax (including
 * Solid.js).
 */

module.exports = function transformer(fileInfo, api, options) {
  const j = api.jscodeshift.withParser('tsx');
  const root = j(fileInfo.source);

  // Find all .send() calls
  root
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        property: {
          name: 'send'
        }
      }
    })
    .forEach((path) => {
      const callExpression = path.value;
      const args = callExpression.arguments;

      // Only process if there's exactly one argument that's an object expression
      if (args.length !== 1 || args[0].type !== 'ObjectExpression') {
        return;
      }

      const objectExpression = args[0];
      const properties = objectExpression.properties;

      // Find the 'type' property
      let typeProperty = null;
      const otherProperties = [];

      for (const prop of properties) {
        // Handle ObjectProperty (key: value) and ObjectMethod (key() { ... })
        if (prop.type === 'ObjectProperty') {
          // Check if key is 'type' (handles both identifier and string literal keys)
          let keyName = null;
          if (prop.key.type === 'Identifier') {
            keyName = prop.key.name;
          } else if (prop.key.type === 'StringLiteral') {
            keyName = prop.key.value;
          }

          if (keyName === 'type') {
            typeProperty = prop;
          } else {
            otherProperties.push(prop);
          }
        } else {
          // Keep other property types (spread, methods, etc.)
          otherProperties.push(prop);
        }
      }

      // Only transform if we found a 'type' property with a string literal value
      // We skip if type is a variable or computed value since we can't determine it statically
      if (!typeProperty || typeProperty.value.type !== 'StringLiteral') {
        return;
      }

      const eventType = typeProperty.value.value;
      const callee = callExpression.callee;

      // Validate event type is a valid identifier
      // Event types should be valid JavaScript identifiers
      if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(eventType)) {
        return;
      }

      // Build the new call: object.trigger.eventType(...)
      let triggerCall;

      if (otherProperties.length === 0) {
        // No payload: object.trigger.eventType()
        triggerCall = j.callExpression(
          j.memberExpression(
            j.memberExpression(callee.object, j.identifier('trigger')),
            j.identifier(eventType)
          ),
          []
        );
      } else {
        // With payload: object.trigger.eventType({ ...otherProperties })
        triggerCall = j.callExpression(
          j.memberExpression(
            j.memberExpression(callee.object, j.identifier('trigger')),
            j.identifier(eventType)
          ),
          [j.objectExpression(otherProperties)]
        );
      }

      // Replace the original call
      j(path).replaceWith(triggerCall);
    });

  return root.toSource({
    quote: 'single',
    trailingComma: true,
    lineTerminator: '\n'
  });
};

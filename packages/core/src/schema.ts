export function createSchema<T>(schema?: any): T {
  return schema as T;
}
export const t = createSchema;

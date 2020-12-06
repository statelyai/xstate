export function createSchema<TSchema>(value?: any): TSchema {
  return (value as any) as TSchema;
}

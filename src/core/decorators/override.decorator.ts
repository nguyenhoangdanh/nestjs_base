// src/core/decorators/override.decorator.ts
export function Override() {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    // This is just a marker decorator to indicate that a method is overriding a base method
    return descriptor;
  };
}

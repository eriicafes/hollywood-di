import type { Constructor, Factory, Token } from "./container";

export type TokenOptions<T> = {
  lazy?: boolean;
  beforeInit?: () => void;
  afterInit?: (instance: T) => void;
};

/**
 * Creates a constructor token as `singleton`. The same instance will be shared between the container and all children containers.
 * @param constructor class constructor
 * @param options configure token options
 */
export function singleton<T, TContainer>(
  constructor: Constructor<T, TContainer>,
  options?: TokenOptions<T>
): Token<T, TContainer> {
  return { scope: "singleton", options, target: constructor };
}

/**
 * Creates a factory token as `singleton`. The same instance will be shared between the container and all children containers.
 * @param factoryFn factory function
 * @param options configure token options
 */
export function singletonFactory<T, TContainer>(
  factoryFn: Factory<T, TContainer>["init"],
  options?: TokenOptions<T>
): Token<T, TContainer> {
  return { scope: "singleton", options, target: { init: factoryFn } };
}

/**
 * Creates a constructor token as `scoped`. A unique instance will always be created for each container.
 * @param constructor class constructor
 * @param options configure token options
 */
export function scoped<T, TContainer>(
  constructor: Constructor<T, TContainer>,
  options?: TokenOptions<T>
): Token<T, TContainer> {
  return { scope: "scoped", options, target: constructor };
}

/**
 * Creates a factory token as `scoped`. A unique instance will always be created for each container.
 * @param factoryFn factory function
 * @param options configure token options
 */
export function scopedFactory<T, TContainer>(
  factoryFn: Factory<T, TContainer>["init"],
  options?: TokenOptions<T>
): Token<T, TContainer> {
  return { scope: "scoped", options, target: { init: factoryFn } };
}

export const factory = scopedFactory;

/**
 * Creates a constructor token as `transient`. A new instance will always be created everytime it is accessed from the container.
 * @param constructor class constructor
 * @param options configure token options
 */
export function transient<T, TContainer>(
  constructor: Constructor<T, TContainer>,
  options?: Omit<TokenOptions<T>, "lazy">
): Token<T, TContainer> {
  return { scope: "transient", options, target: constructor };
}

/**
 * Creates a factory token as `transient`. A new instance will always be created everytime it is accessed from the container.
 * @param factoryFn factory function
 * @param options configure token options
 */
export function transientFactory<T, TContainer>(
  factoryFn: Factory<T, TContainer>["init"],
  options?: Omit<TokenOptions<T>, "lazy">
): Token<T, TContainer> {
  return { scope: "transient", options, target: { init: factoryFn } };
}

type Alias<TContainer> = {
  /**
   * Token to alias.
   * @param token token name
   */
  to<K extends keyof TContainer>(token: K): Token<TContainer[K], TContainer>;
};

/**
 * Aliases a token in an `inferred` container.
 * An inferred container does not have a finalized shape yet therefore a generic type argument is required.
 *
 * An alias is simply a factory that returns another token.
 *
 * @example
 * const container1 = Hollywood.create({
 *     counter: Counter,
 *     counterAlias: alias<{ counter: Counter }>().to("counter"),
 * })
 */
export function alias<TContainer>(): Alias<TContainer>;
/**
 * Aliases a token in a `typed` container.
 *
 * An alias is simply a factory that returns another token.
 *
 * @example
 * const container1 = Hollywood.create<{ counter: Counter, counterAlias: Counter }>({
 *     counter: Counter,
 *     counterAlias: alias("counter"),
 * })
 *
 * @param token token name
 */
export function alias<TContainer, K extends keyof TContainer>(
  token: K
): Token<TContainer[K], TContainer>;
export function alias<TContainer, K extends keyof TContainer>(
  token?: K
): Alias<TContainer> | Token<TContainer[K], TContainer> {
  if (token !== undefined) {
    return {
      scope: "transient",
      target: { init: (container) => container[token] },
    };
  } else {
    return {
      to(token) {
        return {
          scope: "transient",
          target: { init: (container) => container[token] },
        };
      },
    };
  }
}

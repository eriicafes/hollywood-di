import { scoped, scopedFactory, TokenOptions } from "./tokens";
import { HasIndexSignature, KnownMappedKeys, Merge, Pretty } from "./types";

export type Constructor<T, TContainer> = new (container: TContainer) => T;
export type Factory<T, TContainer> = { init: (container: TContainer) => T };
export type Target<T, TContainer> =
  | Constructor<T, TContainer>
  | Factory<T, TContainer>;

type Scope = "singleton" | "scoped" | "transient";
type ContainerOptions = {
  lazy?: boolean;
};

// tokens
export type Token<T, TContainer> = {
  scope: Scope;
  options?: TokenOptions<T>;
  target: Target<T, TContainer>;
};
type RegisterToken<T, TContainer> =
  | Token<T, TContainer>
  | Target<T, TContainer>;
type RegisterTokens<
  TContainer extends Record<string, any>,
  PContainer extends Record<string, any>
> = {
  [K in keyof TContainer]: Merge<TContainer, PContainer> extends infer U
    ? RegisterToken<
        TContainer[K],
        HasIndexSignature<U> extends true
          ? TContainer extends never
            ? PContainer
            : Pretty<Record<string, any> & Omit<KnownMappedKeys<U>, K>>
          : Pretty<Omit<KnownMappedKeys<U>, K>>
      >
    : never;
};

// resolver
type ResolveTarget<TContainer extends Record<string, any>> =
  | (keyof KnownMappedKeys<TContainer> & string)
  | Target<any, TContainer>;
type InferInstanceFromTarget<
  TContainer extends Record<string, any>,
  R extends ResolveTarget<TContainer>
> = R extends Factory<infer T, infer _>
  ? T
  : R extends Constructor<infer T, infer _>
  ? T
  : R extends keyof TContainer
  ? TContainer[R]
  : never;

// infer
export type InferContainer<T extends AnyHollywood> = T extends Hollywood<
  infer TContainer,
  infer PContainer
>
  ? Merge<TContainer, PContainer>
  : never;

/**
 * Any container.
 */
export type AnyHollywood = Hollywood<any, any>;
/**
 * Any container that can resolve T.
 */
export type HollywoodOf<T extends Record<string, any>> = Hollywood<T, any>;

export class Hollywood<
  T extends Record<string, any>,
  P extends Record<string, any>
> {
  private readonly options?: ContainerOptions;
  private readonly root: AnyHollywood;
  private readonly parent?: AnyHollywood;
  private readonly singletonStore?: Map<`${string}@${number}`, any>;
  private readonly instanceStore = new Map<string, any>();
  private readonly tokenStore = new Map<string, Token<any, any>>();
  private readonly targetNameStore = new Map<Target<any, any>, string>();
  private readonly resolutionChain: string[] = [];
  private readonly id: number;
  private lastId = 0; // last issued id is tracked by the root container

  public readonly instances: Merge<T, P> = new Proxy({} as Merge<T, P>, {
    get: (_, prop) => {
      return this.resolve(prop as ResolveTarget<Merge<T, P>>);
    },
    ownKeys: () => {
      const tokens = this.getAllTokens();
      return [...tokens];
    },
    getOwnPropertyDescriptor: () => {
      return {
        enumerable: true,
        configurable: true,
      };
    },
  });

  private constructor(
    tokens: RegisterTokens<T, P>,
    parent: Hollywood<P, any> | undefined,
    options?: ContainerOptions
  ) {
    this.options = options;
    // set container parent and root
    if (parent) {
      this.parent = parent;
      this.root = parent.root;
    } else {
      this.root = this;
      this.singletonStore = new Map();
    }

    // set container id to lastId and increment for next call, this sets the root container id to 0
    this.id = this.root.lastId++;

    // register tokens
    for (const [name, registerToken] of Object.entries(tokens) as [
      string,
      RegisterToken<any, Merge<T, P>>
    ][]) {
      // if target is provided, register as scoped token
      let token: Token<any, Merge<T, P>>;
      if ("init" in registerToken) {
        token = scopedFactory(registerToken.init);
      } else if (typeof registerToken === "function") {
        token = scoped(registerToken);
      } else {
        token = registerToken;
      }

      this.tokenStore.set(name, token);

      // tag non-transient tokens
      if (token.scope !== "transient")
        this.targetNameStore.set(token.target, name);
    }

    // eagerly store token instances by resolving them once
    for (const [name, token] of this.tokenStore.entries()) {
      if (
        token.scope !== "transient" &&
        !(token.options?.lazy ?? this.options?.lazy)
      )
        this.resolve(name as ResolveTarget<Merge<T, P>>);
    }
  }

  /**
   * Create root container.
   * @param tokens register tokens.
   */
  public static create<T extends Record<string, any> = {}>(
    tokens: RegisterTokens<T, {}>,
    options?: ContainerOptions
  ): Hollywood<T, {}> {
    return new Hollywood(tokens, undefined, options);
  }

  /**
   * Create child container from a parent container.
   * @param parent parent container.
   * @param tokens register tokens.
   */
  public static createWithParent<
    T extends Record<string, any> = {},
    P extends AnyHollywood = AnyHollywood
  >(
    parent: P,
    tokens: RegisterTokens<T, InferContainer<P>>,
    options?: ContainerOptions
  ): Hollywood<T, InferContainer<P>> {
    return new Hollywood(tokens, parent, options ?? parent.options);
  }

  /**
   * Create child container.
   *
   * Child container will be able to resolve all tokens it's parent container can resolve.
   * @param tokens register tokens.
   */
  public createChild<TContainer extends Record<string, any> = {}>(
    tokens: RegisterTokens<TContainer, InferContainer<this>>,
    options?: ContainerOptions
  ): Hollywood<TContainer, InferContainer<this>> {
    return Hollywood.createWithParent(this, tokens, options);
  }

  /**
   * Resolve target by name, class constructor or factory.
   *
   * `scoped`: A unique instance scoped to the resolving container will be returned when resolving a scoped token.
   *
   * `singleton`: A single shared instance will be returned when resolving a singleton token.
   *
   * `transient`: A new instance will be returned everytime when resolving a transient token (even in the same container).
   *
   * When creating an instance, if the token was not registered directly on this container it will use it's parent container to create the new instance.
   */
  public resolve<TTarget extends ResolveTarget<Merge<T, P>>>(
    target: TTarget
  ): InferInstanceFromTarget<Merge<T, P>, TTarget> {
    try {
      // resolve factory or constructor
      if (typeof target !== "string") {
        // resolve target instance with name if reference exists in this container
        let name: string | undefined = undefined;
        // get name from target
        name = this.targetNameStore.get(target);
        if (name) return this.resolve(name as TTarget);
        // else create new instance without storing
        return Hollywood.init(target, this.instances);
      }

      // get stored instance in resolving container
      const storedInstance = this.instanceStore.get(target);
      if (storedInstance) return storedInstance;
      // check for existence to cover situations where the stored instance is actually falsy
      if (this.instanceStore.has(target)) return storedInstance;

      // check for circular dependency error
      if (this.resolutionChain.includes(target)) {
        throw new ResolutionError("CircularDependency", target);
      }
      this.resolutionChain.push(target); // add to resolution chain

      // get new token instance
      const [instance, scope] = this.getTokenInstance(
        target as Extract<TTarget, string>
      );
      // store scoped instances in the resolving container
      if (scope === "scoped") this.instanceStore.set(target, instance);

      this.resolutionChain.pop(); // remove from resolution chain only after getting instance
      return instance;
    } catch (err) {
      if (err instanceof ResolutionError) {
        if (err.reason === "CircularDependency") {
          throw new Error(
            `Circular dependency '${
              err.dependency
            }' found while resolving ${this.resolutionChain
              .reverse()
              .join(" => ")}`
          );
        }
        if (err.reason === "UnregisteredToken") {
          throw new Error(
            `Unresolved dependency '${err.dependency}', did you register this token in this container or in a parent container?`
          );
        }
      }
      throw err;
    }
  }

  // This finds the token by name in the current container or a parent container. After finding the token
  // it creates a new instance at the container that has the token to prevent using wrong values to instantiate the token target.
  // For example when tokens are overriden in child containers to resolve to entirely different values.
  private getTokenInstance<K extends keyof Merge<T, P> & string>(
    name: K
  ): [any, Scope] {
    const token = this.tokenStore.get(name);
    if (!token) {
      // check in parent container
      if (this.parent) return this.parent.getTokenInstance(name);
      throw new ResolutionError("UnregisteredToken", name);
    }

    // if token is singleton check for instance in root container, create new instance if it does not exist
    // store singletons with their container depth so that singletons of same token name do not override those from other containers
    if (token.scope === "singleton") {
      const exists = this.root.singletonStore?.has(`${name}@${this.id}`);
      if (!exists) {
        token.options?.beforeInit?.();
        const instance = Hollywood.init(token.target, this.instances);
        token.options?.afterInit?.(instance);
        this.root.singletonStore?.set(`${name}@${this.id}`, instance);
      }
      return [this.root.singletonStore?.get(`${name}@${this.id}`), token.scope];
    }

    token.options?.beforeInit?.();
    const instance = Hollywood.init(token.target, this.instances);
    token.options?.afterInit?.(instance);
    return [instance, token.scope];
  }

  private getAllTokens(acc?: Set<string>): Set<string> {
    const keys = new Set([...(acc ?? []), ...this.tokenStore.keys()]);
    if (!this.parent) return keys;
    return this.parent.getAllTokens(keys);
  }

  /**
   * Instantiate a token or constructor.
   */
  public static init<TContainer, T>(
    target: Target<T, TContainer>,
    instances: TContainer
  ): T {
    // checking for init method first ensures init static method will be used for classes if present
    if ("init" in target) return target.init(instances);
    return new target(instances);
  }
}

class ResolutionError extends Error {
  constructor(
    public reason: "CircularDependency" | "UnregisteredToken",
    public dependency: string
  ) {
    super();
  }
}

type InitFn<TContainer, T> = (container: TContainer) => T
type Constructor<T> = new (...args: any[]) => T
type NArguments<N extends number> = readonly string[] & { length: N }
type InitFnBuilder<T extends Constructor<any>> = {
    args<Args extends NArguments<ConstructorParameters<T>["length"]>>(...args: Args): InitFn<
        { [K in Exclude<keyof Args, keyof any[]> as Args[K] & string]: K extends keyof ConstructorParameters<T> ? ConstructorParameters<T>[K] : never },
        InstanceType<T>
    >
}

/**
 * Define `init` function for a class.
 * 
 * Maps each constructor parameter to a token from the DI Container.
 */
export function defineInit<T extends Constructor<any>>(constructor: T): InitFnBuilder<T> {
    return {
        args(...args) {
            return (container) => {
                const resolvedArgs = Object.values(args).map((arg: typeof args[number]) => {
                    return container[arg]
                })
                return new constructor(...resolvedArgs)
            }
        },
    }
}

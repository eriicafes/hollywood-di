type Constructor<T> = new (...args: any[]) => T
type NArguments<N extends number> = readonly string[] & { length: N }
type InitFnBuilder<T extends Constructor<any>> = {
    args<Args extends NArguments<ConstructorParameters<T>["length"]>>(...args: Args): (container: {
        [K in Exclude<keyof Args, keyof any[]> as Args[K] & string]: K extends keyof ConstructorParameters<T> ? ConstructorParameters<T>[K] : never
    }) => InstanceType<T>
}

/**
 * Define `init` function for a class by mapping each constructor parameter to a token from the container.
 * 
 * @example
 * class Service {
 *     public static init = defineInit(Service).args("dep")
 * 
 *     constructor(dep: Dep) {}
 * }
 * 
 * // equivalent to
 * class Service {
 *     public static init(container: { dep: Dep }) {
 *         return new Service(container.dep)
 *     }
 * 
 *     constructor(dep: Dep) {}
 * }
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

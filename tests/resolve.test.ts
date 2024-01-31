import { describe, expect, it } from "vitest"
import { alias, factory, Hollywood } from "../src"

describe("Resolve", () => {
    class Counter {
        public count = 0
        public increment() {
            this.count++
        }
    }

    it("should register and resolve factory with same instance", () => {
        const counter = factory(() => {
            return new Counter()
        })

        const container = Hollywood.create({
            counter,
        })

        const stringResolvedCounter = container.resolve("counter")
        const factoryResolvedCounter = container.resolve(counter)
        const similarFactoryResolvedCounter = container.resolve(factory(() => {
            return new Counter()
        }))

        expect(stringResolvedCounter).toBe(factoryResolvedCounter)
        expect(stringResolvedCounter).not.toBe(similarFactoryResolvedCounter)
        expect(factoryResolvedCounter).not.toBe(similarFactoryResolvedCounter)
    })

    it("should resolve alias with same instance", () => {
        const typedContainer = Hollywood.create<{ counter: Counter, counter2: Counter, counterAlias: Counter }>({
            counter: factory(() => new Counter()),
            counter2: Counter,
            counterAlias: alias("counter"),
        })

        const tCounter = typedContainer.resolve("counter")
        const tCounterAlias = typedContainer.resolve("counterAlias")
        expect(tCounter).toBe(tCounterAlias)

        const inferredContainer = Hollywood.create({
            counter: factory(() => new Counter()),
            counter2: Counter,
            counterAlias: alias<{ counter: Counter }>().to("counter"),
        })
        const iCounter = inferredContainer.resolve("counter")
        const iCounterAlias = inferredContainer.resolve("counterAlias")
        expect(iCounter).toBe(iCounterAlias)
    })

    it("should resolve token or constructor", () => {
        const item = factory(() => ({ value: "🎁" } as const))

        const parent = Hollywood.create({
            // item: item,
            counter: Counter,
            other: factory(() => "other")
        })

        const child = parent.createChild({
            item: factory(() => ({ value: "🗑️" } as const)),
            counter: factory(() => "counter"),
            another: factory(() => "another")
        })

        const parentItem = parent.resolve(item)
        const childItem = child.resolve(item)
        expect(childItem).toStrictEqual(parentItem)
        expect(childItem).not.toBe(parentItem)
        expect(childItem).not.toStrictEqual(child.instances.item)

        const parentCounter = parent.resolve(Counter)
        const childCounter = child.resolve(Counter)
        expect(childCounter).toStrictEqual(parentCounter)
        expect(childCounter).not.toBe(parentCounter)
    })
})

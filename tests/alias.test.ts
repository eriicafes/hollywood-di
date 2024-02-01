import { describe, expect, it } from "vitest"
import { alias, factory, Hollywood } from "../src"

describe("Alias", () => {
    class Counter {
        public count = 0
        public increment() {
            this.count++
        }
    }

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

    it("should create new instance for an alias to a parent token", () => {
        const container1 = Hollywood.create({
            counter: factory(() => new Counter()),
        })
        const container2 = container1.createChild({
            counterAlias: alias<{ counter: Counter }>().to("counter"),
        })
        const counter1 = container1.resolve("counter")
        const counter2 = container2.resolve("counter")
        const counterAlias = container2.resolve("counterAlias")
        expect(counterAlias).toStrictEqual(counter1)
        expect(counterAlias).not.toBe(counter1)
        expect(counterAlias).toBe(counter2)
    })
})

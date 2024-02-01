import { describe, expect, it, test, vi } from "vitest"
import { defineInit, factory, Hollywood, singletonFactory } from "../src"

describe("Container", () => {
    class Counter {
        public count = 0
        public increment() {
            this.count++
        }
    }

    class ForwardCounter {
        public counter: Counter
        constructor(counter: Counter) {
            this.counter = counter
        }

        public static init(container: { counter: Counter }) {
            return new ForwardCounter(container.counter)
        }
    }

    const container = Hollywood.create({
        counter: Counter,
        forwardCounter: ForwardCounter
    })

    it("should resolve instance from container", () => {
        const counter = container.resolve("counter")
        expect(counter.count).toBe(0)

        counter.increment()
        expect(counter.count).toBe(1)
    })

    it("should reuse same instance for injected dependencies", () => {
        const forwardCounter = container.resolve(ForwardCounter)
        const counter = container.resolve("counter")

        expect(forwardCounter.counter).toBe(counter)
    })

    test("child container should contain all registered tokens in parent containers", () => {
        const parent = Hollywood.create({
            parentItem: factory(() => "parentItem")
        })
        const child = parent.createChild({
            childItem: factory(() => "childItem")
        })
        expect(Object.keys(child.instances)).toEqual(expect.arrayContaining(["parentItem", "childItem"]))
        const grandChild = child.createChild({
            grandChildItem: factory(() => "grandChildItem")
        })
        expect(Object.keys(grandChild.instances)).toEqual(expect.arrayContaining(["parentItem", "childItem", "grandChildItem"]))
    })
})

describe("Init", () => {
    const container = Hollywood.create({
        dep1: factory(() => "dep1"),
    })

    it("should init empty constructor", () => {
        class ExampleEmpty {
            constructor() { }
        }
        const example = container.resolve(ExampleEmpty)
        expect(example).toBeInstanceOf(ExampleEmpty)
    })

    it("should init constructor with registered tokens", () => {
        class ExampleRegistered {
            constructor(public dep: string) { }

            public static init({ dep1 }: { dep1: string }) {
                return new ExampleRegistered(dep1)
            }
        }
        const example = container.resolve(ExampleRegistered)
        expect(example).toBeInstanceOf(ExampleRegistered)
    })

    it("should init with defineInit", () => {
        class ExampleRegistered {
            constructor(public dep: string) { }

            public static init = defineInit(ExampleRegistered).args("dep1")
        }
        const example = container.resolve(ExampleRegistered)
        expect(example).toBeInstanceOf(ExampleRegistered)
    })

    it("should fail to init constructor with unregistered tokens", () => {
        class ExampleRegistered {
            constructor(public dep: string) { }

            public static init({ dep2 }: { dep2: string }) {
                return new ExampleRegistered(dep2)
            }
        }
        // @ts-expect-error
        expect(() => container.resolve(ExampleRegistered)).toThrowError("Unresolved dependency")
    })

    it("should call init hooks in order", () => {
        const mockBeforeInit = vi.fn<[], void>()
        const mockAfterInit = vi.fn<[], void>().mockImplementation(() => {
            expect(mockBeforeInit).toBeCalledTimes(1)
        })
        const container = Hollywood.create({
            mockInitDep: factory(() => "mockInitDep", { lazy: true, beforeInit: mockBeforeInit, afterInit: mockAfterInit }),
        })

        expect(mockBeforeInit).toBeCalledTimes(0)
        expect(mockAfterInit).toBeCalledTimes(0)
        container.resolve("mockInitDep")
        expect(mockBeforeInit).toBeCalledTimes(1)
        expect(mockAfterInit).toBeCalledTimes(1)
    })

    it("should call singleton init hooks only once", () => {
        const mockBeforeInit = vi.fn<[], void>()
        const mockAfterInit = vi.fn<[], void>()
        const parent = Hollywood.create({
            mockInitDep: singletonFactory(() => "mockInitDep", { lazy: true, beforeInit: mockBeforeInit, afterInit: mockAfterInit }),
        })
        const child = parent.createChild({})
        expect(mockBeforeInit).toBeCalledTimes(0)
        expect(mockAfterInit).toBeCalledTimes(0)
        parent.resolve("mockInitDep")
        expect(mockBeforeInit).toBeCalledTimes(1)
        expect(mockAfterInit).toBeCalledTimes(1)
        child.resolve("mockInitDep")
        expect(mockBeforeInit).toBeCalledTimes(1)
        expect(mockAfterInit).toBeCalledTimes(1)
    })
})
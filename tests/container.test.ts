import { describe, expect, it, test, vi } from "vitest";
import { factory, Hollywood, singletonFactory } from "../src";

describe("Container", () => {
  class Counter {
    public count = 0;
    public increment() {
      this.count++;
    }
  }

  class ForwardCounter {
    constructor(public ctx: { counter: Counter }) {}
  }

  const container = Hollywood.create({
    counter: Counter,
    forwardCounter: ForwardCounter,
  });

  it("should resolve instance from container", () => {
    const counter = container.resolve("counter");
    expect(counter.count).toBe(0);

    counter.increment();
    expect(counter.count).toBe(1);
  });

  it("should reuse same instance for injected dependencies", () => {
    const forwardCounter = container.resolve(ForwardCounter);
    const counter = container.resolve("counter");

    expect(forwardCounter.ctx.counter).toBe(counter);
  });

  test("child container should contain all registered tokens in parent containers", () => {
    const parent = Hollywood.create({
      parentItem: factory(() => "parentItem"),
    });
    const child = parent.createChild({
      childItem: factory(() => "childItem"),
    });
    expect(Object.keys(child.instances)).toEqual(
      expect.arrayContaining(["parentItem", "childItem"])
    );
    const grandChild = child.createChild({
      grandChildItem: factory(() => "grandChildItem"),
    });
    expect(Object.keys(grandChild.instances)).toEqual(
      expect.arrayContaining(["parentItem", "childItem", "grandChildItem"])
    );
  });
});

describe("Init", () => {
  const container = Hollywood.create({
    dep1: factory(() => "dep1"),
  });

  it("should init empty constructor", () => {
    class ExampleEmpty {
      constructor() {}
    }
    const example = container.resolve(ExampleEmpty);
    expect(example).toBeInstanceOf(ExampleEmpty);
  });

  it("should init constructor with registered tokens", () => {
    class ExampleInit {
      constructor(public dep: string) {}

      public static init({ dep1 }: { dep1: string }) {
        return new ExampleInit(dep1);
      }
    }
    const example = container.resolve(ExampleInit);
    expect(example).toBeInstanceOf(ExampleInit);
  });

  it("should use static init method over constructor", () => {
    class ExampleInit {
      constructor(public dep: string) {}

      public static init() {
        return "example";
      }
    }
    const example = container.resolve(ExampleInit);
    expect(example).toBe("example");
  });

  it("should fail to init constructor with unregistered tokens", () => {
    class ExampleInit {
      constructor(public dep: string) {}

      public static init({ dep2 }: { dep2: string }) {
        return new ExampleInit(dep2);
      }
    }
    // @ts-expect-error
    expect(() => container.resolve(ExampleInit)).toThrowError(
      "Unresolved dependency"
    );
  });

  it("should call init hooks in order", () => {
    const mockBeforeInit = vi.fn();
    const mockAfterInit = vi.fn(() => {
      expect(mockBeforeInit).toBeCalledTimes(1);
    });
    const container = Hollywood.create({
      mockInitDep: factory(() => "mockInitDep", {
        lazy: true,
        beforeInit: mockBeforeInit,
        afterInit: mockAfterInit,
      }),
    });

    expect(mockBeforeInit).toBeCalledTimes(0);
    expect(mockAfterInit).toBeCalledTimes(0);
    container.resolve("mockInitDep");
    expect(mockBeforeInit).toBeCalledTimes(1);
    expect(mockAfterInit).toBeCalledTimes(1);
  });

  it("should call singleton init hooks only once", () => {
    const mockBeforeInit = vi.fn();
    const mockAfterInit = vi.fn();
    const parent = Hollywood.create({
      mockInitDep: singletonFactory(() => "mockInitDep", {
        lazy: true,
        beforeInit: mockBeforeInit,
        afterInit: mockAfterInit,
      }),
    });
    const child = parent.createChild({});
    expect(mockBeforeInit).toBeCalledTimes(0);
    expect(mockAfterInit).toBeCalledTimes(0);
    parent.resolve("mockInitDep");
    expect(mockBeforeInit).toBeCalledTimes(1);
    expect(mockAfterInit).toBeCalledTimes(1);
    child.resolve("mockInitDep");
    expect(mockBeforeInit).toBeCalledTimes(1);
    expect(mockAfterInit).toBeCalledTimes(1);
  });
});

describe("Resolve", () => {
  class Counter {
    public count = 0;
    public increment() {
      this.count++;
    }
  }

  it("should register and resolve factory with same instance", () => {
    const counter = factory(() => {
      return new Counter();
    });

    const container = Hollywood.create({
      counter,
    });

    const stringResolvedCounter = container.resolve("counter");
    const factoryResolvedCounter = container.resolve(counter.target);
    const similarFactoryResolvedCounter = container.resolve(
      factory(() => {
        return new Counter();
      }).target
    );

    expect(stringResolvedCounter).toBe(factoryResolvedCounter);
    expect(stringResolvedCounter).not.toBe(similarFactoryResolvedCounter);
    expect(factoryResolvedCounter).not.toBe(similarFactoryResolvedCounter);
  });

  it("should resolve token or constructor", () => {
    const item = factory(() => ({ value: "🎁" } as const));

    const parent = Hollywood.create({
      item: item,
      counter: Counter,
      other: factory(() => "other"),
    });

    const child = parent.createChild({
      item: factory(() => ({ value: "🗑️" } as const)),
      counter: factory(() => "counter"),
      another: factory(() => "another"),
    });

    const parentItem = parent.resolve(item.target);
    const childItem = child.resolve(item.target);
    expect(childItem).toStrictEqual(parentItem);
    expect(childItem).not.toBe(parentItem);
    expect(childItem).not.toStrictEqual(child.instances.item);

    const parentCounter = parent.resolve(Counter);
    const childCounter = child.resolve(Counter);
    expect(childCounter).toStrictEqual(parentCounter);
    expect(childCounter).not.toBe(parentCounter);
  });
});

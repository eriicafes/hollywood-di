import { describe, expect, test } from "vitest";
import {
  factory,
  Hollywood,
  scoped,
  singleton,
  singletonFactory,
  transient,
  transientFactory,
} from "../src";

describe("Scope", () => {
  class Instance {}

  test("default class constructor scope is 'scoped'", () => {
    const container = Hollywood.create({
      instance: Instance,
    });

    const instance1 = container.resolve("instance");
    const instance2 = container.resolve("instance");

    expect(instance1).toBe(instance2);
  });

  test("'scoped' scope should reuse same instance per container", () => {
    const parent = Hollywood.create({
      classInstance: scoped(Instance),
      factoryInstance: factory(() => new Instance()),
    });
    const child = parent.createChild({});
    const grandChild = child.createChild({});

    const parentClassInstance = parent.resolve("classInstance");
    const parentFactoryInstance = parent.resolve("factoryInstance");

    const childClassInstance1 = child.resolve("classInstance");
    const childFactoryInstance1 = child.resolve("factoryInstance");
    expect(childClassInstance1).not.toBe(parentClassInstance);
    expect(childFactoryInstance1).not.toBe(parentFactoryInstance);

    const childClassInstance2 = child.resolve("classInstance");
    const childFactoryInstance2 = child.resolve("factoryInstance");
    expect(childClassInstance2).toBe(childClassInstance1);
    expect(childFactoryInstance2).toBe(childFactoryInstance1);

    const grandChChildClassInstance1 = grandChild.resolve("classInstance");
    const grandChildFactoryInstance1 = grandChild.resolve("factoryInstance");
    expect(grandChChildClassInstance1).not.toBe(childClassInstance1);
    expect(grandChildFactoryInstance1).not.toBe(childClassInstance1);

    const grandChChildClassInstance2 = grandChild.resolve("classInstance");
    const grandChildFactoryInstance2 = grandChild.resolve("factoryInstance");
    expect(grandChChildClassInstance2).toBe(grandChChildClassInstance1);
    expect(grandChildFactoryInstance2).toBe(grandChildFactoryInstance1);
  });

  test("'singleton' scope should reuse same instance for all children containers", () => {
    const parent = Hollywood.create({
      classInstance: singleton(Instance),
      factoryInstance: singletonFactory(() => new Instance()),
    });
    const child = parent.createChild({});
    const grandChild = child.createChild({});

    const parentClassInstance = parent.resolve("classInstance");
    const parentFactoryInstance = parent.resolve("factoryInstance");

    const childClassInstance = child.resolve("classInstance");
    const childFactoryInstance = child.resolve("factoryInstance");
    expect(childClassInstance).toBe(parentClassInstance);
    expect(childFactoryInstance).toBe(parentFactoryInstance);

    const grandChChildClassInstance = grandChild.resolve("classInstance");
    const grandChildFactoryInstance = grandChild.resolve("factoryInstance");
    expect(grandChChildClassInstance).toBe(parentClassInstance);
    expect(grandChildFactoryInstance).toBe(parentFactoryInstance);
  });

  test("'transient' scope should create new instance everytime it is accessed", () => {
    const parent = Hollywood.create({
      classInstance: transient(Instance),
      factoryInstance: transientFactory(() => new Instance()),
    });
    const child = parent.createChild({});
    const grandChild = child.createChild({});

    const parentClassInstance = parent.resolve("classInstance");
    const parentFactoryInstance = parent.resolve("factoryInstance");

    const childClassInstance1 = child.resolve("classInstance");
    const childFactoryInstance1 = child.resolve("factoryInstance");
    expect(childClassInstance1).not.toBe(parentClassInstance);
    expect(childFactoryInstance1).not.toBe(parentFactoryInstance);

    const childClassInstance2 = child.resolve("classInstance");
    const childFactoryInstance2 = child.resolve("factoryInstance");
    expect(childClassInstance2).not.toBe(childClassInstance1);
    expect(childFactoryInstance2).not.toBe(childFactoryInstance1);

    const grandChChildClassInstance1 = grandChild.resolve("classInstance");
    const grandChildFactoryInstance1 = grandChild.resolve("factoryInstance");
    expect(grandChChildClassInstance1).not.toBe(childClassInstance1);
    expect(grandChildFactoryInstance1).not.toBe(childClassInstance1);

    const grandChChildClassInstance2 = grandChild.resolve("classInstance");
    const grandChildFactoryInstance2 = grandChild.resolve("factoryInstance");
    expect(grandChChildClassInstance2).not.toBe(grandChChildClassInstance1);
    expect(grandChildFactoryInstance2).not.toBe(grandChildFactoryInstance1);
  });
});

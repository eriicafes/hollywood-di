## Hollywood DI

## Example

Below is an example of a JWT based auth flow in a web application.

NOTE: this is not actual application code, just an exmaple to showcase how the DI Container works.

entities.ts

```ts
interface User {
  id: string;
  username: string;
  password: string;
}
```

interfaces.ts

```ts
interface IJWTService {
  sign(payload: Record<string, string>): Promise<string>;
  verify(token: string): Promise<Record<string, string>>;
}

interface IDatabaseService {
  create<T>(table: string, query: Record<string, string>): Promise<T>;
  findOne<T>(table: string, query: Record<string, string>): Promise<T>;
  findMany<T>(table: string, query: Record<string, string>): Promise<T[]>;
}

interface IUserService {
  findById(id: string): Promise<User>;
  findByUsername(username: string): Promise<User>;
  create(data: Partial<User>): Promise<User>;
}
```

In the snippet below, the UserService implementation depends on a IDatabaseService while the AuthService depends on both an IUserService and IJWTService.
Each of their init function correctly specifies then name of the dependency and the container automatically instantiates them.

NOTE: You would have typescript errors if your container fails to provide all required dependencies.

```ts
import { defineInit, Hollywood } from "hollywood-di";
import { IDatabaseService, IUserService, IJWTService } from "./interfaces";

class JWTService implements IJWTService {
  /** */
}

class DatabaseService implements IDatabaseService {
  /** */
}

class UserService implements IUserService {
  public static init = defineInit(UserService).args("databaseService");

  constructor(private db: IDatabaseService) {}

  create(data: Partial<User>): Promise<User> {
    return this.db.create("users", data);
  }
  findById(id: string): Promise<User> {
    return this.db.findOne("users", { id });
  }
  findByUsername(username: string): Promise<User> {
    return this.db.findOne("users", { username });
  }
}

class AuthService {
  public static init = defineInit(AuthService).args(
    "userService",
    "jwtService"
  );

  constructor(
    private userService: IUserService,
    private jwtService: IJWTService
  ) {}

  public async register(data: Partial<User>) {
    const user = await this.userService.create(data);

    const token = await this.jwtService.sign({ jit: user.id });
    return { token, user };
  }

  public async login(username: string, password: string) {
    const user = await this.userService.findByUsername(username);
    if (!user || user.password !== password)
      throw new Error("Invalid username or password");

    const token = await this.jwtService.sign({ jit: user.id });
    return { token };
  }

  public async authenticate(token: string) {
    const payload = await this.jwtService.verify(token);

    const user = await this.userService.findById(payload.jti);
    if (!user) throw new Error("Unauthenticated");

    return { user };
  }
}

const containers = Hollywood.create({
  databaseService: DatabaseService,
  jwtService: JWTService,
  userService: UserService,
  authService: AuthService,
});

async function handleRequest() {
  const authService = containers.instances.authService;

  const { user } = await authService.register({});

  const { token } = await authService.login(user.username, user.password);

  const existingUser = await authService.authenticate(token);
}
```

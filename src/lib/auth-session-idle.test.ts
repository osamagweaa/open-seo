import { describe, expect, it } from "vitest";
import { sessionIdleOptions } from "./auth-session-idle";

const idle = (minutes: string | undefined) =>
  sessionIdleOptions({ OPENSEO_SESSION_IDLE_MINUTES: minutes });

describe("sessionIdleOptions", () => {
  it.each([undefined, "", "0", "-5", "abc"])(
    "keeps the default session lifetime for %s",
    (value) => {
      expect(idle(value)).toEqual({});
    },
  );

  it("expires an idle session and renews it every minute of activity", () => {
    expect(idle("5")).toEqual({ expiresIn: 300, updateAge: 60 });
  });

  it("renews at half the lifetime when it is shorter than two minutes", () => {
    expect(idle("1")).toEqual({ expiresIn: 60, updateAge: 30 });
  });
});

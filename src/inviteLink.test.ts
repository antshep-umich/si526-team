import { afterEach, describe, expect, it } from "vitest";
import { forgetInviteCode, inviteLink, pendingInviteCode, takeInviteCodeFromAddress } from "./inviteLink.ts";

afterEach(() => {
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("invite links", () => {
  it("are the site's address, /join/, and the invite code", () => {
    expect(inviteLink("K7Q2MXAB", "https://si526-team.vercel.app")).toBe("https://si526-team.vercel.app/join/K7Q2MXAB");
  });

  it("keep the code from a /join/<code> address and put / back in the address bar", () => {
    window.history.pushState(null, "", "/join/K7Q2MXAB");

    takeInviteCodeFromAddress();

    expect(pendingInviteCode()).toBe("K7Q2MXAB");
    expect(window.location.pathname).toBe("/");
  });

  it("accept a trailing slash and an encoded code", () => {
    takeInviteCodeFromAddress({ pathname: "/join/k7q2%20mxab/" });

    expect(pendingInviteCode()).toBe("k7q2 mxab");
  });

  it("leave any other address alone", () => {
    window.history.pushState(null, "", "/components");

    takeInviteCodeFromAddress();
    takeInviteCodeFromAddress({ pathname: "/join/" });
    takeInviteCodeFromAddress({ pathname: "/join/a/b" });

    expect(pendingInviteCode()).toBeNull();
    expect(window.location.pathname).toBe("/components");
  });

  it("are forgotten once used", () => {
    takeInviteCodeFromAddress({ pathname: "/join/K7Q2MXAB" });

    forgetInviteCode();

    expect(pendingInviteCode()).toBeNull();
  });
});

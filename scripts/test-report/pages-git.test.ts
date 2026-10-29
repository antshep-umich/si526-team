import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { publishToBranch } from "./pages-git.ts";

let root: string;
let remote: string;

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** A clone of the shared remote, like the checkout a workflow job gets. */
function clone(name: string): string {
  const dir = join(root, name);
  git(root, "clone", "--quiet", remote, dir);
  git(dir, "config", "user.name", "Test");
  git(dir, "config", "user.email", "test@example.com");
  return dir;
}

const remoteFile = (path: string) => git(remote, "show", `gh-pages:${path}`);
const remoteCommits = () => Number(git(remote, "rev-list", "--count", "gh-pages"));

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "pages-git-"));
  remote = join(root, "remote.git");
  git(root, "init", "--quiet", "--bare", remote);
  const seed = clone("seed");
  writeFileSync(join(seed, "README.md"), "app");
  git(seed, "add", "README.md");
  git(seed, "commit", "--quiet", "-m", "Initial commit");
  git(seed, "push", "--quiet", "origin", "HEAD:refs/heads/main", "HEAD:refs/heads/louise-dev");
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function publish(repoDir: string, build: (siteDir: string, live: string[]) => boolean) {
  return publishToBranch({ repoDir, remote: "origin", branch: "gh-pages", message: "Publish", build });
}

describe("publishToBranch", () => {
  it("creates the branch with a single commit that has no parent", () => {
    const result = publish(clone("a"), (dir) => {
      writeFileSync(join(dir, "index.html"), "one");
      return true;
    });

    expect(result.attempts).toBe(1);
    expect(remoteFile("index.html")).toBe("one");
    expect(remoteCommits()).toBe(1);
    expect(git(remote, "rev-list", "--parents", "-n", "1", "gh-pages").split(" ")).toHaveLength(1);
    expect(result.commit).toBe(git(remote, "rev-parse", "gh-pages"));
  });

  it("builds on the published files and still leaves one commit", () => {
    const a = clone("a");
    publish(a, (dir) => {
      writeFileSync(join(dir, "first.txt"), "1");
      return true;
    });

    let seen = "";
    publish(a, (dir) => {
      seen = readFileSync(join(dir, "first.txt"), "utf8");
      writeFileSync(join(dir, "second.txt"), "2");
      return true;
    });

    expect(seen).toBe("1");
    expect(remoteFile("first.txt")).toBe("1");
    expect(remoteFile("second.txt")).toBe("2");
    expect(remoteCommits()).toBe(1);
  });

  it("publishes deletions too", () => {
    const a = clone("a");
    publish(a, (dir) => {
      writeFileSync(join(dir, "old.txt"), "old");
      return true;
    });
    publish(a, (dir) => {
      rmSync(join(dir, "old.txt"));
      writeFileSync(join(dir, "new.txt"), "new");
      return true;
    });

    expect(git(remote, "ls-tree", "--name-only", "gh-pages")).toBe("new.txt");
  });

  it("tells build which branches exist, leaving out the published one", () => {
    let live: string[] = [];
    publish(clone("a"), (dir, branches) => {
      live = branches;
      writeFileSync(join(dir, "index.html"), "x");
      return true;
    });

    expect(live.sort()).toEqual(["louise-dev", "main"]);
  });

  it("pushes nothing when build reports no change", () => {
    const result = publish(clone("a"), () => false);

    expect(result.commit).toBeNull();
    expect(git(remote, "branch", "--list", "gh-pages")).toBe("");
  });

  it("starts over when another publish lands first, so neither update is lost", () => {
    const a = clone("a");
    const b = clone("b");
    let calls = 0;

    const result = publish(a, (dir) => {
      calls += 1;
      if (calls === 1) {
        // Another job publishes after this one read gh-pages but before it pushes.
        publish(b, (other) => {
          writeFileSync(join(other, "from-b.txt"), "b");
          return true;
        });
      }
      writeFileSync(join(dir, "from-a.txt"), `a${existsSync(join(dir, "from-b.txt")) ? " after b" : ""}`);
      return true;
    });

    expect(result.attempts).toBe(2);
    expect(remoteFile("from-b.txt")).toBe("b");
    expect(remoteFile("from-a.txt")).toBe("a after b");
    expect(remoteCommits()).toBe(1);
  });

  it("stops with git's message when pushing fails for another reason", () => {
    const a = clone("a");
    git(a, "remote", "set-url", "origin", join(root, "missing.git"));

    expect(() => publish(a, () => true)).toThrow(/missing\.git|does not appear|not a git repository/i);
  });
});

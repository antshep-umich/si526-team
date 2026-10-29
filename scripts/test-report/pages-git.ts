import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface PublishOptions {
  /** A clone of the repo, used to talk to the remote. Its own files aren't touched. */
  repoDir: string;
  remote: string;
  /** The branch the site lives on, e.g. gh-pages. */
  branch: string;
  message: string;
  /** How many times to start over when another publish lands first. */
  attempts?: number;
  /**
   * Updates the site files in `siteDir` (which starts as the branch's current
   * files, or empty). Returns false when there's nothing to publish. May run
   * more than once, each time on fresh files.
   */
  build: (siteDir: string, liveBranches: string[]) => boolean;
}

function git(cwd: string, args: string[], env: NodeJS.ProcessEnv = process.env): string {
  return execFileSync("git", args, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** Branch name → commit SHA for every branch on the remote. */
function remoteBranches(repoDir: string, remote: string): Map<string, string> {
  const heads = new Map<string, string>();
  for (const line of git(repoDir, ["ls-remote", "--heads", remote]).split("\n")) {
    const [sha, ref] = line.split("\t");
    if (sha && ref?.startsWith("refs/heads/")) heads.set(ref.slice("refs/heads/".length), sha);
  }
  return heads;
}

const REJECTED = /\[rejected\]|stale info|fetch first|non-fast-forward/;

/**
 * Replaces `branch` on the remote with a single commit holding the built site.
 * The push only succeeds if the branch is still what this attempt built on
 * (--force-with-lease); if another publish got there first, it starts over
 * from the new state, so concurrent runs never overwrite each other.
 */
export function publishToBranch(opts: PublishOptions): { commit: string | null; attempts: number } {
  const { repoDir, remote, branch } = opts;
  const maxAttempts = opts.attempts ?? 5;
  const gitDir = git(repoDir, ["rev-parse", "--absolute-git-dir"]);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const heads = remoteBranches(repoDir, remote);
    const live = [...heads.keys()].filter((name) => name !== branch);
    const work = mkdtempSync(join(tmpdir(), "publish-"));
    const siteDir = join(work, "site");
    mkdirSync(siteDir);
    // A separate index and work tree, so the clone's own checkout is never touched.
    const env = { ...process.env, GIT_DIR: gitDir, GIT_WORK_TREE: siteDir, GIT_INDEX_FILE: join(work, "index") };

    try {
      let base = "";
      if (heads.has(branch)) {
        git(repoDir, ["fetch", "--quiet", "--no-tags", remote, `refs/heads/${branch}`]);
        base = git(repoDir, ["rev-parse", "FETCH_HEAD"]);
        git(siteDir, ["read-tree", base], env);
        git(siteDir, ["checkout-index", "--all", "--force"], env);
      }

      if (!opts.build(siteDir, live)) return { commit: null, attempts: attempt };

      git(siteDir, ["add", "--all", "--force", "."], env);
      const tree = git(siteDir, ["write-tree"], env);
      const commit = git(siteDir, ["commit-tree", tree, "-m", opts.message], env);

      try {
        git(repoDir, ["push", "--quiet", `--force-with-lease=refs/heads/${branch}:${base}`, remote, `${commit}:refs/heads/${branch}`]);
        return { commit, attempts: attempt };
      } catch (err) {
        const stderr = String((err as { stderr?: unknown }).stderr ?? "");
        if (!REJECTED.test(stderr)) throw err;
        console.log(`${branch} changed while publishing (attempt ${attempt}); starting over.`);
      }
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
  throw new Error(`Couldn't publish to ${branch}: it kept changing during ${maxAttempts} attempts`);
}

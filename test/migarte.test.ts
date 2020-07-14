import { debug, info } from "@atomist/skill/lib/log";
import { DefaultProjectLoader, gitHubComRepository } from "@atomist/skill/lib/project";
import { gitHub } from "@atomist/skill/lib/project/github";
import { Project } from "@atomist/skill/lib/project/project";
import * as fs from "fs-extra";

describe("migrate", () => {
    it("migrate all skills", async () => {
        const repos = (
            await gitHub({ credential: { token: "e95bbca471a3d00aeb3415bca0a87ec8b468754c" } as any }).repos.listForOrg(
                {
                    org: "atomist-skills-configuration",
                    page: 0,
                    per_page: 200,
                },
            )
        ).data;

        const pl = new DefaultProjectLoader();

        for (const repo of repos) {
            debug("Processing repo %s", repo.name);

            const p = await pl.clone(
                gitHubComRepository({
                    owner: "atomist-skills-configuration",
                    repo: repo.name,
                    credential: { token: "e95bbca471a3d00aeb3415bca0a87ec8b468754c" } as any,
                }),
            );

            await upgradeSkill(p, repo.name, "atomist_github-secret-scanner-skill.yml", "2.0.1");
            await upgradeSkill(p, repo.name, "atomist_github-branch-deletion-skill.yml", "2.0.2");
            await upgradeSkill(p, repo.name, "atomist_github-auto-merge-skill.yml", "2.0.1");
            await upgradeSkill(p, repo.name, "atomist_github-notifications-skill.yml", "2.3.1");
            await upgradeSkill(p, repo.name, "atomist_github-auto-rebase-skill.yml", "2.0.10");
            await upgradeSkill(p, repo.name, "atomist_container-run-skill.yml", "2.0.1");
        }
    });
});

async function upgradeSkill(p: Project, repo: string, name: string, version: string): Promise<void> {
    if (await fs.pathExists(p.path(name))) {
        const content = (await fs.readFile(p.path(name))).toString();
        const newContent = content.replace(/version: .*/g, `version: ${version}`);
        await fs.writeFile(p.path(name), newContent);

        if ((await p.exec("git", ["status", "--porcelain"])).stdout !== "") {
            info("Upgrading skill %s", name);
            info((await p.exec("git", ["diff"])).stdout);

            await p.exec("git", ["add", "."]);
            await p.exec("git", [
                "commit",
                "-m",
                `Upgrade ${name.replace(/_/g, "/").replace(/\.yml/g, "")}:${version}\n\n[atomist:generated]`,
            ]);
            await p.exec("git", ["push"]);
        }
    }
}

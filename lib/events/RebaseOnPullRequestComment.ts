/*
 * Copyright © 2020 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { EventHandler } from "@atomist/skill/lib/handler";
import { warn } from "@atomist/skill/lib/log";
import { gitHubComRepository } from "@atomist/skill/lib/project";
import { checkout } from "@atomist/skill/lib/project/git";
import { gitHubAppToken } from "@atomist/skill/lib/secrets";
import { codeLine } from "@atomist/slack-messages";
import {
    GitHubPullRequestCommentCreator,
    GitHubPullRequestCommentUpdater,
} from "../comment";
import { RebaseConfiguration } from "../configuration";
import { RebaseOnPullRequestCommentSubscription } from "../typings/types";

export const handler: EventHandler<RebaseOnPullRequestCommentSubscription, RebaseConfiguration> = async ctx => {
    const pr = ctx.data.Comment[0].pullRequest;
    const repo = pr.repo;

    const credential = await ctx.credential.resolve(gitHubAppToken({ owner: repo.owner, repo: repo.name, apiUrl: repo.org.provider.apiUrl }));

    const comment = await GitHubPullRequestCommentCreator(
        ctx,
        pr,
        credential,
        `Pull request rebase is in progress`);

    const project = await ctx.project.clone(gitHubComRepository({
        owner: repo.owner,
        repo: repo.name,
        credential,
        branch: pr.branchName,
    }), { alwaysDeep: true, detachHead: false });

    try {
        await checkout(project, pr.branchName);
    } catch (e) {
        warn("Failed to checkout PR branch: %s", e.message);
        await GitHubPullRequestCommentUpdater(
            ctx,
            comment,
            credential,
            `Pull request rebase failed because branch **${pr.branchName}** couldn't be checked out`);
        return {
            code: 1,
            reason: `Pull request [${pr.repo.owner}/${pr.repo.name}#${pr.number}](${pr.url}) rebase failed because branch ${pr.branchName} couldn't be checked out`,
        };
    }
    try {
        const args = [];
        if (ctx.configuration[0]?.parameters?.strategy) {
            args.push("-X", ctx.configuration[0].parameters.strategy);
        }
        await project.exec("git", ["rebase", ...args, `origin/${pr.baseBranchName}`]);
    } catch (e) {
        warn("Failed to rebase PR branch: %s", e.message);

        const result = await project.exec("git", ["diff", "--name-only", "--diff-filter=U"]);
        const conflicts = result.stdout.trim().split("\n");

        await GitHubPullRequestCommentUpdater(
            ctx,
            comment,
            credential,
            `Pull request rebase failed because of following conflicting ${conflicts.length === 1 ? "file" : "files"}:
${conflicts.map(c => `- ${codeLine(c)}`).join("\n")}`);
        return {
            code: 1,
            reason: `Pull request [${pr.repo.owner}/${pr.repo.name}#${pr.number}](${pr.url}) rebase failed because of conflicts`,
        };
    }

    try {
        await project.exec("git", ["push", "origin", pr.branchName, "--force-with-lease"]);
    } catch (e) {
        warn("Failed to force push PR branch: %s", e.message);

        await GitHubPullRequestCommentUpdater(
            ctx,
            comment,
            credential,
            `Pull request rebase failed because force push to **${pr.branchName}** errored`);
        return {
            code: 1,
            reason: `Pull request [${pr.repo.owner}/${pr.repo.name}#${pr.number}](${pr.url}) rebase failed because force push errored`,
        };
    }

    await GitHubPullRequestCommentUpdater(
        ctx,
        comment,
        credential,
        `Pull request was successfully rebased`);
    return {
        code: 0,
        reason: `Pull request [${pr.repo.owner}/${pr.repo.name}#${pr.number}](${pr.url}) was successfully rebased`,
    };
};

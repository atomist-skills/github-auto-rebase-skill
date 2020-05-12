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
import * as _ from "lodash";
import {
    gitHubPullRequestCommentCreator,
    gitHubPullRequestCommentUpdater,
} from "../comment";
import { RebaseConfiguration } from "../configuration";
import {
    PullRequest,
    PullRequestByRepoAndBranchQuery,
    PullRequestByRepoAndBranchQueryVariables,
    Push,
    RebaseOnPushSubscription,
} from "../typings/types";
import { truncateCommitMessage } from "../util";
import { AutoRebaseOnPushLabel } from "./ConvergePullRequestAutoRebaseLabels";

export const handler: EventHandler<RebaseOnPushSubscription, RebaseConfiguration> = async ctx => {
    const push = ctx.data.Push[0];

    // Check if there is an open PR against the branch this push is on
    const prs = await ctx.graphql.query<PullRequestByRepoAndBranchQuery, PullRequestByRepoAndBranchQueryVariables>(
        "pullRequestByRepoAndBranch.graphql",
        {
            owner: push.repo.owner,
            repo: push.repo.name,
            branch: push.branch,
        });

    const results = [];

    if (!!prs?.PullRequest && prs.PullRequest.length > 0) {

        const commits = push.commits.map(c => `- ${c.sha.slice(0, 7)} _${truncateCommitMessage(c.message)}_`).join("\n");

        for (const pr of prs.PullRequest) {

            if (!isRebaseRequested(pr, push)) {
                continue;
            }

            const { repo } = pr;
            const credential = await ctx.credential.resolve(gitHubAppToken({ owner: repo.owner, repo: repo.name, apiUrl: repo.org.provider.apiUrl }));

            const comment = await gitHubPullRequestCommentCreator(
                ctx,
                pr,
                credential,
                `Pull request rebase is in progress because @${push.after.author.login} pushed ${push.commits.length} ${
                    push.commits.length === 1 ? "commit" : "commits"} to **${push.branch}**:
${commits}`);

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
                await gitHubPullRequestCommentUpdater(
                    ctx,
                    comment,
                    credential,
                    `Pull request rebase failed because branch **${pr.branchName}** couldn't be checked out`);
                results.push({
                    code: 1,
                    reason: `Pull request [${pr.repo.owner}/${pr.repo.name}#${pr.number}](${pr.url}) rebase failed because branch ${pr.branchName} couldn't be checked out`,
                });
                continue;
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

                await gitHubPullRequestCommentUpdater(
                    ctx,
                    comment,
                    credential,
                    `Pull request rebase to ${push.after.sha.slice(0, 7)} by @${
                        push.after.author.login} failed because of following conflicting ${conflicts.length === 1 ? "file" : "files"}:
${conflicts.map(c => `- ${codeLine(c)}`).join("\n")}`);
                results.push({
                    code: 1,
                    reason: `Pull request [${pr.repo.owner}/${pr.repo.name}#${pr.number}](${pr.url}) rebase failed because of conflicts`,
                });
                continue;
            }

            try {
                await project.exec("git", ["push", "origin", pr.branchName, "--force-with-lease"]);
            } catch (e) {
                warn("Failed to force push PR branch: %s", e.message);

                await gitHubPullRequestCommentUpdater(
                    ctx,
                    comment,
                    credential,
                    `Pull request rebase failed because force push to **${pr.branchName}** errored`);
                results.push({
                    code: 1,
                    reason: `Pull request [${pr.repo.owner}/${pr.repo.name}#${pr.number}](${pr.url}) rebase failed because force push errored`,
                });
                continue;
            }

            await gitHubPullRequestCommentUpdater(
                ctx,
                comment,
                credential,
                `Pull request was successfully rebased onto ${push.after.sha.slice(0, 7)} by @${push.after.author.login}`);
            results.push({
                code: 0,
                reason: `Pull request [${pr.repo.owner}/${pr.repo.name}#${pr.number}](${pr.url}) was successfully rebased onto [${push.after.sha.slice(0, 7)}](${push.after.url}) by @${push.after.author.login}`,
            });
        }
    }

    if (results.length > 0) {
        return {
            code: _.max(results.map(r => r.code)),
            reason: results.map(r => r.reason).join("\n"),
        };
    } else {
        return {
            visibility: "hidden",
            code: 0,
            reason: `No open pull request that needs rebasing against branch ${push.branch}`,
        };
    }
};

function isRebaseRequested(pr: PullRequest,
                           push: Push,
                           label: string = AutoRebaseOnPushLabel,
                           tag = `[${AutoRebaseOnPushLabel}]`): boolean {
    // 0. check labels
    if (pr?.labels?.some(l => l.name === label)) {
        return true;
    }

    // 1. check body and title for auto rebase marker
    if (isTagged(pr?.title, tag) || isTagged(pr?.body, tag)) {
        return true;
    }

    // 2. PR comment that contains the rebase marker
    if (pr?.comments?.some(c => isTagged(c.body, tag))) {
        return true;
    }

    // 3. Commit message containing the auto rebase marker
    if (pr?.commits?.some(c => isTagged(c.message, tag))) {
        return true;
    }

    // 4. Commit push message containing the auto rebase marker
    if (push?.commits?.some(c => isTagged(c.message, tag))) {
        return true;
    }

    return false;
}

function isTagged(msg: string, tag: string): boolean {
    return msg && msg.indexOf(tag) >= 0;
}


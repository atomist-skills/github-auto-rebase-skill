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
import { gitHubComRepository } from "@atomist/skill/lib/project";
import {
    GitHubAppCredential,
    gitHubAppToken,
    GitHubCredential,
} from "@atomist/skill/lib/secrets";
import { codeLine } from "@atomist/slack-messages";
import { gitHub } from "./github";
import {
    PullRequest,
    PullRequestByRepoAndBranchQuery,
    RebaseOnPushSubscription,
} from "./types";
import { truncateCommitMessage } from "./util";

type PullRequestCommentCreator<T> = (pr: PullRequest, credential: GitHubAppCredential | GitHubCredential, body: string) => Promise<T>;
type PullRequestCommentUpdater<T> = (comment: T, credential: GitHubAppCredential | GitHubCredential, body: string) => Promise<void>;

interface RebaseConfiguration {
    strategy?: "ours" | "theirs";
}

export const handler: EventHandler<RebaseOnPushSubscription, RebaseConfiguration> = async ctx => {
    const push = ctx.data.Push[0];

    // Check if there is an open PR against the branch this push is on
    const prs = await ctx.graphql.query<PullRequestByRepoAndBranchQuery>("", {});

    if (!!prs?.PullRequest) {

        const commits = push.commits.map(c => `- ${c.sha.slice(0, 7)} _${truncateCommitMessage(c.message, push.repo)}_`).join("\n");

        for (const pr of prs.PullRequest) {
            const { repo } = pr;
            const credential = await ctx.credential.resolve(gitHubAppToken({ owner: repo.owner, repo: repo.name, apiUrl: repo.org.provider.apiUrl }));

            const comment = await GitHubPullRequestCommentCreator(
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
                await project.exec("git", ["checkout", pr.branchName]);
            } catch (e) {
                console.warn("Failed to checkout PR branch: %s", e.message);
                await GitHubPullRequestCommentUpdater(
                    comment,
                    credential,
                    `Pull request rebase failed because branch **${pr.branchName}** couldn't be checked out.`);
                return;
            }
            try {
                const args = [];
                if (!!ctx.configuration?.parameters?.strategy) {
                    args.push("-X", ctx.configuration.parameters.strategy);
                }
                await project.exec("git", ["rebase", ...args, `origin/${pr.baseBranchName}`]);
            } catch (e) {
                console.warn("Failed to rebase PR branch: %s", e.message);

                const result = await project.exec("git", ["diff", "--name-only", "--diff-filter=U"]);
                const conflicts = result.stdout.trim().split("\n");

                await GitHubPullRequestCommentUpdater(
                    comment,
                    credential,
                    `Pull request rebase to ${codeLine(push.after.sha.slice(0, 7))} by @${
                        push.after.author.login} failed because of following conflicting ${conflicts.length === 1 ? "file" : "files"}:
${conflicts.map(c => `- ${codeLine(c)}`).join("\n")}`);
                return;
            }

            try {
                await project.exec("git", ["push", "origin", pr.branchName, "--force"]);
            } catch (e) {
                console.warn("Failed to force push PR branch: %s", e.message);

                await GitHubPullRequestCommentUpdater(
                    comment,
                    credential,
                    `Pull request rebase failed because force push to **${pr.branchName}** errored.`);
                return;
            }

            await GitHubPullRequestCommentUpdater(
                comment,
                credential,
                `Pull request was successfully rebased onto ${codeLine(push.after.sha.slice(0, 7))} by @${push.after.author.login}:
${commits}`);

        }
    }

};

export interface GitHubCommentDetails {
    apiUrl: string;
    owner: string;
    repo: string;
    number: number;
    id: number;
}

export const GitHubPullRequestCommentCreator: PullRequestCommentCreator<GitHubCommentDetails> = async (pr, credentials, body) => {
    const result = (await gitHub(credentials.token, pr.repo.org.provider.apiUrl).issues.createComment({
        owner: pr.repo.owner,
        repo: pr.repo.name,
        issue_number: pr.number,
        body,
    })).data;

    return {
        apiUrl: pr.repo.org.provider.apiUrl,
        owner: pr.repo.owner,
        repo: pr.repo.name,
        number: pr.number,
        id: result.id,
    };
};

export const GitHubPullRequestCommentUpdater: PullRequestCommentUpdater<GitHubCommentDetails> = async (comment, credentials, body) => {
    await gitHub(credentials.token, comment.apiUrl).issues.updateComment({
        owner: comment.owner,
        repo: comment.repo,
        comment_id: comment.id,
        body,
    });
};

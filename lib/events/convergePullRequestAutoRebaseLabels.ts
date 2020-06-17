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
import { convergeLabel } from "@atomist/skill/lib/project/github";
import { gitHubAppToken } from "@atomist/skill/lib/secrets";
import { ConvergePullRequestAutoRebaseLabelsSubscription, PullRequestAction } from "../typings/types";

export const AutoRebaseOnPushLabel = "auto-rebase:on-push";

export const handler: EventHandler<ConvergePullRequestAutoRebaseLabelsSubscription> = async ctx => {
    const pr = ctx.data.PullRequest[0];

    if (pr.action !== PullRequestAction.Opened) {
        await ctx.audit.log(
            `Pull request ${pr.repo.owner}/${pr.repo.name}#${pr.number} action not opened. Ignoring...`,
        );

        return {
            visibility: "hidden",
            code: 0,
            reason: `Pull request [${pr.repo.owner}/${pr.repo.name}#${pr.number}](${pr.url}) action not opened. Ignoring...`,
        };
    }

    const repo = ctx.data.PullRequest[0].repo;
    const { owner, name } = repo;
    const credential = await ctx.credential.resolve(gitHubAppToken({ owner, repo: name }));

    const id = gitHubComRepository({ owner, repo: name, credential });
    await ctx.audit.log(`Converging auto-rebase label '${AutoRebaseOnPushLabel}'`);
    await convergeLabel(id, AutoRebaseOnPushLabel, "0E8A16", "Auto-rebase pull request branch");
    await ctx.audit.log(`Converged auto-rebase label 'AutoRebaseOnPushLabel'`);
    return {
        code: 0,
        reason: `Converged auto-rebase label for [${repo.owner}/${repo.name}](${repo.url})`,
    };
};

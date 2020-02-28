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
import { gitHubAppToken } from "@atomist/skill/lib/secrets";
import * as Octokit from "@octokit/rest";
import {
    apiUrl,
    gitHub,
} from "./github";
import {
    ConvergePullRequestAutoRebaseLabelsSubscription,
    PullRequestAction,
} from "./types";

export const AutoRebaseOnPushLabel = "auto-rebase:on-push";

export const handler: EventHandler<ConvergePullRequestAutoRebaseLabelsSubscription> = async ctx => {
    const pr = ctx.data.PullRequest[0];

    if (pr.action !== PullRequestAction.Opened) {
        await ctx.audit.log(`Pull request ${pr.repo.owner}/${pr.repo.name}#${pr.number} not opened. Ignoring...`);

        return {
            code: 0,
            reason: `Pull request [${pr.repo.owner}/${pr.repo.name}#${pr.number}](${pr.url}) not opened. Ignoring...`,
        };
    }

    const repo = ctx.data.PullRequest[0].repo;
    const { owner, name } = repo;
    const credentials = await ctx.credential.resolve(gitHubAppToken({ owner, repo: name }));

    const api = gitHub(credentials.token, apiUrl(repo));

    await ctx.audit.log(`Converging auto-rebase label`);

    await addLabel(AutoRebaseOnPushLabel, "0E8A16", owner, name, api);

    return {
        code: 0,
        reason: `Converged auto-rebase label for repository ${repo.owner}/${repo.name}`,
    };
};

async function addLabel(name: string,
                        color: string,
                        owner: string,
                        repo: string,
                        api: Octokit): Promise<void> {
    try {
        await api.issues.getLabel({
            name,
            repo,
            owner,
        });
    } catch (err) {
        await api.issues.createLabel({
            owner,
            repo,
            name,
            color,
        });
    }
}

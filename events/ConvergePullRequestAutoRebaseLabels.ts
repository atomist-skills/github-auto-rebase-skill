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
import { ConvergePullRequestAutoRebaseLabelsSubscription } from "./types";

export const AutoRebaseOnPushLabel = "auto-rebase:on-push";

export const handler: EventHandler<ConvergePullRequestAutoRebaseLabelsSubscription> = async ctx => {
    const repo = ctx.data.PullRequest[0].repo;
    const { owner, name } = repo;
    const credentials = await ctx.credential.resolve(gitHubAppToken({ owner, repo: name }));

    const api = gitHub(credentials.token, apiUrl(repo));

    await addLabel(AutoRebaseOnPushLabel, "0E8A16", owner, name, api);
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

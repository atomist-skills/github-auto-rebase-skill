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

import { EventContext, github, repository, secret } from "@atomist/skill";

import { PullRequest } from "./typings/types";

export interface GitHubCommentDetails {
	apiUrl: string;
	owner: string;
	repo: string;
	number: number;
	id: number;
}

export type PullRequestCommentCreator<T> = (
	ctx: EventContext,
	pr: PullRequest,
	credential: secret.GitHubAppCredential | secret.GitHubCredential,
	body: string,
) => Promise<T>;
export type PullRequestCommentUpdater<T> = (
	ctx: EventContext,
	comment: T,
	credential: secret.GitHubAppCredential | secret.GitHubCredential,
	body: string,
) => Promise<void>;

export const gitHubPullRequestCommentCreator: PullRequestCommentCreator<GitHubCommentDetails> =
	async (ctx, pr, credential, body) => {
		const result = (
			await github
				.api(
					repository.gitHub({
						owner: pr.repo.owner,
						repo: pr.repo.name,
						credential,
					}),
				)
				.issues.createComment({
					owner: pr.repo.owner,
					repo: pr.repo.name,
					issue_number: pr.number,
					body,
				})
		).data;
		return {
			apiUrl: pr.repo.org.provider.apiUrl,
			owner: pr.repo.owner,
			repo: pr.repo.name,
			number: pr.number,
			id: result.id,
		};
	};

export const gitHubPullRequestCommentUpdater: PullRequestCommentUpdater<GitHubCommentDetails> =
	async (ctx, comment, credential, body) => {
		await github
			.api(
				repository.gitHub({
					owner: comment.owner,
					repo: comment.repo,
					credential,
				}),
			)
			.issues.updateComment({
				owner: comment.owner,
				repo: comment.repo,
				comment_id: comment.id,
				body,
			});
	};

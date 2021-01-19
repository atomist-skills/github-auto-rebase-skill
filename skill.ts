/*
 * Copyright © 2021 Atomist, Inc.
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

import {
	Category,
	parameter,
	ParameterType,
	resourceProvider,
	skill,
} from "@atomist/skill";

import { RebaseConfiguration } from "./lib/configuration";

export const Skill = skill<RebaseConfiguration & { repos: any }>({
	name: "github-auto-rebase-skill",
	namespace: "atomist",
	displayName: "Auto-Rebase Pull Requests",
	description:
		"Rebase a pull request branch when there are pushes to the base branch",
	categories: [Category.RepoManagement],
	iconUrl:
		"https://raw.githubusercontent.com/atomist-skills/github-auto-rebase-skill/main/docs/images/icon.svg",

	runtime: {
		memory: 1024,
		timeout: 540,
	},

	resourceProviders: {
		github: resourceProvider.gitHub({ minRequired: 1 }),
	},

	parameters: {
		strategy: {
			type: ParameterType.SingleChoice,
			displayName: "Default merge strategy",
			description:
				"Select which merge strategy to use when rebasing pull request branches. If no strategy is selected here, this skill will use the [default merge strategy of git](https://git-scm.com/docs/git-rebase#git-rebase--Xltstrategy-optiongt).",
			options: [
				{
					text: "Recursive - Ours",
					value: "ours",
				},
				{
					text: "Recursive - Theirs",
					value: "theirs",
				},
			],
			required: false,
		},
		repos: parameter.repoFilter({ required: false }),
	},

	subscriptions: ["file://graphql/subscription/*.graphql"],
});

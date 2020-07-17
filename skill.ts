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
	author: "Atomist",
	categories: [Category.CodeReview, Category.DevEx],
	homepageUrl: "https://github.com/atomist-skills/github-auto-rebase-skill",
	repositoryUrl:
		"https://github.com/atomist-skills/github-auto-rebase-skill.git",
	iconUrl: "file://docs/images/icon.svg",
	license: "Apache-2.0",

	runtime: {
		memory: 1024,
		timeout: 540,
	},

	resourceProviders: {
		github: resourceProvider.gitHub({ minRequired: 1 }),
		slack: resourceProvider.chat({ minRequired: 0 }),
	},

	parameters: {
		strategy: {
			type: ParameterType.SingleChoice,
			displayName: "Default merge strategy",
			description:
				"Select which merge strategy to use when rebasing pull request branches",
			options: [
				{
					text: "Ours",
					value: "ours",
				},
				{
					text: "Theirs",
					value: "theirs",
				},
			],
			required: false,
		},
		repos: parameter.repoFilter({ required: false }),
	},

	subscriptions: ["file://graphql/subscription/*.graphql"],
});

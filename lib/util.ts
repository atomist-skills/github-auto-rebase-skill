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

import { escape } from "@atomist/slack-messages";

export function truncateCommitMessage(message: string): string {
	const title = (message || "").split("\n")[0];
	const escapedTitle = escape(title);

	if (escapedTitle.length <= 50) {
		return escapedTitle;
	}

	const splitRegExp = /(&(?:[gl]t|amp);|<.*?\||>)/;
	const titleParts = escapedTitle.split(splitRegExp);
	let truncatedTitle = "";
	let addNext = 1;
	let i;
	for (i = 0; i < titleParts.length; i++) {
		let newTitle = truncatedTitle;
		if (i % 2 === 0) {
			newTitle += titleParts[i];
		} else if (/^&(?:[gl]t|amp);$/.test(titleParts[i])) {
			newTitle += "&";
		} else if (/^<.*\|$/.test(titleParts[i])) {
			addNext = 2;
			continue;
		} else if (titleParts[i] === ">") {
			addNext = 1;
			continue;
		}
		if (newTitle.length > 50) {
			const l = 50 - newTitle.length;
			titleParts[i] = titleParts[i].slice(0, l) + "...";
			break;
		}
		truncatedTitle = newTitle;
	}
	return titleParts.slice(0, i + addNext).join("");
}

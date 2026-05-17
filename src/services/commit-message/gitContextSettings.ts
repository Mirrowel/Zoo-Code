import { normalizeCommitMessageGitContextSettings, type CommitMessageGitContextSettings } from "@roo-code/types"

import type { GitContextCollectorOptions } from "../git-context"
import { getActiveCommitMessageProfileSettings } from "./profileSettings"

export function getCommitMessageGitContextSettings(): Required<CommitMessageGitContextSettings> {
	return getActiveCommitMessageProfileSettings().gitContext
}

export function toGitContextCollectorOptions(
	staged: boolean,
	settings: Required<CommitMessageGitContextSettings>,
): GitContextCollectorOptions {
	return {
		staged,
		diff: {
			contextLines: settings.diffContextLines,
			includeStats: settings.includeDiffStats,
		},
		includeBranch: settings.includeCurrentBranch,
		recentCommits: {
			include: settings.includeRecentCommits,
			count: settings.recentCommitCount,
			includeBodies: settings.includeRecentCommitBodies,
			includeStats: settings.includeRecentCommitStats,
			includeDiffs: settings.includeRecentCommitDiffs,
			diffCount: settings.recentCommitDiffCount,
		},
	}
}

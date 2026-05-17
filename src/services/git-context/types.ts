export type GitStatus = "M" | "A" | "D" | "R" | "C" | "U" | "?" | "Unknown"

export interface GitChange {
	filePath: string
	oldFilePath?: string
	status: GitStatus
	staged: boolean
}

export interface GitContextResult {
	context: string
	warnings: string[]
}

export interface GitContextCollection extends GitContextResult {
	changes: GitChange[]
}

export interface GitContextOptions {
	staged: boolean
}

export interface GitDiffContextOptions {
	contextLines?: number
	includeStats?: boolean
}

export interface GitRecentCommitContextOptions {
	include?: boolean
	count?: number
	includeBodies?: boolean
	includeStats?: boolean
	includeDiffs?: boolean
	diffCount?: number
}

export interface GitContextCollectorOptions extends GitContextOptions {
	onProgress?: (percentage: number) => void
	diff?: GitDiffContextOptions
	includeBranch?: boolean
	recentCommits?: GitRecentCommitContextOptions
}

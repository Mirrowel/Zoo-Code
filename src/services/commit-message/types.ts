export type GitStatus = "M" | "A" | "D" | "R" | "C" | "U" | "?" | "Unknown"

export interface GitChange {
	filePath: string
	oldFilePath?: string
	status: GitStatus
	staged: boolean
}

export interface GitOptions {
	staged: boolean
}

export interface GitProgressOptions extends GitOptions {
	onProgress?: (percentage: number) => void
	includeRepoContext?: boolean
}

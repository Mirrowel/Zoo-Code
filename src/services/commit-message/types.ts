import * as vscode from "vscode"

export type GitStatus = "M" | "A" | "D" | "R" | "C" | "U" | "?" | "Unknown"

export interface GitChange {
	filePath: string
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

export interface VscGenerationRequest {
	inputBox: { value: string }
	rootUri?: vscode.Uri
}

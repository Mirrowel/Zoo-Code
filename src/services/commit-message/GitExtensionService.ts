import * as path from "path"
import { execFile } from "child_process"
import { GitProgressOptions, GitChange, GitOptions, GitStatus } from "./types"

export type { GitChange, GitOptions, GitProgressOptions } from "./types"

export class GitExtensionService {
	constructor(private workspaceRoot: string) {}

	public async gatherChanges(options: GitProgressOptions): Promise<GitChange[]> {
		const statusOutput = await this.getStatus(options)
		if (!statusOutput) {
			return []
		}

		return options.staged ? this.parseNameStatus(statusOutput, true) : this.parsePorcelainStatus(statusOutput)
	}

	public async spawnGitWithArgs(args: string[]): Promise<string> {
		return new Promise((resolve, reject) => {
			execFile(
				"git",
				args,
				{
					cwd: this.workspaceRoot,
					encoding: "utf8",
					maxBuffer: 20 * 1024 * 1024,
				},
				(error, stdout, stderr) => {
					if (error) {
						reject(new Error(`Git command failed: ${stderr || error.message}`))
						return
					}

					resolve(stdout)
				},
			)
		})
	}

	private async getDiffForChanges(changes: GitChange[], options: GitProgressOptions): Promise<string> {
		if (changes.length === 0) {
			return ""
		}

		const diffableChanges = changes.filter((change) => change.status !== "?")
		const untrackedFiles = changes.filter((change) => change.status === "?")
		const parts: string[] = []

		if (diffableChanges.length > 0) {
			const diffArgs = this.buildDiffArgs(options.staged, diffableChanges)
			const diff = await this.spawnGitWithArgs(diffArgs)
			if (diff.trim()) {
				parts.push(diff)
			}
		}

		if (untrackedFiles.length > 0) {
			parts.push(untrackedFiles.map((change) => `New untracked file: ${change.filePath}`).join("\n"))
		}

		options.onProgress?.(100)
		return parts.join("\n")
	}

	private async getStatus(options: GitOptions): Promise<string> {
		return options.staged
			? this.spawnGitWithArgs(["diff", "--name-status", "--cached", "-z"])
			: this.spawnGitWithArgs(["status", "--porcelain=v1", "-z"])
	}

	private async getCurrentBranch(): Promise<string> {
		return this.spawnGitWithArgs(["branch", "--show-current"])
	}

	private async getRecentCommits(count: number = 5): Promise<string> {
		return this.spawnGitWithArgs(["log", "--oneline", `-${count}`])
	}

	public async getCommitContext(
		changes: GitChange[],
		options: GitProgressOptions,
		specificFiles?: string[],
	): Promise<string> {
		const { staged, includeRepoContext = true } = options
		let context = "## Git Context for Commit Message Generation\n\n"

		const targetChanges = this.filterChanges(changes, specificFiles)
		const fileInfo = specificFiles ? ` (${specificFiles.length} selected files)` : ""
		const allStaged = targetChanges.every((change) => change.staged)
		const allUnstaged = targetChanges.every((change) => !change.staged)
		const changeDescriptor = allStaged ? "Staged" : allUnstaged ? "Unstaged" : "Selected"

		try {
			const diff = await this.getDiffForChanges(targetChanges, options)
			context += `### Full Diff of ${changeDescriptor} Changes${fileInfo}\n\`\`\`diff\n${diff}\n\`\`\`\n\n`
		} catch (error) {
			const changeType = staged ? "Staged" : "Unstaged"
			context += `### Full Diff of ${changeType} Changes${fileInfo}\n\`\`\`diff\n(No diff available)\n\`\`\`\n\n`
		}

		if (targetChanges.length > 0) {
			const summaryLines = targetChanges.map((change) => {
				const relativePath = this.getRelativePath(change.filePath)
				const scope = change.staged ? "staged" : "unstaged"
				const status = this.getReadableStatus(change.status)

				if (change.oldFilePath) {
					const oldRelativePath = this.getRelativePath(change.oldFilePath)
					return `${status} (${scope}): ${oldRelativePath} -> ${relativePath}`
				}

				return `${status} (${scope}): ${relativePath}`
			})

			context += "### Change Summary\n```\n" + summaryLines.join("\n") + "\n```\n\n"
		} else {
			context += "### Change Summary\n```\n(No changes matched selection)\n```\n\n"
		}

		if (includeRepoContext) {
			context += "### Repository Context\n\n"

			try {
				const currentBranch = await this.getCurrentBranch()
				if (currentBranch) {
					context += "**Current branch:** `" + currentBranch.trim() + "`\n\n"
				}
			} catch (error) {}

			try {
				const recentCommits = await this.getRecentCommits()
				if (recentCommits) {
					context += "**Recent commits:**\n```\n" + recentCommits + "\n```\n"
				}
			} catch (error) {}
		}

		return context
	}

	private parseNameStatus(output: string, staged: boolean): GitChange[] {
		const fields = this.splitNullDelimited(output)
		const changes: GitChange[] = []

		for (let index = 0; index < fields.length; index++) {
			const statusCode = fields[index]
			const status = this.getChangeStatusFromCode(statusCode)

			if (status === "R" || status === "C") {
				const oldFilePath = fields[++index]
				const filePath = fields[++index]
				if (oldFilePath && filePath) {
					changes.push({
						filePath: path.join(this.workspaceRoot, filePath),
						oldFilePath: path.join(this.workspaceRoot, oldFilePath),
						status,
						staged,
					})
				}
				continue
			}

			const filePath = fields[++index]
			if (filePath) {
				changes.push({
					filePath: path.join(this.workspaceRoot, filePath),
					status,
					staged,
				})
			}
		}

		return changes
	}

	private parsePorcelainStatus(output: string): GitChange[] {
		const fields = this.splitNullDelimited(output)
		const changes: GitChange[] = []

		for (let index = 0; index < fields.length; index++) {
			const entry = fields[index]
			if (entry.length < 4) {
				continue
			}

			const indexStatus = entry.charAt(0)
			const workingStatus = entry.charAt(1)
			const statusCode = indexStatus === "?" && workingStatus === "?" ? "?" : workingStatus.trim() || indexStatus
			const status = this.getChangeStatusFromCode(statusCode)
			const filePath = entry.substring(3)

			if (status === "R" || status === "C") {
				const oldFilePath = fields[++index]
				changes.push({
					filePath: path.join(this.workspaceRoot, filePath),
					oldFilePath: oldFilePath ? path.join(this.workspaceRoot, oldFilePath) : undefined,
					status,
					staged: false,
				})
				continue
			}

			changes.push({
				filePath: path.join(this.workspaceRoot, filePath),
				status,
				staged: false,
			})
		}

		return changes
	}

	private splitNullDelimited(output: string): string[] {
		return output.split("\0").filter(Boolean)
	}

	private filterChanges(changes: GitChange[], specificFiles?: string[]): GitChange[] {
		if (!specificFiles || specificFiles.length === 0) {
			return changes
		}

		return changes.filter((change) => {
			const absolutePath = change.filePath
			const relativePath = this.getRelativePath(absolutePath)
			return specificFiles.some((file) => {
				const normalizedFile = path.normalize(file).replace(/\\/g, "/")
				return (
					file === absolutePath ||
					file === relativePath ||
					absolutePath.endsWith(file) ||
					relativePath === normalizedFile
				)
			})
		})
	}

	private buildDiffArgs(staged: boolean, changes: GitChange[]): string[] {
		const args = staged ? ["diff", "--cached"] : ["diff"]
		const paths = Array.from(
			new Set(
				changes.flatMap((change) =>
					[change.filePath, change.oldFilePath]
						.filter((filePath): filePath is string => Boolean(filePath))
						.map((filePath) => this.getRelativePath(filePath)),
				),
			),
		)

		return paths.length > 0 ? [...args, "--", ...paths] : args
	}

	private getRelativePath(filePath: string): string {
		return path.relative(this.workspaceRoot, filePath).replace(/\\/g, "/")
	}

	private getChangeStatusFromCode(code: string): GitStatus {
		const status = code.charAt(0)
		switch (status) {
			case "M":
			case "A":
			case "D":
			case "R":
			case "C":
			case "U":
			case "?":
				return status as GitStatus
			default:
				return "Unknown"
		}
	}

	private getReadableStatus(status: GitStatus): string {
		switch (status) {
			case "M":
				return "Modified"
			case "A":
				return "Added"
			case "D":
				return "Deleted"
			case "R":
				return "Renamed"
			case "C":
				return "Copied"
			case "U":
				return "Updated"
			case "?":
				return "Untracked"
			case "Unknown":
			default:
				return "Unknown"
		}
	}

	public dispose(): void {}
}

import * as path from "path"
import { CommitMessageRequest, CommitMessageResult } from "./types/core"
import { GitExtensionService, GitChange } from "./GitExtensionService"
import { CommitMessageGenerator } from "./CommitMessageGenerator"
import { ICommitMessageIntegration } from "./adapters/ICommitMessageIntegration"
import { t } from "../../i18n"
import { GitStatus } from "./types"

export interface ChangeResolution {
	changes: GitChange[]
	files: string[]
	usedStaged: boolean
}

export class CommitMessageOrchestrator {
	async generateCommitMessage(
		request: CommitMessageRequest,
		integration: ICommitMessageIntegration,
		messageGenerator: CommitMessageGenerator,
	): Promise<CommitMessageResult> {
		let gitService: GitExtensionService | null = null

		try {
			integration.reportProgress?.(5, t("common:commitMessage.initializing"))
			gitService = new GitExtensionService(request.workspacePath)

			integration.reportProgress?.(15, t("common:commitMessage.discoveringFiles"))
			const resolution = await this.resolveCommitChanges(gitService, request.selectedFiles, integration)

			if (resolution.changes.length === 0) {
				const result = { message: "", error: "No changes found" }
				await integration.handleResult(result)
				return result
			}

			integration.reportProgress?.(
				25,
				t("common:commitMessage.foundChanges", { count: resolution.changes.length }),
			)

			if (!resolution.usedStaged && resolution.files.length > 0) {
				integration.showMessage?.("Generating commit message from unstaged changes", "info")
			}

			integration.reportProgress?.(40, t("common:commitMessage.gettingContext"))

			const gitContext = await gitService.getCommitContext(
				resolution.changes,
				{ staged: resolution.usedStaged, includeRepoContext: true },
				resolution.files,
			)

			integration.reportProgress?.(70, t("common:commitMessage.generating"))

			const message = await messageGenerator.generateMessage({
				workspacePath: request.workspacePath,
				selectedFiles: resolution.files,
				gitContext,
				onProgress: (update) => {
					if (update.percentage !== undefined) {
						const scaledPercentage = 70 + update.percentage * 0.25
						integration.reportProgress?.(scaledPercentage, update.message)
					}
				},
			})

			const result = { message }
			await integration.handleResult(result)

			integration.reportProgress?.(100, t("common:commitMessage.generated"))
			return result
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
			const result = { message: "", error: errorMessage }

			await integration.showMessage?.(errorMessage, "error")
			await integration.handleResult(result)

			return result
		} finally {
			gitService?.dispose()
		}
	}

	private async resolveCommitChanges(
		gitService: GitExtensionService,
		selectedFiles?: string[],
		integration?: ICommitMessageIntegration,
	): Promise<ChangeResolution> {
		if (selectedFiles && selectedFiles.length > 0) {
			const changes: GitChange[] = selectedFiles.map((filePath) => {
				const status: GitStatus = "M"
				const staged = false
				return {
					filePath,
					status,
					staged,
				}
			})
			return {
				changes,
				files: selectedFiles,
				usedStaged: false,
			}
		}

		let changes = await gitService.gatherChanges({ staged: true })
		let usedStaged = true

		if (changes.length === 0) {
			changes = await gitService.gatherChanges({ staged: false })
			usedStaged = false
		}

		return {
			changes,
			files: changes.map((change) => change.filePath),
			usedStaged,
		}
	}
}

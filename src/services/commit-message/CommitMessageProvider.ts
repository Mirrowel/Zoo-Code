import * as path from "path"
import * as vscode from "vscode"
import { ProviderSettingsManager } from "../../core/config/ProviderSettingsManager"
import { t } from "../../i18n"
import { Package } from "../../shared/package"
import { GitChange, GitContextCollector } from "../git-context"

import { CommitMessageGenerator } from "./CommitMessageGenerator"
import { getCommitMessageGitContextSettings, toGitContextCollectorOptions } from "./gitContextSettings"

interface VscGenerationRequest {
	inputBox: { value: string }
	rootUri?: vscode.Uri
}

export class CommitMessageProvider implements vscode.Disposable {
	private generator: CommitMessageGenerator

	constructor(
		private context: vscode.ExtensionContext,
		private outputChannel: vscode.OutputChannel,
	) {
		const providerSettingsManager = new ProviderSettingsManager(this.context)

		this.generator = new CommitMessageGenerator(providerSettingsManager)
	}

	public async activate(): Promise<void> {
		this.outputChannel.appendLine(t("common:commitMessage.activated"))

		const disposables = [
			vscode.commands.registerCommand(
				`${Package.name}.generateCommitMessage`,
				(vsRequest?: VscGenerationRequest) => this.handleVSCodeCommand(vsRequest),
			),
		]
		this.context.subscriptions.push(...disposables)
	}

	private async handleVSCodeCommand(vsRequest?: VscGenerationRequest): Promise<void> {
		try {
			const workspacePath = this.determineWorkspacePath(vsRequest?.rootUri)
			const targetRepository = await this.determineTargetRepository(workspacePath)
			if (!targetRepository?.rootUri) {
				throw new Error("Could not determine Git repository")
			}

			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.SourceControl,
					title: t("common:commitMessage.generating"),
					cancellable: false,
				},
				async (progress) => {
					let lastPercentage = 0
					const reportProgress = (percentage: number, message?: string) => {
						progress.report({
							increment: Math.max(0, percentage - lastPercentage),
							message: message || t("common:commitMessage.generating"),
						})
						lastPercentage = percentage
					}

					reportProgress(5, t("common:commitMessage.initializing"))
					const gitCollector = new GitContextCollector(workspacePath)

					try {
						reportProgress(15, t("common:commitMessage.discoveringFiles"))
						const resolution = await this.resolveCommitChanges(gitCollector)

						if (resolution.changes.length === 0) {
							vscode.window.showInformationMessage(t("common:commitMessage.noChanges"))
							return
						}

						if (!resolution.usedStaged) {
							const confirmed = await this.confirmUnstagedGeneration(resolution.changes.length)
							if (!confirmed) {
								return
							}
						}

						const gitContextSettings = getCommitMessageGitContextSettings()
						reportProgress(25, t("common:commitMessage.foundChanges", { count: resolution.changes.length }))

						reportProgress(40, t("common:commitMessage.gettingContext"))
						const gitContextResult = await gitCollector.collectContext(
							resolution.changes,
							toGitContextCollectorOptions(resolution.usedStaged, gitContextSettings),
							resolution.files,
						)
						if (gitContextResult.warnings.length > 0) {
							vscode.window.showWarningMessage(
								t("common:commitMessage.contextWarnings", {
									warnings: gitContextResult.warnings.join("; "),
								}),
							)
						}

						reportProgress(70, t("common:commitMessage.generating"))
						const message = await this.generator.generateMessage({
							workspacePath,
							selectedFiles: resolution.files,
							gitContext: gitContextResult.context,
							onProgress: (update) => {
								if (update.percentage !== undefined) {
									reportProgress(70 + update.percentage * 0.25, update.message)
								}
							},
						})

						targetRepository.inputBox.value = message
						reportProgress(100, t("common:commitMessage.generated"))
					} finally {
						gitCollector.dispose()
					}
				},
			)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
			vscode.window.showErrorMessage(t("common:commitMessage.generationFailed", { errorMessage }))
		}
	}

	private async confirmUnstagedGeneration(changeCount: number): Promise<boolean> {
		const confirmAction = t("common:commitMessage.confirmUnstagedAction")
		const selection = await vscode.window.showWarningMessage(
			t("common:commitMessage.confirmUnstaged", { count: changeCount }),
			{ modal: true },
			confirmAction,
		)

		return selection === confirmAction
	}

	private async resolveCommitChanges(gitCollector: GitContextCollector): Promise<{
		changes: GitChange[]
		files: string[]
		usedStaged: boolean
	}> {
		let changes = await gitCollector.gatherChanges({ staged: true })
		let usedStaged = true

		if (changes.length === 0) {
			changes = await gitCollector.gatherChanges({ staged: false })
			usedStaged = false
		}

		return {
			changes,
			files: changes.map((change) => change.filePath),
			usedStaged,
		}
	}

	private async determineTargetRepository(workspacePath: string): Promise<VscGenerationRequest | null> {
		try {
			const gitExtension = vscode.extensions.getExtension("vscode.git")
			if (!gitExtension) {
				return null
			}

			if (!gitExtension.isActive) {
				await gitExtension.activate()
			}

			const gitApi = gitExtension.exports.getAPI(1)
			if (!gitApi) {
				return null
			}

			const repositories = gitApi.repositories ?? []
			const matchingRepositories = repositories
				.filter((repo: VscGenerationRequest) =>
					repo.rootUri ? isPathWithinRepository(workspacePath, repo.rootUri.fsPath) : false,
				)
				.sort(
					(a: VscGenerationRequest, b: VscGenerationRequest) =>
						(b.rootUri?.fsPath.length ?? 0) - (a.rootUri?.fsPath.length ?? 0),
				)

			if (matchingRepositories.length > 0) {
				return matchingRepositories[0]
			}

			return repositories[0] ?? null
		} catch (error) {
			return null
		}
	}

	private determineWorkspacePath(resourceUri?: vscode.Uri): string {
		if (resourceUri) {
			return resourceUri.fsPath
		}

		const workspaceFolders = vscode.workspace.workspaceFolders
		if (workspaceFolders && workspaceFolders.length > 0) {
			return workspaceFolders[0].uri.fsPath
		}

		throw new Error("Could not determine workspace path")
	}

	public dispose(): void {}
}

export function isPathWithinRepository(targetPath: string, repositoryPath: string): boolean {
	const relativePath = path.relative(path.resolve(repositoryPath), path.resolve(targetPath))
	return relativePath === "" || (!!relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath))
}

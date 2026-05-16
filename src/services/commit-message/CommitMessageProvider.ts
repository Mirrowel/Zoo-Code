import * as vscode from "vscode"
import { ProviderSettingsManager } from "../../core/config/ProviderSettingsManager"
import { t } from "../../i18n"
import { Package } from "../../shared/package"

import { CommitMessageRequest, CommitMessageResult } from "./types/core"
import { CommitMessageGenerator } from "./CommitMessageGenerator"
import { VSCodeCommitMessageAdapter } from "./adapters/VSCodeCommitMessageAdapter"
import { VscGenerationRequest } from "./types"

export class CommitMessageProvider implements vscode.Disposable {
	private generator: CommitMessageGenerator
	private vscodeAdapter: VSCodeCommitMessageAdapter

	constructor(
		private context: vscode.ExtensionContext,
		private outputChannel: vscode.OutputChannel,
	) {
		const providerSettingsManager = new ProviderSettingsManager(this.context)

		this.generator = new CommitMessageGenerator(providerSettingsManager)
		this.vscodeAdapter = new VSCodeCommitMessageAdapter(this.generator)
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
		const request: CommitMessageRequest = {
			workspacePath: this.determineWorkspacePath(vsRequest?.rootUri),
		}

		await this.vscodeAdapter.generateCommitMessage(request)
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

	public dispose(): void {
		this.vscodeAdapter?.dispose()
	}
}

import { GitChange } from "../GitExtensionService"
import { CommitMessageResult } from "../types/core"

export interface ICommitMessageIntegration {
	reportProgress?(percentage: number, message?: string): void

	showMessage?(message: string, type: "info" | "error" | "warning"): Promise<void>

	handleResult(result: CommitMessageResult): Promise<void>
}

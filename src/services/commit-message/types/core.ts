export interface GenerateMessageParams {
	workspacePath: string
	selectedFiles: string[]
	gitContext: string
	onProgress?: (progress: ProgressUpdate) => void
}

export interface PromptOptions {
	customSupportPrompts?: Record<string, string>
	previousContext?: string
	previousMessage?: string
}

export interface ProgressUpdate {
	message?: string
	percentage?: number
	increment?: number
}

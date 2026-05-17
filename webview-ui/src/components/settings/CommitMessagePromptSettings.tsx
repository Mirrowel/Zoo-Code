import React from "react"
import { VSCodeCheckbox, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { defaultCommitMessageGitContextSettings, type CommitMessageGitContextSettings } from "@roo-code/types"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/components/ui"

interface CommitMessagePromptSettingsProps {
	listApiConfigMeta: Array<{ id: string; name: string }>
	commitMessageApiConfigId?: string
	setCommitMessageApiConfigId: (value: string) => void
	commitMessageGitContext?: CommitMessageGitContextSettings
	setCommitMessageGitContext: (value: CommitMessageGitContextSettings) => void
}

const CommitMessagePromptSettings = ({
	listApiConfigMeta,
	commitMessageApiConfigId,
	setCommitMessageApiConfigId,
	commitMessageGitContext,
	setCommitMessageGitContext,
}: CommitMessagePromptSettingsProps) => {
	const { t } = useAppTranslation()
	const gitContextSettings = { ...defaultCommitMessageGitContextSettings, ...commitMessageGitContext }

	const updateGitContextSetting = <K extends keyof CommitMessageGitContextSettings>(
		key: K,
		value: CommitMessageGitContextSettings[K],
	) => {
		setCommitMessageGitContext({ ...gitContextSettings, [key]: value })
	}

	const updateNumberSetting = (
		key: keyof CommitMessageGitContextSettings,
		value: string,
		min: number,
		max: number,
	) => {
		const parsed = Number(value)
		if (!Number.isFinite(parsed)) {
			return
		}

		updateGitContextSetting(key, Math.min(Math.max(Math.trunc(parsed), min), max) as never)
	}

	return (
		<div className="mt-4 flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
			<div>
				<label className="block font-medium mb-1">
					{t("prompts:supportPrompts.commitMessage.apiConfiguration")}
				</label>
				<Select
					value={commitMessageApiConfigId || "-"}
					onValueChange={(value) => {
						setCommitMessageApiConfigId(value === "-" ? "" : value)
					}}>
					<SelectTrigger data-testid="commit-message-api-config-select" className="w-full">
						<SelectValue placeholder={t("prompts:supportPrompts.commitMessage.useCurrentConfig")} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="-">{t("prompts:supportPrompts.commitMessage.useCurrentConfig")}</SelectItem>
						{(listApiConfigMeta || []).map((config) => (
							<SelectItem
								key={config.id}
								value={config.id}
								data-testid={`commit-message-${config.id}-option`}>
								{config.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<div className="text-sm text-vscode-descriptionForeground mt-1">
					{t("prompts:supportPrompts.commitMessage.apiConfigDescription")}
				</div>
			</div>

			<div className="mt-2 flex flex-col gap-3">
				<div>
					<div className="font-medium mb-1">{t("prompts:supportPrompts.commitMessage.gitContext.title")}</div>
					<div className="text-sm text-vscode-descriptionForeground">
						{t("prompts:supportPrompts.commitMessage.gitContext.description")}
					</div>
				</div>

				<div>
					<VSCodeTextField
						type="text"
						value={String(gitContextSettings.diffContextLines)}
						onInput={(event) =>
							updateNumberSetting("diffContextLines", (event.target as HTMLInputElement).value, 0, 20)
						}>
						<span className="font-medium">
							{t("prompts:supportPrompts.commitMessage.gitContext.contextLines")}
						</span>
					</VSCodeTextField>
					<div className="text-sm text-vscode-descriptionForeground mt-1">
						{t("prompts:supportPrompts.commitMessage.gitContext.contextLinesDescription")}
					</div>
				</div>

				<VSCodeCheckbox
					checked={gitContextSettings.includeDiffStats}
					onChange={(event) =>
						updateGitContextSetting("includeDiffStats", (event.target as HTMLInputElement).checked)
					}>
					<span className="font-medium">
						{t("prompts:supportPrompts.commitMessage.gitContext.includeDiffStats")}
					</span>
				</VSCodeCheckbox>

				<VSCodeCheckbox
					checked={gitContextSettings.includeCurrentBranch}
					onChange={(event) =>
						updateGitContextSetting("includeCurrentBranch", (event.target as HTMLInputElement).checked)
					}>
					<span className="font-medium">
						{t("prompts:supportPrompts.commitMessage.gitContext.includeBranch")}
					</span>
				</VSCodeCheckbox>

				<div className="pt-2 border-t border-vscode-panel-border">
					<VSCodeCheckbox
						checked={gitContextSettings.includeRecentCommits}
						onChange={(event) =>
							updateGitContextSetting("includeRecentCommits", (event.target as HTMLInputElement).checked)
						}>
						<span className="font-medium">
							{t("prompts:supportPrompts.commitMessage.gitContext.includeRecentCommits")}
						</span>
					</VSCodeCheckbox>
					<div className="text-sm text-vscode-descriptionForeground mt-1 mb-2">
						{t("prompts:supportPrompts.commitMessage.gitContext.recentCommitsDescription")}
					</div>

					{gitContextSettings.includeRecentCommits && (
						<div className="flex flex-col gap-3 pl-4">
							<VSCodeTextField
								type="text"
								value={String(gitContextSettings.recentCommitCount)}
								onInput={(event) =>
									updateNumberSetting(
										"recentCommitCount",
										(event.target as HTMLInputElement).value,
										1,
										20,
									)
								}>
								<span className="font-medium">
									{t("prompts:supportPrompts.commitMessage.gitContext.recentCommitCount")}
								</span>
							</VSCodeTextField>

							<VSCodeCheckbox
								checked={gitContextSettings.includeRecentCommitBodies}
								onChange={(event) =>
									updateGitContextSetting(
										"includeRecentCommitBodies",
										(event.target as HTMLInputElement).checked,
									)
								}>
								<span>
									{t("prompts:supportPrompts.commitMessage.gitContext.includeRecentCommitBodies")}
								</span>
							</VSCodeCheckbox>

							<VSCodeCheckbox
								checked={gitContextSettings.includeRecentCommitStats}
								onChange={(event) =>
									updateGitContextSetting(
										"includeRecentCommitStats",
										(event.target as HTMLInputElement).checked,
									)
								}>
								<span>
									{t("prompts:supportPrompts.commitMessage.gitContext.includeRecentCommitStats")}
								</span>
							</VSCodeCheckbox>

							<VSCodeCheckbox
								checked={gitContextSettings.includeRecentCommitDiffs}
								onChange={(event) =>
									updateGitContextSetting(
										"includeRecentCommitDiffs",
										(event.target as HTMLInputElement).checked,
									)
								}>
								<span>
									{t("prompts:supportPrompts.commitMessage.gitContext.includeRecentCommitDiffs")}
								</span>
							</VSCodeCheckbox>

							{gitContextSettings.includeRecentCommitDiffs && (
								<VSCodeTextField
									type="text"
									value={String(gitContextSettings.recentCommitDiffCount)}
									onInput={(event) =>
										updateNumberSetting(
											"recentCommitDiffCount",
											(event.target as HTMLInputElement).value,
											1,
											5,
										)
									}>
									<span>
										{t("prompts:supportPrompts.commitMessage.gitContext.recentCommitDiffCount")}
									</span>
								</VSCodeTextField>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

export default CommitMessagePromptSettings

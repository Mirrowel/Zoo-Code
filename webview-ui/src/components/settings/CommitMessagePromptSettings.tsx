import React from "react"
import { VSCodeCheckbox, VSCodeTextArea, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import {
	MAX_COMMIT_MESSAGE_PROFILES,
	createCommitMessageProfileId,
	createCommitMessageProfileName,
	defaultCommitMessageGitContextSettings,
	normalizeCommitMessageProfiles,
	type CommitMessageGitContextSettings,
	type CommitMessageProfileSettings,
	type CommitMessageProfilesSettings,
	type NormalizedCommitMessageProfile,
} from "@roo-code/types"
import { supportPrompt } from "@roo/support-prompt"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import {
	Button,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	StandardTooltip,
} from "@src/components/ui"

interface CommitMessagePromptSettingsProps {
	listApiConfigMeta: Array<{ id: string; name: string }>
	customSupportPrompts: Record<string, string | undefined>
	setCustomSupportPrompts: (prompts: Record<string, string | undefined>) => void
	commitMessageApiConfigId?: string
	setCommitMessageApiConfigId: (value: string) => void
	commitMessageGitContext?: CommitMessageGitContextSettings
	setCommitMessageGitContext: (value: CommitMessageGitContextSettings) => void
	commitMessageProfiles?: CommitMessageProfilesSettings
	setCommitMessageProfiles: (value: CommitMessageProfilesSettings) => void
}

const CommitMessagePromptSettings = ({
	listApiConfigMeta,
	customSupportPrompts,
	setCustomSupportPrompts,
	commitMessageApiConfigId,
	setCommitMessageApiConfigId,
	commitMessageGitContext,
	setCommitMessageGitContext,
	commitMessageProfiles,
	setCommitMessageProfiles,
}: CommitMessagePromptSettingsProps) => {
	const { t } = useAppTranslation()
	const normalizedProfiles = normalizeCommitMessageProfiles(commitMessageProfiles, {
		prompt: customSupportPrompts.COMMIT_MESSAGE,
		apiConfigId: commitMessageApiConfigId,
		gitContext: commitMessageGitContext,
	})
	const activeProfile =
		normalizedProfiles.profiles.find((profile) => profile.id === normalizedProfiles.activeProfileId) ??
		normalizedProfiles.profiles[0]
	const profilePrompt = activeProfile.prompt ?? supportPrompt.get({}, "COMMIT_MESSAGE")
	const canAddProfile = normalizedProfiles.profiles.length < MAX_COMMIT_MESSAGE_PROFILES
	const canDeleteProfile = normalizedProfiles.profiles.length > 1

	const persistProfiles = (profiles: CommitMessageProfileSettings[], activeProfileId: string) => {
		setCommitMessageProfiles({
			activeProfileId,
			profiles: profiles.slice(0, MAX_COMMIT_MESSAGE_PROFILES),
		})
	}

	const syncSingleProfileFallback = (profile: NormalizedCommitMessageProfile | CommitMessageProfileSettings) => {
		setCommitMessageApiConfigId(profile.apiConfigId ?? "")
		setCommitMessageGitContext(profile.gitContext ?? defaultCommitMessageGitContextSettings)

		const nextPrompts = { ...customSupportPrompts }
		if (profile.prompt === undefined) {
			delete nextPrompts.COMMIT_MESSAGE
		} else {
			nextPrompts.COMMIT_MESSAGE = profile.prompt
		}
		setCustomSupportPrompts(nextPrompts)
	}

	const updateActiveProfile = (updates: Partial<CommitMessageProfileSettings>) => {
		const profiles = normalizedProfiles.profiles.map((profile) =>
			profile.id === activeProfile.id ? { ...profile, ...updates } : profile,
		)
		const nextActiveProfile = profiles.find((profile) => profile.id === activeProfile.id)!

		persistProfiles(profiles, activeProfile.id)
		syncSingleProfileFallback(nextActiveProfile)
	}

	const updateGitContextSetting = <K extends keyof CommitMessageGitContextSettings>(
		key: K,
		value: CommitMessageGitContextSettings[K],
	) => {
		updateActiveProfile({ gitContext: { ...activeProfile.gitContext, [key]: value } })
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

	const handleActiveProfileChange = (profileId: string) => {
		const nextActiveProfile = normalizedProfiles.profiles.find((profile) => profile.id === profileId)
		if (!nextActiveProfile) {
			return
		}

		persistProfiles(normalizedProfiles.profiles, nextActiveProfile.id)
		syncSingleProfileFallback(nextActiveProfile)
	}

	const handleAddProfile = () => {
		if (!canAddProfile) {
			return
		}

		const newProfile: CommitMessageProfileSettings = {
			id: createCommitMessageProfileId(),
			name: createCommitMessageProfileName(normalizedProfiles.profiles),
			gitContext: defaultCommitMessageGitContextSettings,
		}
		persistProfiles([...normalizedProfiles.profiles, newProfile], newProfile.id!)
		syncSingleProfileFallback(newProfile)
	}

	const handleDeleteProfile = () => {
		if (!canDeleteProfile) {
			return
		}

		const profiles = normalizedProfiles.profiles.filter((profile) => profile.id !== activeProfile.id)
		const nextActiveProfile = profiles[0]
		persistProfiles(profiles, nextActiveProfile.id)
		syncSingleProfileFallback(nextActiveProfile)
	}

	const getTextAreaValue = (event: Event | React.FormEvent<HTMLElement>) => {
		return (
			(event as unknown as CustomEvent)?.detail?.target?.value ??
			((event as any).target as HTMLTextAreaElement).value
		)
	}

	return (
		<div className="mt-4 flex flex-col gap-4 pl-3 border-l-2 border-vscode-button-background">
			{/* Profile selection controls. Keep this first so users understand which profile they are editing. */}
			<div className="flex flex-col gap-3">
				<div>
					<label className="block font-medium mb-1">
						{t("prompts:supportPrompts.commitMessage.profiles.title")}
					</label>
					<Select value={activeProfile.id} onValueChange={handleActiveProfileChange}>
						<SelectTrigger data-testid="commit-message-profile-select" className="w-full">
							<SelectValue placeholder={t("prompts:supportPrompts.commitMessage.profiles.select")} />
						</SelectTrigger>
						<SelectContent>
							{normalizedProfiles.profiles.map((profile) => (
								<SelectItem
									key={profile.id}
									value={profile.id}
									data-testid={`commit-message-${profile.id}-profile`}>
									{profile.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<div className="text-sm text-vscode-descriptionForeground mt-1">
						{t("prompts:supportPrompts.commitMessage.profiles.description")}
					</div>
				</div>

				<div>
					<VSCodeTextField
						type="text"
						value={activeProfile.name}
						data-testid="commit-message-profile-name"
						onInput={(event) =>
							updateActiveProfile({ name: ((event as any).target as HTMLInputElement).value })
						}>
						<span className="font-medium">{t("prompts:supportPrompts.commitMessage.profiles.name")}</span>
					</VSCodeTextField>
					<div className="text-sm text-vscode-descriptionForeground mt-1">
						{t("prompts:supportPrompts.commitMessage.profiles.nameDescription")}
					</div>
				</div>

				<div className="flex flex-wrap gap-2 items-center">
					<Button variant="secondary" onClick={handleAddProfile} disabled={!canAddProfile}>
						{t("prompts:supportPrompts.commitMessage.profiles.add")}
					</Button>
					<Button variant="ghost" onClick={handleDeleteProfile} disabled={!canDeleteProfile}>
						{t("prompts:supportPrompts.commitMessage.profiles.delete")}
					</Button>
					<span className="text-sm text-vscode-descriptionForeground">
						{t("prompts:supportPrompts.commitMessage.profiles.limit", {
							count: MAX_COMMIT_MESSAGE_PROFILES,
						})}
					</span>
				</div>
			</div>

			{/* Prompt editor for the selected commit-message profile. */}
			<div>
				<div className="flex justify-between items-center mb-1">
					<div>
						<label className="block font-medium">{t("prompts:supportPrompts.prompt")}</label>
						<div className="text-sm text-vscode-descriptionForeground mt-1">
							{t("prompts:supportPrompts.commitMessage.promptDescription")}
						</div>
					</div>
					<StandardTooltip
						content={t("prompts:supportPrompts.resetPrompt", { promptType: "COMMIT_MESSAGE" })}>
						<Button variant="ghost" size="icon" onClick={() => updateActiveProfile({ prompt: undefined })}>
							<span className="codicon codicon-discard"></span>
						</Button>
					</StandardTooltip>
				</div>
				<VSCodeTextArea
					resize="vertical"
					value={profilePrompt}
					onInput={(event) => updateActiveProfile({ prompt: getTextAreaValue(event) })}
					rows={6}
					className="w-full"
					data-testid="commit-message-prompt-textarea"
				/>
			</div>

			{/* API configuration for the selected commit-message profile. */}
			<div>
				<label className="block font-medium mb-1">
					{t("prompts:supportPrompts.commitMessage.apiConfiguration")}
				</label>
				<Select
					value={activeProfile.apiConfigId || "-"}
					onValueChange={(value) => updateActiveProfile({ apiConfigId: value === "-" ? undefined : value })}>
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

			{/* Optional Git context controls. Required diff/change summary behavior is not user-toggleable. */}
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
						value={String(activeProfile.gitContext.diffContextLines)}
						onInput={(event) =>
							updateNumberSetting(
								"diffContextLines",
								((event as any).target as HTMLInputElement).value,
								0,
								20,
							)
						}>
						<span className="font-medium">
							{t("prompts:supportPrompts.commitMessage.gitContext.contextLines")}
						</span>
					</VSCodeTextField>
					<div className="text-sm text-vscode-descriptionForeground mt-1">
						{t("prompts:supportPrompts.commitMessage.gitContext.contextLinesDescription")}
					</div>
				</div>

				<CheckboxSetting
					checked={activeProfile.gitContext.includeDiffStats}
					label={t("prompts:supportPrompts.commitMessage.gitContext.includeDiffStats")}
					description={t("prompts:supportPrompts.commitMessage.gitContext.includeDiffStatsDescription")}
					onChange={(checked) => updateGitContextSetting("includeDiffStats", checked)}
				/>

				<CheckboxSetting
					checked={activeProfile.gitContext.includeCurrentBranch}
					label={t("prompts:supportPrompts.commitMessage.gitContext.includeBranch")}
					description={t("prompts:supportPrompts.commitMessage.gitContext.includeBranchDescription")}
					onChange={(checked) => updateGitContextSetting("includeCurrentBranch", checked)}
				/>

				<div className="pt-2 border-t border-vscode-panel-border">
					<CheckboxSetting
						checked={activeProfile.gitContext.includeRecentCommits}
						label={t("prompts:supportPrompts.commitMessage.gitContext.includeRecentCommits")}
						description={t("prompts:supportPrompts.commitMessage.gitContext.recentCommitsDescription")}
						onChange={(checked) => updateGitContextSetting("includeRecentCommits", checked)}
					/>

					{activeProfile.gitContext.includeRecentCommits && (
						<div className="flex flex-col gap-3 pl-4 mt-3">
							<div>
								<VSCodeTextField
									type="text"
									value={String(activeProfile.gitContext.recentCommitCount)}
									onInput={(event) =>
										updateNumberSetting(
											"recentCommitCount",
											((event as any).target as HTMLInputElement).value,
											1,
											20,
										)
									}>
									<span className="font-medium">
										{t("prompts:supportPrompts.commitMessage.gitContext.recentCommitCount")}
									</span>
								</VSCodeTextField>
								<div className="text-sm text-vscode-descriptionForeground mt-1">
									{t("prompts:supportPrompts.commitMessage.gitContext.recentCommitCountDescription")}
								</div>
							</div>

							<CheckboxSetting
								checked={activeProfile.gitContext.includeRecentCommitBodies}
								label={t("prompts:supportPrompts.commitMessage.gitContext.includeRecentCommitBodies")}
								description={t(
									"prompts:supportPrompts.commitMessage.gitContext.includeRecentCommitBodiesDescription",
								)}
								onChange={(checked) => updateGitContextSetting("includeRecentCommitBodies", checked)}
							/>

							<CheckboxSetting
								checked={activeProfile.gitContext.includeRecentCommitStats}
								label={t("prompts:supportPrompts.commitMessage.gitContext.includeRecentCommitStats")}
								description={t(
									"prompts:supportPrompts.commitMessage.gitContext.includeRecentCommitStatsDescription",
								)}
								onChange={(checked) => updateGitContextSetting("includeRecentCommitStats", checked)}
							/>

							<CheckboxSetting
								checked={activeProfile.gitContext.includeRecentCommitDiffs}
								label={t("prompts:supportPrompts.commitMessage.gitContext.includeRecentCommitDiffs")}
								description={t(
									"prompts:supportPrompts.commitMessage.gitContext.includeRecentCommitDiffsDescription",
								)}
								onChange={(checked) => updateGitContextSetting("includeRecentCommitDiffs", checked)}
							/>

							{activeProfile.gitContext.includeRecentCommitDiffs && (
								<div>
									<VSCodeTextField
										type="text"
										value={String(activeProfile.gitContext.recentCommitDiffCount)}
										onInput={(event) =>
											updateNumberSetting(
												"recentCommitDiffCount",
												((event as any).target as HTMLInputElement).value,
												1,
												5,
											)
										}>
										<span>
											{t("prompts:supportPrompts.commitMessage.gitContext.recentCommitDiffCount")}
										</span>
									</VSCodeTextField>
									<div className="text-sm text-vscode-descriptionForeground mt-1">
										{t(
											"prompts:supportPrompts.commitMessage.gitContext.recentCommitDiffCountDescription",
										)}
									</div>
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

interface CheckboxSettingProps {
	checked: boolean
	label: string
	description: string
	onChange: (checked: boolean) => void
}

const CheckboxSetting = ({ checked, label, description, onChange }: CheckboxSettingProps) => (
	<div>
		<VSCodeCheckbox checked={checked} onChange={(event) => onChange((event.target as HTMLInputElement).checked)}>
			<span className="font-medium">{label}</span>
		</VSCodeCheckbox>
		<div className="text-sm text-vscode-descriptionForeground mt-1">{description}</div>
	</div>
)

export default CommitMessagePromptSettings

import React from "react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/components/ui"

interface CommitMessagePromptSettingsProps {
	listApiConfigMeta: Array<{ id: string; name: string }>
	commitMessageApiConfigId?: string
	setCommitMessageApiConfigId: (value: string) => void
}

const CommitMessagePromptSettings = ({
	listApiConfigMeta,
	commitMessageApiConfigId,
	setCommitMessageApiConfigId,
}: CommitMessagePromptSettingsProps) => {
	const { t } = useAppTranslation()

	return (
		<div className="mt-4 flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
			<div>
				<label className="block font-medium mb-1">{t("prompts:supportPrompts.enhance.apiConfiguration")}</label>
				<Select
					value={commitMessageApiConfigId || "-"}
					onValueChange={(value) => {
						setCommitMessageApiConfigId(value === "-" ? "" : value)
					}}>
					<SelectTrigger data-testid="commit-message-api-config-select" className="w-full">
						<SelectValue placeholder={t("prompts:supportPrompts.enhance.useCurrentConfig")} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="-">{t("prompts:supportPrompts.enhance.useCurrentConfig")}</SelectItem>
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
					{t("prompts:supportPrompts.enhance.apiConfigDescription")}
				</div>
			</div>
		</div>
	)
}

export default CommitMessagePromptSettings

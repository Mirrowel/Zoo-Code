import {
	getModelId,
	normalizeCommitMessageAttributionSettings,
	type CommitMessageAttributionSettings,
	type ProviderSettings,
} from "@roo-code/types"

const ATTRIBUTION_AGENT_NAME = "Zoo Code"
const ATTRIBUTION_TOOL_NAME = "Zoo Code"
const UNKNOWN_VALUE = "unknown"

export interface CommitMessageAttributionTemplateValues {
	agentName: string
	toolName: string
	provider: string
	model: string
	providerModel: string
}

export function createCommitMessageAttribution(
	settings: CommitMessageAttributionSettings | undefined,
	apiConfiguration: ProviderSettings,
): string {
	const normalized = normalizeCommitMessageAttributionSettings(settings)
	if (!normalized.enabled) {
		return ""
	}

	const provider = apiConfiguration.apiProvider || UNKNOWN_VALUE
	const model = getModelId(apiConfiguration) || UNKNOWN_VALUE

	return applyCommitMessageAttributionTemplate(normalized.template, {
		agentName: ATTRIBUTION_AGENT_NAME,
		toolName: ATTRIBUTION_TOOL_NAME,
		provider,
		model,
		providerModel: `${provider}/${model}`,
	})
}

export function applyCommitMessageAttributionTemplate(
	template: string,
	values: CommitMessageAttributionTemplateValues,
): string {
	return template.replace(
		/\$\{(agentName|toolName|provider|model|providerModel)\}/g,
		(_, key) => values[key as keyof typeof values],
	)
}

export function appendCommitMessageAttribution(message: string, attribution: string): string {
	const cleanedMessage = message.trim()
	const cleanedAttribution = attribution.trim()

	if (!cleanedAttribution) {
		return cleanedMessage
	}

	if (cleanedMessage.endsWith(cleanedAttribution)) {
		return cleanedMessage
	}

	return `${cleanedMessage}\n\n${cleanedAttribution}`
}

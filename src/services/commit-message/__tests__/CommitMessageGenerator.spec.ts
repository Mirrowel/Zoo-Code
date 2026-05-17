import type { ProviderSettings } from "@roo-code/types"

import { CommitMessageGenerator } from "../CommitMessageGenerator"
import { singleCompletionHandler } from "../../../utils/single-completion-handler"

const { mockContextProxy, mockCaptureEvent, mockAddCustomInstructions } = vi.hoisted(() => ({
	mockContextProxy: {
		isInitialized: true,
		getProviderSettings: vi.fn(),
		getValue: vi.fn(),
	},
	mockCaptureEvent: vi.fn(),
	mockAddCustomInstructions: vi.fn(),
}))
const mockSingleCompletionHandler = vi.mocked(singleCompletionHandler)

vi.mock("../../../core/config/ContextProxy", () => ({
	ContextProxy: {
		get instance() {
			return mockContextProxy
		},
	},
}))

vi.mock("../../../core/prompts/sections/custom-instructions", () => ({
	addCustomInstructions: (...args: unknown[]) => mockAddCustomInstructions(...args),
}))

vi.mock("../../../utils/single-completion-handler", () => ({
	singleCompletionHandler: vi.fn(),
}))

vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureEvent: mockCaptureEvent,
		},
	},
}))

describe("CommitMessageGenerator", () => {
	const defaultConfig: ProviderSettings = { apiProvider: "openai", openAiApiKey: "default-key" }
	const commitConfig: ProviderSettings = { apiProvider: "anthropic", apiKey: "commit-key" }
	const providerSettingsManager = {
		initialize: vi.fn(),
		getProfile: vi.fn(),
	}

	beforeEach(() => {
		vi.clearAllMocks()
		mockContextProxy.isInitialized = true
		mockContextProxy.getProviderSettings.mockReturnValue(defaultConfig)
		mockContextProxy.getValue.mockImplementation((key: string) => {
			switch (key) {
				case "commitMessageApiConfigId":
					return undefined
				case "listApiConfigMeta":
					return []
				case "customSupportPrompts":
					return {}
				default:
					return undefined
			}
		})
		mockAddCustomInstructions.mockResolvedValue("Follow repo commit rules.")
		mockSingleCompletionHandler.mockResolvedValue("```\nfeat(core): add commit generator\n```")
		providerSettingsManager.initialize.mockResolvedValue(undefined)
		providerSettingsManager.getProfile.mockResolvedValue({ name: "Commit profile", ...commitConfig })
	})

	it("sends the full git context to the LLM and returns cleaned commit text", async () => {
		const gitContext = `## Git Context for Commit Message Generation

### Full Diff of Staged Changes
\`\`\`diff
diff --git a/src/new.ts b/src/new.ts
new file mode 100644
--- /dev/null
+++ b/src/new.ts
@@ -0,0 +1,1 @@
+export const value = 1
\`\`\``
		const generator = new CommitMessageGenerator(providerSettingsManager as any)

		const message = await generator.generateMessage({
			workspacePath: "/repo",
			selectedFiles: ["src/new.ts"],
			gitContext,
		})

		expect(message).toBe("feat(core): add commit generator")
		expect(mockSingleCompletionHandler).toHaveBeenCalledTimes(1)
		const [config, prompt] = mockSingleCompletionHandler.mock.calls[0]
		expect(config).toBe(defaultConfig)
		expect(prompt).toContain("# Conventional Commit Message Generator")
		expect(prompt).toContain("Follow repo commit rules.")
		expect(prompt).toContain(gitContext)
		expect(mockCaptureEvent).toHaveBeenCalledTimes(1)
	})

	it("uses the selected commit-message API profile when configured", async () => {
		mockContextProxy.getValue.mockImplementation((key: string) => {
			switch (key) {
				case "commitMessageApiConfigId":
					return "commit-profile"
				case "listApiConfigMeta":
					return [{ id: "commit-profile", name: "Commit profile" }]
				case "customSupportPrompts":
					return {}
				default:
					return undefined
			}
		})
		mockSingleCompletionHandler.mockResolvedValue("fix(git): include untracked file diffs")
		const generator = new CommitMessageGenerator(providerSettingsManager as any)

		await generator.generateMessage({
			workspacePath: "/repo",
			selectedFiles: ["src/new.ts"],
			gitContext: "diff --git a/src/new.ts b/src/new.ts",
		})

		expect(providerSettingsManager.initialize).toHaveBeenCalledTimes(1)
		expect(providerSettingsManager.getProfile).toHaveBeenCalledWith({ id: "commit-profile" })
		expect(mockSingleCompletionHandler).toHaveBeenCalledWith(
			expect.objectContaining(commitConfig),
			expect.stringContaining("diff --git a/src/new.ts b/src/new.ts"),
		)
	})

	it("falls back to current API config when the selected profile cannot be loaded", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
		mockContextProxy.getValue.mockImplementation((key: string) => {
			switch (key) {
				case "commitMessageApiConfigId":
					return "deleted-profile"
				case "listApiConfigMeta":
					return [{ id: "deleted-profile", name: "Deleted profile" }]
				case "customSupportPrompts":
					return {}
				default:
					return undefined
			}
		})
		providerSettingsManager.getProfile.mockRejectedValue(new Error("missing profile"))
		const generator = new CommitMessageGenerator(providerSettingsManager as any)

		await generator.generateMessage({
			workspacePath: "/repo",
			selectedFiles: ["src/new.ts"],
			gitContext: "diff --git a/src/new.ts b/src/new.ts",
		})

		expect(mockSingleCompletionHandler).toHaveBeenCalledWith(defaultConfig, expect.any(String))
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("Failed to load commit message API profile deleted-profile"),
			expect.any(Error),
		)
		warnSpy.mockRestore()
	})

	it("asks for a different message when regenerating for the same git context", async () => {
		mockSingleCompletionHandler.mockResolvedValueOnce("feat(git): collect commit context")
		mockSingleCompletionHandler.mockResolvedValueOnce("chore(git): improve diff handling")
		const generator = new CommitMessageGenerator(providerSettingsManager as any)
		const gitContext = "diff --git a/src/file.ts b/src/file.ts"

		await generator.generateMessage({ workspacePath: "/repo", selectedFiles: ["src/file.ts"], gitContext })
		await generator.generateMessage({ workspacePath: "/repo", selectedFiles: ["src/file.ts"], gitContext })

		const secondPrompt = mockSingleCompletionHandler.mock.calls[1][1]
		expect(secondPrompt).toContain("GENERATE A COMPLETELY DIFFERENT COMMIT MESSAGE")
		expect(secondPrompt).toContain('The previous message was: "feat(git): collect commit context"')
		expect(secondPrompt).toContain(gitContext)
	})
})

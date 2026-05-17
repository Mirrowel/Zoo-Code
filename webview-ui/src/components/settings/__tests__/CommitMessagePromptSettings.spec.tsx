import { fireEvent, render, screen } from "@testing-library/react"
import { vi } from "vitest"

import CommitMessagePromptSettings from "../CommitMessagePromptSettings"

const mockPostMessage = vi.fn()
;(global as any).acquireVsCodeApi = () => ({ postMessage: mockPostMessage })

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, values?: Record<string, unknown>) =>
			values?.count !== undefined ? `${key} ${values.count}` : key,
	}),
}))

vi.mock("@src/components/ui", () => ({
	Button: ({ children, onClick, disabled, "data-testid": dataTestId }: any) => (
		<button onClick={onClick} disabled={disabled} data-testid={dataTestId}>
			{children}
		</button>
	),
	Select: ({ children, value }: any) => (
		<div data-testid="select" data-value={value}>
			{children}
		</div>
	),
	SelectContent: ({ children }: any) => <div>{children}</div>,
	SelectItem: ({ children, value, "data-testid": dataTestId }: any) => (
		<div data-testid={dataTestId} data-value={value}>
			{children}
		</div>
	),
	SelectTrigger: ({ children, "data-testid": dataTestId }: any) => <div data-testid={dataTestId}>{children}</div>,
	SelectValue: ({ placeholder }: any) => <div>{placeholder}</div>,
	StandardTooltip: ({ children }: any) => <>{children}</>,
}))

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeCheckbox: ({ children, checked, onChange }: any) => (
		<label>
			<input type="checkbox" checked={checked} onChange={(event) => onChange(event)} />
			{children}
		</label>
	),
	VSCodeTextArea: ({ value, onInput, "data-testid": dataTestId }: any) => (
		<textarea value={value} onChange={(event) => onInput(event)} data-testid={dataTestId} />
	),
	VSCodeTextField: ({ children, value, onInput, "data-testid": dataTestId }: any) => (
		<label>
			{children}
			<input value={value} onChange={(event) => onInput(event)} data-testid={dataTestId} />
		</label>
	),
}))

describe("CommitMessagePromptSettings", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("updates profile settings through cached-state setters without posting directly", () => {
		const setCommitMessageProfiles = vi.fn()
		const setCustomSupportPrompts = vi.fn()
		const setCommitMessageApiConfigId = vi.fn()
		const setCommitMessageGitContext = vi.fn()

		render(
			<CommitMessagePromptSettings
				listApiConfigMeta={[]}
				customSupportPrompts={{ COMMIT_MESSAGE: "Legacy prompt ${gitContext}" }}
				setCustomSupportPrompts={setCustomSupportPrompts}
				commitMessageApiConfigId="legacy-api"
				setCommitMessageApiConfigId={setCommitMessageApiConfigId}
				commitMessageGitContext={{ diffContextLines: 4 }}
				setCommitMessageGitContext={setCommitMessageGitContext}
				commitMessageProfiles={undefined}
				setCommitMessageProfiles={setCommitMessageProfiles}
			/>,
		)

		fireEvent.change(screen.getByTestId("commit-message-prompt-textarea"), {
			target: { value: "Profile prompt ${gitContext}" },
		})

		expect(setCommitMessageProfiles).toHaveBeenCalledWith({
			activeProfileId: "default",
			profiles: [
				expect.objectContaining({
					id: "default",
					name: "Default",
					prompt: "Profile prompt ${gitContext}",
					apiConfigId: "legacy-api",
				}),
			],
		})
		expect(setCommitMessageApiConfigId).toHaveBeenCalledWith("legacy-api")
		expect(setCommitMessageGitContext).toHaveBeenCalledWith(expect.objectContaining({ diffContextLines: 4 }))
		expect(setCustomSupportPrompts).toHaveBeenCalledWith({ COMMIT_MESSAGE: "Profile prompt ${gitContext}" })
		expect(mockPostMessage).not.toHaveBeenCalled()
	})
})

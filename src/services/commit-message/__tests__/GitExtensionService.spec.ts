import * as path from "path"
import { execFile } from "child_process"

import { GitExtensionService } from "../GitExtensionService"

vi.mock("child_process", () => ({
	execFile: vi.fn(),
}))

const mockExecFile = vi.mocked(execFile)
const workspaceRoot = path.resolve("/repo")

function mockGitOutput(stdout: string) {
	mockExecFile.mockImplementation(((_command, _args, _options, callback?: unknown) => {
		if (typeof callback === "function") {
			callback(null, stdout, "")
		}
	}) as typeof execFile)
}

describe("GitExtensionService", () => {
	beforeEach(() => {
		mockExecFile.mockReset()
	})

	it("parses staged name-status output including renames and copies", async () => {
		mockGitOutput(
			["M", "src/file.ts", "R100", "src/old.ts", "src/new.ts", "C075", "src/a.ts", "src/b.ts", ""].join("\0"),
		)

		const service = new GitExtensionService(workspaceRoot)
		const changes = await service.gatherChanges({ staged: true })

		expect(mockExecFile).toHaveBeenCalledWith(
			"git",
			["diff", "--name-status", "--cached", "-z"],
			expect.objectContaining({ cwd: workspaceRoot }),
			expect.any(Function),
		)
		expect(changes).toEqual([
			{ filePath: path.join(workspaceRoot, "src/file.ts"), status: "M", staged: true },
			{
				filePath: path.join(workspaceRoot, "src/new.ts"),
				oldFilePath: path.join(workspaceRoot, "src/old.ts"),
				status: "R",
				staged: true,
			},
			{
				filePath: path.join(workspaceRoot, "src/b.ts"),
				oldFilePath: path.join(workspaceRoot, "src/a.ts"),
				status: "C",
				staged: true,
			},
		])
	})

	it("keeps lockfiles in commit context because git state is authoritative", async () => {
		mockGitOutput("diff --git a/package-lock.json b/package-lock.json\n")

		const service = new GitExtensionService(workspaceRoot)
		const context = await service.getCommitContext(
			[{ filePath: path.join(workspaceRoot, "package-lock.json"), status: "M", staged: true }],
			{ staged: true, includeRepoContext: false },
		)

		expect(context).toContain("diff --git a/package-lock.json b/package-lock.json")
		expect(context).toContain("Modified (staged): package-lock.json")
	})

	it("summarizes untracked files without trying to diff them", async () => {
		const service = new GitExtensionService(workspaceRoot)
		const context = await service.getCommitContext(
			[{ filePath: path.join(workspaceRoot, "src/new.ts"), status: "?", staged: false }],
			{ staged: false, includeRepoContext: false },
		)

		expect(mockExecFile).not.toHaveBeenCalled()
		expect(context).toContain(`New untracked file: ${path.join(workspaceRoot, "src/new.ts")}`)
		expect(context).toContain("Untracked (unstaged): src/new.ts")
	})
})

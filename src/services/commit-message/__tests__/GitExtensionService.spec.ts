import * as os from "os"
import * as path from "path"
import { EventEmitter } from "events"
import { promises as fs } from "fs"
import { spawn } from "child_process"

import { GitExtensionService } from "../GitExtensionService"

vi.mock("child_process", () => ({
	spawn: vi.fn(),
}))

const mockSpawn = vi.mocked(spawn)
const workspaceRoot = path.resolve("/repo")

function mockGitCommand(stdout: string, stderr = "", code = 0) {
	mockSpawn.mockImplementationOnce((() => {
		const child = new EventEmitter() as EventEmitter & {
			stdout: EventEmitter & { setEncoding: ReturnType<typeof vi.fn> }
			stderr: EventEmitter & { setEncoding: ReturnType<typeof vi.fn> }
		}

		child.stdout = Object.assign(new EventEmitter(), { setEncoding: vi.fn() })
		child.stderr = Object.assign(new EventEmitter(), { setEncoding: vi.fn() })

		queueMicrotask(() => {
			if (stdout) {
				child.stdout.emit("data", stdout)
			}

			if (stderr) {
				child.stderr.emit("data", stderr)
			}

			child.emit("close", code)
		})

		return child
	}) as unknown as typeof spawn)
}

describe("GitExtensionService", () => {
	beforeEach(() => {
		mockSpawn.mockReset()
	})

	it("parses staged name-status output including renames and copies", async () => {
		mockGitCommand(
			["M", "src/file.ts", "R100", "src/old.ts", "src/new.ts", "C075", "src/a.ts", "src/b.ts", ""].join("\0"),
		)

		const service = new GitExtensionService(workspaceRoot)
		const changes = await service.gatherChanges({ staged: true })

		expect(mockSpawn).toHaveBeenCalledWith(
			"git",
			["diff", "--name-status", "--cached", "-z"],
			expect.objectContaining({ cwd: workspaceRoot }),
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
		mockGitCommand("1\t1\tpackage-lock.json\n")
		mockGitCommand("diff --git a/package-lock.json b/package-lock.json\n")

		const service = new GitExtensionService(workspaceRoot)
		const context = await service.getCommitContext(
			[{ filePath: path.join(workspaceRoot, "package-lock.json"), status: "M", staged: true }],
			{ staged: true, includeRepoContext: false },
		)

		expect(context).toContain("diff --git a/package-lock.json b/package-lock.json")
		expect(context).toContain("Modified (staged): package-lock.json")
	})

	it("includes full new-file diffs for untracked text files", async () => {
		const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "zoo-commit-context-"))
		try {
			const filePath = path.join(tempRoot, "src", "new.ts")
			await fs.mkdir(path.dirname(filePath), { recursive: true })
			await fs.writeFile(filePath, "export const value = 1\n")

			const service = new GitExtensionService(tempRoot)
			const context = await service.getCommitContext([{ filePath, status: "?", staged: false }], {
				staged: false,
				includeRepoContext: false,
			})

			expect(mockSpawn).not.toHaveBeenCalled()
			expect(context).toContain("diff --git a/src/new.ts b/src/new.ts")
			expect(context).toContain("--- /dev/null")
			expect(context).toContain("+export const value = 1")
			expect(context).toContain("Untracked (unstaged): src/new.ts")
		} finally {
			await fs.rm(tempRoot, { recursive: true, force: true })
		}
	})

	it("summarizes untracked binary files without binary payload", async () => {
		const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "zoo-commit-context-"))
		try {
			const filePath = path.join(tempRoot, "image.bin")
			await fs.writeFile(filePath, Buffer.from([0, 1, 2, 3]))

			const service = new GitExtensionService(tempRoot)
			const context = await service.getCommitContext([{ filePath, status: "?", staged: false }], {
				staged: false,
				includeRepoContext: false,
			})

			expect(context).toContain("Binary file added: image.bin")
			expect(context).not.toContain("@@ -0,0")
			expect(context).toContain("Untracked (unstaged): image.bin")
		} finally {
			await fs.rm(tempRoot, { recursive: true, force: true })
		}
	})

	it("fails required diff collection instead of emitting partial context", async () => {
		mockGitCommand("1\t1\tsrc/file.ts\n")
		mockGitCommand("", "fatal: bad revision", 128)

		const service = new GitExtensionService(workspaceRoot)

		await expect(
			service.getCommitContext(
				[{ filePath: path.join(workspaceRoot, "src/file.ts"), status: "M", staged: true }],
				{ staged: true, includeRepoContext: false },
			),
		).rejects.toThrow("fatal: bad revision")
	})

	it("returns warnings when supplemental repository context is unavailable", async () => {
		mockGitCommand("1\t1\tsrc/file.ts\n")
		mockGitCommand("diff --git a/src/file.ts b/src/file.ts\n")
		mockGitCommand("", "fatal: branch unavailable", 128)
		mockGitCommand("", "fatal: log unavailable", 128)

		const service = new GitExtensionService(workspaceRoot)
		const result = await service.getCommitContextResult(
			[{ filePath: path.join(workspaceRoot, "src/file.ts"), status: "M", staged: true }],
			{ staged: true, includeRepoContext: true },
		)

		expect(result.warnings).toEqual([
			expect.stringContaining("Current branch unavailable"),
			expect.stringContaining("Recent commits unavailable"),
		])
		expect(result.context).toContain("### Context Warnings")
		expect(result.context).toContain("diff --git a/src/file.ts b/src/file.ts")
	})
})

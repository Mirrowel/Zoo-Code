import * as path from "path"

import { isPathWithinRepository } from "../CommitMessageProvider"

vi.mock("vscode", () => ({}))

describe("CommitMessageProvider", () => {
	it("matches repository roots by path containment instead of string prefix", () => {
		const root = path.parse(process.cwd()).root
		const repositoryPath = path.join(root, "work", "app")

		expect(isPathWithinRepository(path.join(repositoryPath, "src", "index.ts"), repositoryPath)).toBe(true)
		expect(isPathWithinRepository(repositoryPath, repositoryPath)).toBe(true)
		expect(isPathWithinRepository(path.join(root, "work", "application"), repositoryPath)).toBe(false)
	})
})

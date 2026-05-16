import ignore, { Ignore } from "ignore"
import { normalize } from "path"

const lockFiles: string[] = [
	"package-lock.json",
	"npm-shrinkwrap.json",
	"yarn.lock",
	"pnpm-lock.yaml",
	"pnpm-workspace.yaml",
	"bun.lockb",
	".yarnrc.yml",
	".pnp.js",
	".pnp.cjs",
	"jspm.lock",

	"Pipfile.lock",
	"poetry.lock",
	"pdm.lock",
	".pdm-lock.toml",
	"conda-lock.yml",
	"pylock.toml",

	"Gemfile.lock",
	".bundle/config",

	"composer.lock",

	"gradle.lockfile",
	"lockfile.json",
	"dependency-lock.json",
	"dependency-reduced-pom.xml",
	"coursier.lock",

	"build.sbt.lock",

	"packages.lock.json",
	"paket.lock",
	"project.assets.json",

	"Cargo.lock",

	"go.sum",
	"Gopkg.lock",
	"glide.lock",
	"vendor/vendor.json",

	"build.zig.zon.lock",

	"dune.lock",
	"opam.lock",

	"kotlin-js-store",

	"Package.resolved",
	"Podfile.lock",
	"Cartfile.resolved",

	"pubspec.lock",

	"mix.lock",
	"rebar.lock",

	"stack.yaml.lock",
	"cabal.project.freeze",

	"elm-stuff/exact-dependencies.json",

	"shard.lock",

	"Manifest.toml",
	"JuliaManifest.toml",

	"renv.lock",
	"packrat.lock",

	"nimble.lock",

	"dub.selections.json",

	"rocks.lock",

	"carton.lock",
	"cpanfile.snapshot",

	"conan.lock",
	"vcpkg-lock.json",

	".terraform.lock.hcl",
	"Berksfile.lock",
	"Puppetfile.lock",

	"flake.lock",

	"deno.lock",

	"devcontainer.lock.json",
]

const createLockFileIgnoreInstance = (): Ignore => {
	const ignoreInstance = ignore()

	const lockFilePatterns = lockFiles.map((file) => `**/${file}`)
	ignoreInstance.add(lockFilePatterns)

	const directoryPatterns = [
		"**/kotlin-js-store",
		"**/kotlin-js-store/**",
		"**/elm-stuff",
		"**/elm-stuff/**",
		"**/.yarn/cache/**",
		"**/.yarn/unplugged/**",
		"**/.yarn/build-state.yml",
		"**/.yarn/install-state.gz",
	]
	ignoreInstance.add(directoryPatterns)

	return ignoreInstance
}

const lockFileIgnoreInstance = createLockFileIgnoreInstance()

export function shouldExcludeLockFile(filePath: string): boolean {
	const normalizedPath = normalize(filePath)
	return lockFileIgnoreInstance.ignores(normalizedPath)
}

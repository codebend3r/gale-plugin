package com.codebend3r.gale.core

import com.codebend3r.gale.generated.GaleFacts
import java.nio.file.Path

// The shared Gale contract in Kotlin. The generated ConformanceTest checks it
// against the same cases as the TypeScript and Rust implementations.

enum class Os(
    val nodeName: String,
) {
    DARWIN("darwin"),
    LINUX("linux"),
    WIN32("win32"),
}

/** `arch` is a Node.js-style name: "arm64", "x64", or anything else. */
data class Platform(
    val os: Os,
    val arch: String,
)

/** The only settings the contract functions read. */
data class PathSettings(
    val configPath: String,
    val binaryPath: String,
)

/** What the host found before calling [resolveBinary]. */
data class Probe(
    val projectInstalled: Boolean,
    val which: String?,
)

enum class Source { SETTING, PROJECT, PATH }

sealed interface Resolution {
    data class Found(
        val source: Source,
        val command: String,
    ) : Resolution

    data object NotFound : Resolution
}

/** The Rust target Gale publishes for this platform, or null if it publishes none. */
fun rustTarget(platform: Platform): String? =
    GaleFacts.PLATFORMS
        .firstOrNull { (os, arch) -> os == platform.os.nodeName && arch == platform.arch }
        ?.third

fun binaryFileName(os: Os): String = if (os == Os.WIN32) "${GaleFacts.SERVER_COMMAND}.exe" else GaleFacts.SERVER_COMMAND

/** Where a project install of `@codebend3r/gale` keeps the native binary. */
fun projectBinaryPath(
    root: String?,
    platform: Platform,
): String? {
    val target = rustTarget(platform)
    if (root == null || target == null) {
        return null
    }
    return Path
        .of(root, "node_modules", GaleFacts.NPM_PACKAGE_NAME, GaleFacts.NPM_BIN_DIR, target, binaryFileName(platform.os))
        .toString()
}

/** Picks the binary to run: the setting, then the project install, then PATH. */
fun resolveBinary(
    settings: PathSettings,
    root: String?,
    platform: Platform,
    probe: Probe,
): Resolution {
    if (settings.binaryPath.isNotEmpty()) {
        return Resolution.Found(Source.SETTING, settings.binaryPath)
    }
    val projectPath = projectBinaryPath(root, platform)
    if (projectPath != null && probe.projectInstalled) {
        return Resolution.Found(Source.PROJECT, projectPath)
    }
    val onPath = probe.which ?: return Resolution.NotFound
    return Resolution.Found(Source.PATH, onPath)
}

/** `--lsp`, plus `--config <path>` exactly as the user wrote it. */
fun serverArgs(settings: PathSettings): List<String> =
    if (settings.configPath.isEmpty()) {
        listOf(GaleFacts.LSP_ARG)
    } else {
        listOf(GaleFacts.LSP_ARG, GaleFacts.CONFIG_ARG, settings.configPath)
    }

private val watchedNames = GaleFacts.CONFIG_FILE_NAMES.toSet() + GaleFacts.PACKAGE_JSON_FILE_NAME

/**
 * Whether a change to [changedPath] can change the config Gale loads, so the
 * server needs a restart. Gale reads config once, looking from [root] upward.
 */
fun shouldRestart(
    changedPath: String,
    root: String,
    settings: PathSettings,
): Boolean {
    val changed = Path.of(changedPath)
    if (changed.any { it.toString() == "node_modules" }) {
        return false
    }
    val rootPath = Path.of(root)
    if (settings.configPath.isNotEmpty() && changed == rootPath.resolve(settings.configPath).normalize()) {
        return true
    }
    val dir = changed.parent
    return dir != null && changed.fileName.toString() in watchedNames && rootPath.startsWith(dir)
}

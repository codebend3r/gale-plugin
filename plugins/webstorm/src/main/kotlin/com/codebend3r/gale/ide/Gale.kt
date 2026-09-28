package com.codebend3r.gale.ide

import com.codebend3r.gale.core.Os
import com.codebend3r.gale.core.PathSettings
import com.codebend3r.gale.core.Platform
import com.codebend3r.gale.core.Probe
import com.codebend3r.gale.core.Resolution
import com.codebend3r.gale.core.projectBinaryPath
import com.codebend3r.gale.core.resolveBinary
import com.codebend3r.gale.generated.GaleFacts
import com.intellij.execution.configurations.PathEnvironmentVariableUtil
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.platform.lsp.api.LspClientManager
import java.nio.file.Files
import java.nio.file.Path

/** How the plugin looks for binaries. Tests swap it for a fake. */
interface BinaryLocator {
    fun isFile(path: String): Boolean

    fun findOnPath(name: String): String?
}

object SystemBinaryLocator : BinaryLocator {
    override fun isFile(path: String): Boolean = Files.isRegularFile(Path.of(path))

    override fun findOnPath(name: String): String? = PathEnvironmentVariableUtil.findInPath(name)?.path
}

/** Maps the JVM's `os.name` and `os.arch` onto the contract's Node.js-style names. */
fun platformFor(
    osName: String,
    osArch: String,
): Platform {
    val os =
        when {
            osName.startsWith("Mac") -> Os.DARWIN
            osName.startsWith("Windows") -> Os.WIN32
            else -> Os.LINUX
        }
    val arch =
        when (osArch) {
            "aarch64", "arm64" -> "arm64"
            "amd64", "x86_64" -> "x64"
            else -> osArch
        }
    return Platform(os, arch)
}

fun currentPlatform(): Platform = platformFor(System.getProperty("os.name"), System.getProperty("os.arch"))

/** Gathers the probes for [project] and asks the contract which binary to run. */
fun resolveGale(
    project: Project,
    settings: PathSettings,
    platform: Platform,
    locator: BinaryLocator,
): Resolution {
    val root = project.basePath
    val projectPath = projectBinaryPath(root, platform)
    val probe =
        Probe(
            projectInstalled = projectPath != null && locator.isFile(projectPath),
            which = locator.findOnPath(GaleFacts.SERVER_COMMAND),
        )
    return resolveBinary(settings, root, platform, probe)
}

fun isGaleFile(file: VirtualFile): Boolean = file.extension?.lowercase() in GaleFacts.LANGUAGE_EXTENSIONS

/** Restarts Gale; the provider re-reads every setting, so a disabled Gale just stops. */
fun restartGale(project: Project) {
    LspClientManager.getInstance(project).stopAndRestartClientsIfNeeded(GaleLspIntegrationProvider::class.java)
}

package com.codebend3r.gale.ide

import com.codebend3r.gale.core.PathSettings
import com.codebend3r.gale.core.Platform
import com.codebend3r.gale.core.serverArgs
import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.platform.lsp.api.LspIntegrationProvider
import com.intellij.platform.lsp.api.ProjectWideLspClientDescriptor

class GaleLspIntegrationProvider internal constructor(
    private val platform: Platform,
    private val locator: BinaryLocator,
    private val notifier: MissingBinaryNotifier,
) : LspIntegrationProvider {
    constructor() : this(currentPlatform(), SystemBinaryLocator, MissingBinaryNotifier())

    override fun fileOpened(
        project: Project,
        file: VirtualFile,
        clientStarter: LspIntegrationProvider.LspClientStarter,
    ) {
        val settings = GaleSettings.getInstance(project)
        if (!settings.state.enabled || !isGaleFile(file)) {
            return
        }
        val pathSettings = settings.pathSettings
        val command = resolveGale(project, pathSettings, platform, locator)
        if (command != null) {
            clientStarter.ensureClientStarted(GaleClientDescriptor(project, command, pathSettings))
        } else {
            notifier.notify(project)
        }
    }
}

class GaleClientDescriptor(
    project: Project,
    val command: String,
    private val settings: PathSettings,
) : ProjectWideLspClientDescriptor(project, "Gale") {
    override fun isSupportedFile(file: VirtualFile): Boolean = isGaleFile(file)

    override fun createCommandLine(): GeneralCommandLine =
        GeneralCommandLine(listOf(command) + serverArgs(settings))
            .withWorkDirectory(project.basePath)
}
